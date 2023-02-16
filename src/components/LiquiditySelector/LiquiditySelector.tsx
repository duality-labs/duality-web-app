import BigNumber from 'bignumber.js';
import React, {
  useState,
  useMemo,
  useCallback,
  useLayoutEffect,
  MouseEvent,
  useRef,
  useEffect,
  ComponentType,
} from 'react';
import useResizeObserver from '@react-hook/resize-observer';

import { formatAmount, formatPrice } from '../../lib/utils/number';
import { feeTypes } from '../../lib/web3/utils/fees';
import { priceToTickIndex } from '../../lib/web3/utils/ticks';
import useCurrentPriceFromTicks from './useCurrentPriceFromTicks';
import useOnDragMove from '../hooks/useOnDragMove';

import { Token } from '../TokenPicker/hooks';
import { TickInfo } from '../../lib/web3/indexerProvider';

import './LiquiditySelector.scss';

export interface LiquiditySelectorProps {
  ticks: TickInfo[] | undefined;
  tokenA: Token;
  tokenB: Token;
  feeTier: number | undefined;
  userTickSelected: number | undefined;
  setUserTickSelected: (index: number) => void;
  rangeMin: string;
  rangeMax: string;
  setRangeMin: React.Dispatch<React.SetStateAction<string>>;
  setRangeMax: React.Dispatch<React.SetStateAction<string>>;
  userTicksBase?: Array<Tick | undefined>;
  userTicks?: Array<Tick | undefined>;
  setUserTicks?: (callback: (userTicks: TickGroup) => TickGroup) => void;
  advanced?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  canMoveX?: boolean;
  oneSidedLiquidity?: boolean;
  ControlsComponent?: ComponentType<{
    zoomIn?: () => void;
    zoomOut?: () => void;
  }>;
}

export interface Tick {
  reserveA: BigNumber;
  reserveB: BigNumber;
  tickIndex: number;
  price: BigNumber;
  fee: BigNumber;
  feeIndex: number;
  tokenA: Token;
  tokenB: Token;
}
export type TickGroup = Array<Tick>;
type TickGroupBucketsEmpty = Array<
  [lowerBound: BigNumber, upperBound: BigNumber]
>;
type TickGroupBucketsFilled = Array<
  [
    lowerBound: BigNumber,
    upperBound: BigNumber,
    reserveA: BigNumber,
    reserveB: BigNumber
  ]
>;

const bucketWidth = 8; // bucket width in pixels

const defaultStartValue = new BigNumber(1 / 1.1);
const defaultEndValue = new BigNumber(1.1);

// set maximum zoom constants:
// zooming past the resolution of ticks does not help the end users.
// We should allow users to see at minimum a few ticks across the width of a
// the chart. As our tickspacing base is a ratio of 1.0001, a max ratio of
// 1.001 should allow users to see to space of about 10 ticks at max zoom.
const maxZoomRatio = 1.01; // eg. midpoint of 200: zoomMin≈199 zoomMax≈201
const zoomSpeedFactor = 0.5; // approx equivalent to zooming in range by 10%

const leftPadding = 75;
const rightPadding = 75;
const topPadding = 33;
const bottomPadding = 26; // height of axis-ticks element

const poleWidth = 8;

export default function LiquiditySelector({
  ticks = [],
  tokenA,
  tokenB,
  feeTier,
  userTickSelected = -1,
  setUserTickSelected,
  rangeMin,
  rangeMax,
  setRangeMin,
  setRangeMax,
  userTicks = [],
  userTicksBase = userTicks,
  setUserTicks,
  advanced = false,
  canMoveUp,
  canMoveDown,
  canMoveX,
  oneSidedLiquidity = false,
  ControlsComponent,
}: LiquiditySelectorProps) {
  // translate ticks from token0/1 to tokenA/B
  const allTicks: TickGroup = useMemo(() => {
    return (
      ticks
        // filter to only ticks that match our token set
        .filter(
          ({ token0, token1, reserve0, reserve1 }) =>
            // check that there are reserves in this tick
            (!reserve0.isZero() || !reserve1.isZero()) &&
            // check the direction is either forward or reverse
            ((token0 === tokenA && token1 === tokenB) ||
              (token1 === tokenA && token0 === tokenB))
        )
        .map(
          ({
            token0,
            token1,
            reserve0,
            reserve1,
            tickIndex,
            price,
            fee,
            feeIndex,
          }) => {
            const forward = token0 === tokenA;
            return {
              tokenA: forward ? token0 : token1,
              tokenB: forward ? token1 : token0,
              reserveA: forward ? reserve0 : reserve1,
              reserveB: forward ? reserve1 : reserve0,
              tickIndex: (forward ? tickIndex : tickIndex.negated()).toNumber(),
              price: forward ? price : new BigNumber(1).dividedBy(price),
              fee,
              feeIndex: feeIndex.toNumber(),
            };
          }
        )
        .sort((a, b) => a.price.comparedTo(b.price))
    );
  }, [ticks, tokenA, tokenB]);

  const isReserveAZero = allTicks.every(({ reserveA }) => reserveA.isZero());
  const isReserveBZero = allTicks.every(({ reserveB }) => reserveB.isZero());

  // collect tick information in a more useable form
  const feeTicks: TickGroup = useMemo(() => {
    return !feeTier
      ? allTicks
      : allTicks
          // filter to only fee tier ticks
          .filter((tick) => feeTypes[tick.feeIndex]?.fee === feeTier);
  }, [allTicks, feeTier]);

  // todo: base graph start and end on existing ticks and current price
  //       (if no existing ticks exist only cuurent price can indicate start and end)

  const currentPriceFromTicks = useCurrentPriceFromTicks(
    tokenA.address,
    tokenB.address
  );

  const isUserTicksAZero =
    oneSidedLiquidity &&
    userTicks.every((tick) => tick?.reserveA.isZero() ?? true);
  const isUserTicksBZero =
    oneSidedLiquidity &&
    userTicks.every((tick) => tick?.reserveB.isZero() ?? true);

  // note edge price, the price of the edge of one-sided liquidity
  const edgePrice = useMemo(() => {
    const startTick = allTicks[0];
    const endTick = allTicks[allTicks.length - 1];
    return (
      (isReserveAZero && startTick?.price) ||
      (isReserveBZero && endTick?.price) ||
      undefined
    );
  }, [isReserveAZero, isReserveBZero, allTicks]);

  // note warning price, the price at which warning states should be shown
  // for one-sided liquidity this is the extent of data to one side
  const warningPriceSingleSidedLiquidity = useMemo(() => {
    const startTick = allTicks[0];
    const endTick = allTicks[allTicks.length - 1];
    return (
      (oneSidedLiquidity &&
        ((isReserveAZero && !isUserTicksAZero && startTick?.price) ||
          (isReserveBZero && !isUserTicksBZero && endTick?.price))) ||
      undefined
    );
  }, [
    oneSidedLiquidity,
    isReserveAZero,
    isReserveBZero,
    isUserTicksAZero,
    isUserTicksBZero,
    allTicks,
  ]);

  const warningPriceDoubleSidedLiquidity = useMemo(() => {
    const warningPrice = edgePrice || currentPriceFromTicks;
    return (
      (!oneSidedLiquidity &&
        (warningPrice?.isLessThan(rangeMin) ||
          warningPrice?.isGreaterThan(rangeMax)) &&
        warningPrice) ||
      undefined
    );
  }, [oneSidedLiquidity, rangeMin, rangeMax, edgePrice, currentPriceFromTicks]);

  const warningPrice =
    warningPriceSingleSidedLiquidity || warningPriceDoubleSidedLiquidity;

  const initialGraphStart = useMemo(() => {
    const graphStart = currentPriceFromTicks?.dividedBy(4) ?? defaultStartValue;
    return graphStart.isLessThan(defaultStartValue)
      ? defaultStartValue
      : graphStart;
  }, [currentPriceFromTicks]);
  const initialGraphEnd = useMemo(() => {
    const graphEnd = currentPriceFromTicks?.multipliedBy(4) ?? defaultEndValue;
    return graphEnd.isLessThan(defaultEndValue) ? defaultEndValue : graphEnd;
  }, [currentPriceFromTicks]);

  const [dataStart, dataEnd] = useMemo(() => {
    const { xMin, xMax } = allTicks.reduce<{
      [key: string]: BigNumber | undefined;
    }>((result, { price }) => {
      if (result.xMin === undefined || price.isLessThan(result.xMin))
        result.xMin = price;
      if (result.xMax === undefined || price.isGreaterThan(result.xMax))
        result.xMax = price;
      return result;
    }, {});
    return [xMin, xMax];
  }, [allTicks]);

  // set and allow ephemeral setting of graph extents
  // allow user ticks to reset the boundary of the graph
  const [allDataStart, allDataEnd] = useMemo<
    [BigNumber | undefined, BigNumber | undefined]
  >(() => {
    const allValues = [
      dataStart?.toNumber() || 0,
      dataEnd?.toNumber() || 0,
    ].filter((v) => v && !isNaN(v));
    // todo: ensure buckets (of maximum bucketWidth) can fit onto the graph extents
    // by padding dataStart and dataEnd with the needed amount of pixels
    if (allValues.length > 0) {
      return [
        new BigNumber(Math.min(...allValues)),
        new BigNumber(Math.max(...allValues)),
      ];
    } else {
      return [undefined, undefined];
    }
  }, [dataStart, dataEnd]);

  const [[zoomMin, zoomMax] = [], setZoomRange] = useState<[string, string]>();

  const [zoomedDataStart, zoomedDataEnd] = useMemo<
    [BigNumber | undefined, BigNumber | undefined]
  >(() => {
    if (
      !!zoomMin &&
      !!zoomMax &&
      !isNaN(Number(zoomMin)) &&
      !isNaN(Number(zoomMax))
    ) {
      if (allDataStart?.isNaN() === false && allDataEnd?.isNaN() === false) {
        const min = allDataStart.isLessThan(zoomMin)
          ? new BigNumber(zoomMin)
          : allDataStart;
        const max = allDataEnd.isGreaterThan(zoomMax)
          ? new BigNumber(zoomMax)
          : allDataEnd;
        return [min, max];
      } else {
        return [new BigNumber(zoomMin), new BigNumber(zoomMax)];
      }
    }
    return [allDataStart, allDataEnd];
  }, [zoomMin, zoomMax, allDataStart, allDataEnd]);

  // set and allow ephemeral setting of graph extents
  // allow user ticks to reset the boundary of the graph
  const [graphStart = initialGraphStart, graphEnd = initialGraphEnd] = useMemo<
    [BigNumber | undefined, BigNumber | undefined]
  >(() => {
    const minUserTickPrice = userTicks.reduce<BigNumber | undefined>(
      (result, tick) => {
        if (!tick) return result;
        const { price } = tick;
        return !result || price.isLessThan(result) ? price : result;
      },
      undefined
    );
    const maxUserTickPrice = userTicks.reduce<BigNumber | undefined>(
      (result, tick) => {
        if (!tick) return result;
        const { price } = tick;
        return !result || price.isGreaterThan(result) ? price : result;
      },
      undefined
    );
    const allValues = [
      Number(rangeMin),
      Number(rangeMax),
      minUserTickPrice?.toNumber() || 0,
      maxUserTickPrice?.toNumber() || 0,
      zoomedDataStart?.toNumber(),
      zoomedDataEnd?.toNumber(),
    ].filter((v): v is number => !!v && !isNaN(v));
    // todo: ensure buckets (of maximum bucketWidth) can fit onto the graph extents
    // by padding dataStart and dataEnd with the needed amount of pixels
    if (allValues.length > 0) {
      return [
        new BigNumber(Math.min(...allValues)),
        new BigNumber(Math.max(...allValues)),
      ];
    } else {
      return [undefined, undefined];
    }
  }, [rangeMin, rangeMax, userTicks, zoomedDataStart, zoomedDataEnd]);

  // find container size that buckets should fit
  const svgContainer = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    setContainerSize({
      width: svgContainer.current?.clientWidth ?? 0,
      height: svgContainer.current?.clientHeight ?? 0,
    });
  }, [svgContainer]);

  useResizeObserver(svgContainer, (container) =>
    setContainerSize({
      width: container.contentRect.width,
      height: container.contentRect.height,
    })
  );

  const bucketCount =
    (Math.ceil(containerSize.width / bucketWidth) ?? 1) + // default to 1 bucket if none
    1; // add bucket to account for splitting bucket on current price
  const bucketRatio = useMemo(() => {
    // get bounds
    const xMin = graphStart.sd(1, BigNumber.ROUND_DOWN);
    const xMax = graphEnd.sd(1, BigNumber.ROUND_UP);
    const xWidth = xMax.dividedBy(xMin);

    /**
     * The "width" of the buckets is a ratio that is applied bucketCount times up to the total width:
     *   xWidth = x^bucketCountAdjusted
     *   x^bucketCountAdjusted) = xWidth
     *   ln(x^bucketCountAdjusted) = ln(xWidth)
     *   ln(x)*bucketCountAdjusted = ln(xWidth)
     *   ln(x) = ln(xWidth)/bucketCountAdjusted
     *   x = e^(ln(xWidth)/bucketCountAdjusted)
     */
    return Math.exp(Math.log(xWidth.toNumber()) / bucketCount) || 1; // set at least 1
    // note: BigNumber cannot handle logarithms so it cannot calculate this
  }, [graphStart, graphEnd, bucketCount]);

  // calculate bucket extents
  const emptyBuckets = useMemo<
    [TickGroupBucketsEmpty, TickGroupBucketsEmpty]
  >(() => {
    // skip unknown bucket placements
    if (!dataStart || !dataEnd) {
      return [[], []];
    }
    // get bounds
    const xMin = dataStart;
    const xMax = dataEnd;
    // get middle 'break' point which will separate bucket sections
    const breakPoint = edgePrice || currentPriceFromTicks;
    // skip if there is no breakpoint
    if (!breakPoint) {
      return [[], []];
    }
    const tokenABuckets = Array.from({ length: bucketCount }).reduce<
      [min: BigNumber, max: BigNumber][]
    >((result) => {
      const newValue = result[0]?.[0] ?? breakPoint;
      return newValue.isLessThanOrEqualTo(xMin)
        ? // return finished array
          result
        : // prepend new bucket
          [[newValue.dividedBy(bucketRatio), newValue], ...result];
    }, []);
    const tokenBBuckets = Array.from({ length: bucketCount }).reduce<
      [min: BigNumber, max: BigNumber][]
    >((result) => {
      const newValue = result[result.length - 1]?.[1] ?? breakPoint;
      return newValue.isGreaterThanOrEqualTo(xMax)
        ? // return finished array
          result
        : // append new bucket
          [...result, [newValue, newValue.multipliedBy(bucketRatio)]];
    }, []);

    // return concantenated buckes
    return [tokenABuckets, tokenBBuckets];
  }, [
    edgePrice,
    currentPriceFromTicks,
    bucketRatio,
    bucketCount,
    dataStart,
    dataEnd,
  ]);

  // calculate histogram values
  const feeTickBuckets = useMemo<
    [TickGroupBucketsFilled, TickGroupBucketsFilled]
  >(() => {
    return [
      fillBuckets(emptyBuckets[0], feeTicks),
      fillBuckets(emptyBuckets[1], feeTicks),
    ];
  }, [emptyBuckets, feeTicks]);

  const graphHeight = useMemo(() => {
    const allFeesTickBuckets = [
      fillBuckets(emptyBuckets[0], allTicks),
      fillBuckets(emptyBuckets[1], allTicks),
    ];
    return allFeesTickBuckets
      .flat()
      .reduce((result, [lowerBound, upperBound, tokenAValue, tokenBValue]) => {
        return Math.max(result, tokenAValue.toNumber(), tokenBValue.toNumber());
      }, 0);
  }, [emptyBuckets, allTicks]);

  // plot values as percentages on a 100 height viewbox (viewBox="0 -100 100 100")
  const startIsEnd = graphEnd.isLessThanOrEqualTo(graphStart);
  const xMin = (startIsEnd ? graphStart.minus(1e-18) : graphStart).toNumber();
  const xMax = (startIsEnd ? graphEnd.plus(1e-18) : graphEnd).toNumber();
  const plotX = useCallback(
    (x: number): number => {
      const width = containerSize.width - leftPadding - rightPadding;
      return xMin === xMax
        ? // choose midpoint
          leftPadding + width / 2
        : // interpolate coordinate to graph
          leftPadding +
            (width * (Math.log(x) - Math.log(xMin))) /
              (Math.log(xMax) - Math.log(xMin));
    },
    [xMin, xMax, containerSize.width]
  );
  const plotXinverse = useCallback(
    (x: number): number => {
      const width = containerSize.width - leftPadding - rightPadding;
      return Math.exp(
        ((x - leftPadding) * (Math.log(xMax) - Math.log(xMin))) / width +
          Math.log(xMin)
      );
    },
    [xMin, xMax, containerSize.width]
  );
  const plotY = useCallback(
    (y: number): number => {
      const height = containerSize.height - topPadding - bottomPadding;
      return graphHeight === 0
        ? -bottomPadding // pin to bottom
        : -bottomPadding - (height * y) / graphHeight;
    },
    [graphHeight, containerSize.height]
  );
  const percentY = useCallback(
    (y: number): number => {
      const height = containerSize.height - topPadding - bottomPadding;
      return -bottomPadding - height * y;
    },
    [containerSize.height]
  );
  const plotXBigNumber = useCallback(
    (x: BigNumber) => plotX(x.toNumber()),
    [plotX]
  );
  const plotYBigNumber = useCallback(
    (y: BigNumber) => plotY(y.toNumber()),
    [plotY]
  );
  const percentYBigNumber = useCallback(
    (y: BigNumber) => percentY(y.toNumber()),
    [percentY]
  );

  function TextRoundedBackgroundFilter({
    id,
    floodColor,
  }: {
    id: string;
    floodColor: string;
  }) {
    return (
      <filter x="0" y="-0.4" width="1" height="1.8" id={id}>
        <feFlood floodColor={floodColor} />
        <feGaussianBlur stdDeviation="3.5" />
        <feComponentTransfer>
          <feFuncA type="table" tableValues="0 0 0 1" />
        </feComponentTransfer>
        <feComponentTransfer>
          <feFuncA type="table" tableValues="0 1 1 1 1 1 1 1" />
        </feComponentTransfer>
        <feComposite operator="over" in="SourceGraphic" />
      </filter>
    );
  }

  const svg = (
    <svg
      className={['chart-liquidity', advanced && 'chart-type--advanced']
        .filter(Boolean)
        .join(' ')}
      viewBox={`0 -${containerSize.height} ${containerSize.width} ${containerSize.height}`}
    >
      <defs>
        <filter
          x="0"
          y="-0.1"
          width="1"
          height="1.2"
          id="text-solid-background"
        >
          <feFlood floodColor="hsl(202, 59%, 21%)" result="bg" />
          <feMerge>
            <feMergeNode in="bg" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <TextRoundedBackgroundFilter
          id="text-solid-highlight"
          floodColor="hsl(201, 77%, 61%)"
        />
        <TextRoundedBackgroundFilter
          id="text-solid-error"
          floodColor="var(--error)"
        />
        <linearGradient id="white-concave-fade">
          <stop offset="0%" stopColor="hsl(220, 44%, 45%)" stopOpacity="0.1" />
          <stop
            offset="100%"
            stopColor="hsl(220, 44%, 45%)"
            stopOpacity="0.1"
          />
        </linearGradient>
      </defs>
      {graphEnd.isZero() && <text>Chart is not currently available</text>}
      {!advanced && (
        <TicksBackgroundArea
          className="new-ticks-area"
          rangeMin={rangeMin}
          rangeMax={rangeMax}
          plotX={plotXBigNumber}
          plotY={percentYBigNumber}
        />
      )}
      <TickBucketsGroup
        className="left-ticks"
        tickBuckets={feeTickBuckets[0]}
        plotX={plotXBigNumber}
        plotY={plotYBigNumber}
      />
      <TickBucketsGroup
        className="right-ticks"
        tickBuckets={feeTickBuckets[1]}
        plotX={plotXBigNumber}
        plotY={plotYBigNumber}
      />
      {advanced ? (
        <TicksGroup
          className="new-ticks"
          currentPrice={warningPrice || currentPriceFromTicks}
          userTicks={userTicks}
          backgroundTicks={userTicksBase}
          setUserTicks={setUserTicks}
          userTickSelected={userTickSelected}
          setUserTickSelected={setUserTickSelected}
          plotX={plotXBigNumber}
          percentY={percentYBigNumber}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          canMoveX={canMoveX}
        />
      ) : (
        <TicksArea
          className="new-ticks-area"
          currentPrice={warningPrice || currentPriceFromTicks}
          oneSidedLiquidity={oneSidedLiquidity}
          ticks={userTicks.filter((tick): tick is Tick => !!tick)}
          plotX={plotXBigNumber}
          plotY={percentYBigNumber}
          containerHeight={containerSize.height}
          rangeMin={rangeMin}
          rangeMax={rangeMax}
          setRangeMin={setRangeMin}
          setRangeMax={setRangeMax}
          plotXinverse={plotXinverse}
          bucketRatio={bucketRatio}
        />
      )}
      <Axis
        className="x-axis"
        // todo: make better (x-axis roughly adds tick marks to buckets near the extents)
        //       to fix this here, for the x-axis to go from 0 to container width:
        //       the xMin and xMax could be determined from number of buckets and bucket width ratio
        //       to provide the extact extents for taking up the entire container
        //       with a reasonably stable center marker point (not always, a distribution could be skewed)
        xMin={xMin}
        xMax={xMax}
        axisWidth={containerSize.width - (rightPadding - leftPadding)}
        tickMarks={[
          currentPriceFromTicks?.toNumber() || '0',
          rangeMin,
          rangeMax,
        ]
          .map((v) => formatPrice(v))
          .map(Number)
          .filter((v): v is number => !!v && v > 0)}
        highlightedTick={Number(
          formatPrice(currentPriceFromTicks?.toNumber() || 0)
        )}
        getDecimalPlaces={null}
        plotX={plotX}
        plotY={plotY}
        percentY={percentY}
      />
    </svg>
  );

  const zoomIn = useCallback(() => {
    const rangeMinNumber = Number(rangeMin);
    const rangeMaxNumber = Number(rangeMax);
    const zoomMinNumber = Math.max(Number(zoomMin) || 0, graphStart.toNumber());
    const zoomMaxNumber = Math.min(
      Number(zoomMax) || Infinity,
      graphEnd.toNumber()
    );
    if (
      [rangeMinNumber, rangeMaxNumber, zoomMinNumber, zoomMaxNumber].every(
        (v) => !isNaN(v)
      )
    ) {
      const midpoint =
        Math.sqrt(rangeMaxNumber / rangeMinNumber) * rangeMinNumber;
      const zoomRatio = zoomMaxNumber / zoomMinNumber;
      const rangeLimitRatio = Math.sqrt(
        1 + (zoomRatio - 1) * (1 - zoomSpeedFactor)
      );
      const newZoomRatio = Math.max(maxZoomRatio, rangeLimitRatio);
      setZoomRange([
        (midpoint / newZoomRatio).toFixed(20),
        (midpoint * newZoomRatio).toFixed(20),
      ]);
      setRangeMin((rangeMin: string) => {
        return new BigNumber(rangeMin).isLessThan(midpoint / newZoomRatio)
          ? (midpoint / newZoomRatio).toFixed(20)
          : rangeMin;
      });
      setRangeMax((rangeMax: string) => {
        return new BigNumber(rangeMax).isGreaterThan(midpoint * newZoomRatio)
          ? (midpoint * newZoomRatio).toFixed(20)
          : rangeMax;
      });
    }
  }, [
    rangeMin,
    rangeMax,
    zoomMin,
    zoomMax,
    graphStart,
    graphEnd,
    setRangeMin,
    setRangeMax,
  ]);
  const zoomOut = useCallback(() => {
    const rangeMinNumber = Number(rangeMin);
    const rangeMaxNumber = Number(rangeMax);
    const zoomMinNumber = Math.max(Number(zoomMin) || 0, graphStart.toNumber());
    const zoomMaxNumber = Math.min(
      Number(zoomMax) || Infinity,
      graphEnd.toNumber()
    );
    if (
      [rangeMinNumber, rangeMaxNumber, zoomMinNumber, zoomMaxNumber].every(
        (v) => !isNaN(v)
      )
    ) {
      const midpoint =
        Math.sqrt(rangeMaxNumber / rangeMinNumber) * rangeMinNumber;
      const zoomRatio = zoomMaxNumber / zoomMinNumber;
      const rangeLimitRatio = Math.sqrt(
        1 + (zoomRatio - 1) / (1 - zoomSpeedFactor)
      );
      const newZoomRatio = Math.max(maxZoomRatio, rangeLimitRatio);
      setZoomRange([
        (midpoint / newZoomRatio).toFixed(20),
        (midpoint * newZoomRatio).toFixed(20),
      ]);
    }
  }, [rangeMin, rangeMax, zoomMin, zoomMax, graphStart, graphEnd]);

  return (
    <>
      <div className="svg-container" ref={svgContainer}>
        {svg}
      </div>
      {ControlsComponent && (
        <div className="col">
          <ControlsComponent
            zoomIn={zoomIn}
            zoomOut={
              zoomMin &&
              zoomMax &&
              allDataStart?.isGreaterThanOrEqualTo(zoomMin) &&
              allDataEnd?.isLessThanOrEqualTo(zoomMax)
                ? undefined
                : zoomOut
            }
          />
        </div>
      )}
    </>
  );
}

function fillBuckets(
  emptyBuckets: TickGroupBucketsEmpty,
  originalTicks: Tick[]
) {
  const ticks = originalTicks.filter(
    ({ reserveA, reserveB }) => !reserveA.isZero() || !reserveB.isZero()
  );
  return emptyBuckets.reduceRight<TickGroupBucketsFilled>(
    (result, [lowerBound, upperBound]) => {
      const [reserveA, reserveB] = ticks.reduceRight(
        (result, { price, reserveA, reserveB }, index, ticks) => {
          // match tokens unevenly (token0 "left-aligned" / token1 "right-aligned")
          // as we bucket ticks away from the central x-axis point
          const matchToken1 =
            price.isGreaterThanOrEqualTo(lowerBound) &&
            price.isLessThan(upperBound);
          const matchToken0 =
            price.isGreaterThan(lowerBound) &&
            price.isLessThanOrEqualTo(upperBound);
          const addToken0 =
            matchToken0 && !reserveA.isZero() ? reserveA : undefined;
          const addToken1 =
            matchToken1 && !reserveB.isZero() ? reserveB : undefined;
          // remove tick so it doesn't need to be iterated on again in next bucket
          if (matchToken0) {
            ticks.splice(index, 1);
          }
          const [sum0Value, sum1Value] = result;
          return [
            addToken0 ? sum0Value.plus(addToken0) : sum0Value,
            addToken1 ? sum1Value.plus(addToken1) : sum1Value,
          ];
        },
        [new BigNumber(0), new BigNumber(0)]
      );
      if (reserveA || reserveB) {
        result.push([lowerBound, upperBound, reserveA, reserveB]);
      }
      return result;
    },
    []
  );
}

function TicksBackgroundArea({
  rangeMin,
  rangeMax,
  plotX,
  plotY,
  className,
}: {
  rangeMin: string;
  rangeMax: string;
  plotX: (x: BigNumber) => number;
  plotY: (y: BigNumber) => number;
  className?: string;
}) {
  const startTickPrice = useMemo(() => new BigNumber(rangeMin), [rangeMin]);
  const endTickPrice = useMemo(() => new BigNumber(rangeMax), [rangeMax]);

  return startTickPrice && endTickPrice ? (
    <g
      className={['ticks-area__background', className]
        .filter(Boolean)
        .join(' ')}
    >
      <rect
        className="tick-area"
        // fill is defined on <svg><defs><linearGradient>
        fill="url(#white-concave-fade)"
        x={plotX(startTickPrice).toFixed(3)}
        width={
          endTickPrice.isGreaterThan(startTickPrice)
            ? (plotX(endTickPrice) - plotX(startTickPrice)).toFixed(3)
            : '0'
        }
        y={plotY(new BigNumber(1)).toFixed(3)}
        height={(plotY(new BigNumber(0)) - plotY(new BigNumber(1))).toFixed(3)}
      />
    </g>
  ) : null;
}

function TicksArea({
  currentPrice,
  oneSidedLiquidity,
  ticks,
  plotX,
  plotY,
  containerHeight,
  rangeMin,
  rangeMax,
  setRangeMin,
  setRangeMax,
  plotXinverse,
  bucketRatio,
  className,
}: {
  currentPrice: BigNumber | undefined;
  oneSidedLiquidity: boolean;
  ticks: TickGroup;
  plotX: (x: BigNumber) => number;
  plotY: (y: BigNumber) => number;
  containerHeight: number;
  rangeMin: string;
  rangeMax: string;
  setRangeMin: (rangeMin: string) => void;
  setRangeMax: (rangeMax: string) => void;
  plotXinverse: (x: number) => number;
  bucketRatio: number;
  className?: string;
}) {
  const startTick = ticks?.[0];
  const endTick = ticks?.[ticks.length - 1];
  const startTickPrice = useMemo(() => new BigNumber(rangeMin), [rangeMin]);
  const endTickPrice = useMemo(() => new BigNumber(rangeMax), [rangeMax]);

  const lastMinTickPrice = useRef<BigNumber>();
  const [startDragMin, isDraggingMin] = useOnDragMove(
    useCallback(
      (ev: Event, displacement = { x: 0, y: 0 }) => {
        const x = displacement.x;
        if (x && lastMinTickPrice.current) {
          const orderOfMagnitudePixels =
            plotX(new BigNumber(10)) - plotX(new BigNumber(1));
          const displacementRatio = Math.pow(
            10,
            displacement.x / orderOfMagnitudePixels
          );
          const newValue =
            lastMinTickPrice.current.multipliedBy(displacementRatio);
          const newValueString = formatPrice(newValue.toFixed());
          setRangeMin(newValueString);
          if (endTickPrice.isLessThanOrEqualTo(newValue)) {
            setRangeMax(newValueString);
          }
        }
      },
      [lastMinTickPrice, endTickPrice, plotX, setRangeMin, setRangeMax]
    )
  );
  useEffect(() => {
    if (!isDraggingMin) {
      lastMinTickPrice.current = startTickPrice;
    }
  }, [startTickPrice, isDraggingMin]);

  const lastMaxTickPrice = useRef<BigNumber>();
  const [startDragMax, isDraggingMax] = useOnDragMove(
    useCallback(
      (ev: Event, displacement = { x: 0, y: 0 }) => {
        const x = displacement.x;
        if (x && lastMaxTickPrice.current) {
          const orderOfMagnitudePixels =
            plotX(new BigNumber(10)) - plotX(new BigNumber(1));
          const displacementRatio = Math.pow(
            10,
            displacement.x / orderOfMagnitudePixels
          );
          const newValue =
            lastMaxTickPrice.current.multipliedBy(displacementRatio);
          const newValueString = formatPrice(newValue.toFixed());
          setRangeMax(newValueString);
          if (startTickPrice.isGreaterThanOrEqualTo(newValue)) {
            setRangeMin(newValueString);
          }
        }
      },
      [startTickPrice, plotX, setRangeMin, setRangeMax]
    )
  );
  useEffect(() => {
    if (!isDraggingMax) {
      lastMaxTickPrice.current = endTickPrice;
    }
  }, [endTickPrice, isDraggingMax]);

  const rounding = 5;
  const hasPriceWarning =
    currentPrice &&
    (({ price, reserveA, reserveB }: Tick) => {
      return (
        // if tick is tokenA: warn if price is higher than current price
        (!reserveA?.isZero() && price.isGreaterThan(currentPrice)) ||
        // if tick is tokenB: warn if price is lower than current price
        (!reserveB?.isZero() && price.isLessThan(currentPrice))
      );
    });
  const startTickHasPriceWarning = !!(
    startTick && hasPriceWarning?.(startTick)
  );
  const endTickHasPriceWarning = !!(endTick && hasPriceWarning?.(endTick));

  return startTickPrice && endTickPrice ? (
    <g className={['ticks-area', className].filter(Boolean).join(' ')}>
      <g
        className={['pole-a', startTickHasPriceWarning && 'pole--price-warning']
          .filter(Boolean)
          .join(' ')}
      >
        <line
          className="line pole-stick"
          x1={(plotX(startTickPrice) - poleWidth / 2).toFixed(3)}
          x2={(plotX(startTickPrice) - poleWidth / 2).toFixed(3)}
          y1={plotY(new BigNumber(0)).toFixed(3)}
          y2={plotY(new BigNumber(1)).toFixed(3)}
        />
        <rect
          className="pole-to-flag"
          x={(plotX(startTickPrice) - rounding).toFixed(3)}
          width={rounding}
          y={plotY(new BigNumber(1)).toFixed(3)}
          height="40"
        />
        <rect
          className="pole-flag"
          x={(plotX(startTickPrice) - 30 - poleWidth / 2).toFixed(3)}
          width="30"
          y={plotY(new BigNumber(1)).toFixed(3)}
          height="40"
          rx={rounding}
        />
        <line
          className="pole-flag-stripe"
          x1={(plotX(startTickPrice) - 11.5 - poleWidth / 2).toFixed(3)}
          x2={(plotX(startTickPrice) - 11.5 - poleWidth / 2).toFixed(3)}
          y1={(plotY(new BigNumber(1)) + 10).toFixed(3)}
          y2={(plotY(new BigNumber(1)) + 30).toFixed(3)}
        />
        <line
          className="pole-flag-stripe"
          x1={(plotX(startTickPrice) - 18.5 - poleWidth / 2).toFixed(3)}
          x2={(plotX(startTickPrice) - 18.5 - poleWidth / 2).toFixed(3)}
          y1={(plotY(new BigNumber(1)) + 10).toFixed(3)}
          y2={(plotY(new BigNumber(1)) + 30).toFixed(3)}
        />
        {currentPrice && (
          <text
            filter={`url(#text-solid-${
              startTickHasPriceWarning ? 'error' : 'highlight'
            })`}
            x={(4 + 1.8 + plotX(startTickPrice) - poleWidth / 2).toFixed(3)}
            y={5 - containerHeight}
            dy="12"
            textAnchor="end"
          >
            &nbsp;&nbsp;&nbsp;
            {`${formatAmount(
              startTickPrice
                .multipliedBy(100)
                .dividedBy(currentPrice)
                .minus(100)
                .toFixed(0),
              {
                signDisplay: 'always',
                useGrouping: true,
              }
            )}%`}
            &nbsp;&nbsp;&nbsp;
          </text>
        )}
        {isDraggingMin ? (
          <rect
            className="pole-flag--hit-area"
            x="0"
            width="100000"
            y="-100000"
            height="100000"
          />
        ) : (
          <rect
            className="pole-flag--hit-area"
            x={(plotX(startTickPrice) - 30).toFixed(3)}
            width="30"
            y={plotY(new BigNumber(1)).toFixed(3)}
            height="40"
            rx={rounding}
            onMouseDown={startDragMin}
          />
        )}
      </g>
      <g className="flag-line">
        <line
          className="line flag-joiner"
          x1={plotX(startTickPrice).toFixed(3)}
          x2={plotX(endTickPrice).toFixed(3)}
          y1={plotY(new BigNumber(0.7)).toFixed(3)}
          y2={plotY(new BigNumber(0.7)).toFixed(3)}
        />
        {currentPrice && (
          <line
            className={[
              'line flag-joiner flag-joiner--price-warning',
              !(oneSidedLiquidity
                ? startTickHasPriceWarning
                : startTickPrice.isGreaterThan(currentPrice)) && 'hide',
            ]
              .filter(Boolean)
              .join(' ')}
            x1={plotX(currentPrice).toFixed(3)}
            x2={plotX(startTickPrice).toFixed(3)}
            y1={plotY(new BigNumber(0.7)).toFixed(3)}
            y2={plotY(new BigNumber(0.7)).toFixed(3)}
          />
        )}
        {currentPrice && (
          <line
            className={[
              'line flag-joiner flag-joiner--price-warning',
              !(oneSidedLiquidity
                ? endTickHasPriceWarning
                : endTickPrice.isLessThan(currentPrice)) && 'hide',
            ]
              .filter(Boolean)
              .join(' ')}
            x1={plotX(endTickPrice).toFixed(3)}
            x2={plotX(currentPrice).toFixed(3)}
            y1={plotY(new BigNumber(0.7)).toFixed(3)}
            y2={plotY(new BigNumber(0.7)).toFixed(3)}
          />
        )}
      </g>
      <g
        className={['pole-b', endTickHasPriceWarning && 'pole--price-warning']
          .filter(Boolean)
          .join(' ')}
      >
        <line
          className="line pole-stick"
          x1={(plotX(endTickPrice) + poleWidth / 2).toFixed(3)}
          x2={(plotX(endTickPrice) + poleWidth / 2).toFixed(3)}
          y1={plotY(new BigNumber(0)).toFixed(3)}
          y2={plotY(new BigNumber(1)).toFixed(3)}
        />
        <rect
          className="pole-to-flag"
          x={plotX(endTickPrice).toFixed(3)}
          width={rounding}
          y={plotY(new BigNumber(1)).toFixed(3)}
          height="40"
        />
        <rect
          className="pole-flag"
          x={(plotX(endTickPrice) + poleWidth / 2).toFixed(3)}
          width="30"
          y={plotY(new BigNumber(1)).toFixed(3)}
          height="40"
          rx={rounding}
        />
        <line
          className="pole-flag-stripe"
          x1={(plotX(endTickPrice) + 11.5 + poleWidth / 2).toFixed(3)}
          x2={(plotX(endTickPrice) + 11.5 + poleWidth / 2).toFixed(3)}
          y1={(plotY(new BigNumber(1)) + 10).toFixed(3)}
          y2={(plotY(new BigNumber(1)) + 30).toFixed(3)}
        />
        <line
          className="pole-flag-stripe"
          x1={(plotX(endTickPrice) + 18.5 + poleWidth / 2).toFixed(3)}
          x2={(plotX(endTickPrice) + 18.5 + poleWidth / 2).toFixed(3)}
          y1={(plotY(new BigNumber(1)) + 10).toFixed(3)}
          y2={(plotY(new BigNumber(1)) + 30).toFixed(3)}
        />
        {currentPrice && (
          <text
            filter={`url(#text-solid-${
              endTickHasPriceWarning ? 'error' : 'highlight'
            })`}
            x={(-(4 + 1.8) + plotX(endTickPrice) + poleWidth / 2).toFixed(3)}
            y={5 - containerHeight}
            dy="12"
            textAnchor="start"
          >
            &nbsp;&nbsp;&nbsp;
            {`${formatAmount(
              endTickPrice
                .multipliedBy(100)
                .dividedBy(currentPrice)
                .minus(100)
                .toFixed(0),
              {
                signDisplay: 'always',
                useGrouping: true,
              }
            )}%`}
            &nbsp;&nbsp;&nbsp;
          </text>
        )}
        {isDraggingMax ? (
          <rect
            className="pole-flag--hit-area"
            x="0"
            width="100000"
            y="-100000"
            height="100000"
          />
        ) : (
          <rect
            className="pole-flag--hit-area"
            x={plotX(endTickPrice).toFixed(3)}
            width="30"
            y={plotY(new BigNumber(1)).toFixed(3)}
            height="40"
            rx={rounding}
            onMouseDown={startDragMax}
          />
        )}
      </g>
    </g>
  ) : null;
}

function TicksGroup({
  currentPrice,
  userTicks,
  backgroundTicks,
  setUserTicks,
  userTickSelected,
  setUserTickSelected,
  plotX,
  percentY,
  className,
  canMoveUp = false,
  canMoveDown = false,
  canMoveX = false,
  ...rest
}: {
  currentPrice: BigNumber | undefined;
  userTicks: Array<Tick | undefined>;
  backgroundTicks: Array<Tick | undefined>;
  setUserTicks?: (
    callback: (userTicks: TickGroup, meta?: { index?: number }) => TickGroup
  ) => void;
  userTickSelected: number;
  setUserTickSelected: (index: number) => void;
  plotX: (x: BigNumber) => number;
  percentY: (y: BigNumber) => number;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  canMoveX?: boolean;
  className?: string;
}) {
  // collect reserve height to calculate stats to use
  const tickNumbers = userTicks.flatMap((tick) =>
    [tick?.reserveA.toNumber(), tick?.reserveB.toNumber()].filter(
      (reserve): reserve is number => Boolean(reserve)
    )
  );
  const backgroundTickNumbers = backgroundTicks.flatMap((tick) =>
    [tick?.reserveA.toNumber(), tick?.reserveB.toNumber()].filter(
      (reserve): reserve is number => Boolean(reserve)
    )
  );

  // find max cumulative value of either the current ticks or background ticks
  const cumulativeTokenValues: number = Math.max(
    tickNumbers.reduce((acc, v) => acc + v, 0),
    backgroundTickNumbers.reduce((acc, v) => acc + v, 0)
  );

  const maxValue = Math.max(...tickNumbers, ...backgroundTickNumbers);
  const minMaxHeight = getMinYHeight(backgroundTickNumbers.length);

  // add a scaling factor if the maximum tick is very short (scale up to minMaxHeight)
  const scalingFactor =
    cumulativeTokenValues && maxValue / cumulativeTokenValues > minMaxHeight
      ? 0.925
      : (0.925 / (maxValue / cumulativeTokenValues)) * minMaxHeight;

  const lastSelectedTick = useRef<{ tick: Tick; index: number }>();

  const [startDragTick, isDragging] = useOnDragMove(
    useCallback(
      (ev: Event, displacement = { x: 0, y: 0 }) => {
        // exit if there is no tick
        const { index: userTickSelected, tick } =
          lastSelectedTick.current || {};
        if (!tick || userTickSelected === undefined || isNaN(userTickSelected))
          return;

        // move tick price
        if (canMoveX && Math.abs(displacement.x) > Math.abs(displacement.y)) {
          return setUserTicks?.((userTicks) => {
            const orderOfMagnitudePixels =
              plotX(new BigNumber(10)) - plotX(new BigNumber(1));
            const displacementRatio = Math.pow(
              10,
              displacement.x / orderOfMagnitudePixels
            );
            return userTicks?.map((userTick, index) => {
              // modify price
              if (userTickSelected === index) {
                const newPrice = tick.price.multipliedBy(displacementRatio);
                const roundedPrice = new BigNumber(
                  formatPrice(newPrice.toFixed())
                );
                return {
                  ...userTick,
                  price: roundedPrice,
                  tickIndex: priceToTickIndex(roundedPrice).toNumber(),
                };
              } else {
                return userTick;
              }
            });
          });
        }
        // move tick value
        else {
          return setUserTicks?.((userTicks, meta = {}) => {
            // append context for callers that read from this
            // note: this is a bit of a hack to keep setUserTicks(tick => ticks)-like compatibility
            meta.index = userTickSelected;
            // calculate position movement
            const linearPixels =
              percentY(new BigNumber(1)) - percentY(new BigNumber(0));
            // todo: attempt an algorithm that places the value at the approximate mouseover value
            // will require current max Y value to interpolate from
            const displacementPercent = displacement.y / linearPixels;
            const dragSpeedFactor = 5; //larger is faster
            const adjustedMovement = 1 + dragSpeedFactor * displacementPercent;
            return userTicks?.map((userTick, index) => {
              // modify price
              if (userTickSelected === index) {
                const originalAValue = backgroundTicks[index]?.reserveA;
                const originalBValue = backgroundTicks[index]?.reserveB;
                const newAValue = tick.reserveA.multipliedBy(adjustedMovement);
                const newBValue = tick.reserveB.multipliedBy(adjustedMovement);
                return {
                  ...userTick,
                  reserveA:
                    (!canMoveDown &&
                      originalAValue &&
                      newAValue.isLessThan(originalAValue)) ||
                    (!canMoveUp &&
                      originalAValue &&
                      newAValue.isGreaterThan(originalAValue))
                      ? originalAValue
                      : newAValue,
                  reserveB:
                    (!canMoveDown &&
                      originalBValue &&
                      newBValue.isLessThan(originalBValue)) ||
                    (!canMoveUp &&
                      originalBValue &&
                      newBValue.isGreaterThan(originalBValue))
                      ? originalBValue
                      : newBValue,
                };
              } else {
                return userTick;
              }
            });
          });
        }
      },
      [
        backgroundTicks,
        canMoveUp,
        canMoveDown,
        canMoveX,
        setUserTicks,
        plotX,
        percentY,
      ]
    )
  );

  const onTickSelected = useCallback(
    (e: MouseEvent) => {
      // set last tick synchronously
      const index = parseInt(
        (e.target as HTMLElement)?.getAttribute('data-key') || ''
      );
      const tick = userTicks?.[index];
      if (!isNaN(index) && tick) {
        setUserTickSelected(index);
        lastSelectedTick.current = {
          tick,
          index,
        };
      }

      startDragTick(e);
    },
    [userTicks, startDragTick, setUserTickSelected]
  );

  const tickPart = userTicks
    .filter(
      (tick): tick is Tick =>
        !!tick && !tick.reserveA.isNaN() && !tick.reserveB.isNaN()
    )
    .map<[Tick, number]>((tick, index) => [tick, index])
    // sort by top to bottom: select ticks then shortest -> tallest ticks
    .sort(([a, aIndex], [b, bIndex]) => {
      // sort any selected tick to the front
      // (so users can select it somehow else then drag it easily here)
      const aIsSelected = aIndex === userTickSelected;
      const bIsSelected = bIndex === userTickSelected;
      return (
        Number(aIsSelected) - Number(bIsSelected) ||
        // sort by height so that short ticks are above tall ticks
        b.reserveA.plus(b.reserveB).comparedTo(a.reserveA.plus(a.reserveB))
      );
    })
    .map(([tick, index]) => {
      const backgroundTick = backgroundTicks[index] || tick;
      const background = {
        price: backgroundTick.price,
        reserveA: backgroundTick.reserveA,
        reserveB: backgroundTick.reserveB,
      };
      const { price, reserveA, reserveB } = tick;
      // todo: display cumulative value of both side of ticks, not just one side
      const totalValue =
        (reserveA.isGreaterThan(0)
          ? cumulativeTokenValues &&
            reserveA
              .multipliedBy(scalingFactor)
              .dividedBy(cumulativeTokenValues)
          : cumulativeTokenValues &&
            reserveB
              .multipliedBy(scalingFactor)
              .dividedBy(cumulativeTokenValues)) || new BigNumber(0);
      const backgroundValue =
        (background.reserveA.isGreaterThan(0)
          ? cumulativeTokenValues &&
            background.reserveA
              .multipliedBy(scalingFactor)
              .dividedBy(cumulativeTokenValues)
          : cumulativeTokenValues &&
            background.reserveB
              .multipliedBy(scalingFactor)
              .dividedBy(cumulativeTokenValues)) || new BigNumber(0);

      const minValue = totalValue.isLessThan(backgroundValue)
        ? totalValue
        : backgroundValue;
      const maxValue = totalValue.isLessThan(backgroundValue)
        ? backgroundValue
        : totalValue;

      return (
        <g
          key={index}
          className={[
            'tick',
            totalValue.isZero() && 'tick--is-zero',
            userTickSelected === index && 'tick--selected',
            reserveA.isGreaterThan(0) ? 'token-a' : 'token-b',
            !totalValue.isEqualTo(backgroundValue) &&
              (totalValue.isLessThan(backgroundValue)
                ? 'tick--diff-negative'
                : 'tick--diff-positive'),
            // warn user if this seems to be a bad trade
            currentPrice &&
              (reserveA.isGreaterThan(0)
                ? price.isGreaterThan(currentPrice) && 'tick--price-warning'
                : price.isLessThan(currentPrice) && 'tick--price-warning'),
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <line
            {...rest}
            x1={plotX(price).toFixed(3)}
            x2={plotX(price).toFixed(3)}
            y1={percentY(new BigNumber(0)).toFixed(3)}
            y2={percentY(minValue).toFixed(3)}
            className="line"
          />
          {tick !== backgroundTick && (
            <line
              {...rest}
              x1={plotX(price).toFixed(3)}
              x2={plotX(price).toFixed(3)}
              y1={percentY(minValue).toFixed(3)}
              y2={percentY(maxValue).toFixed(3)}
              className="line line--diff"
            />
          )}
          <circle
            cx={plotX(price).toFixed(3)}
            cy={percentY(backgroundValue).toFixed(3)}
            r="5"
            className="tip"
          />
          {tick !== backgroundTick && (
            <circle
              cx={plotX(price).toFixed(3)}
              cy={percentY(totalValue).toFixed(3)}
              r="5"
              className="tip tip--diff"
            />
          )}
          <text
            x={plotX(price).toFixed(3)}
            y={(percentY(maxValue) - 28).toFixed(3)}
            dy="12"
            dominantBaseline="middle"
            textAnchor="middle"
          >
            {index + 1}
          </text>
          <rect
            className="tick--hit-area"
            data-key={index}
            {...(isDragging
              ? {
                  x: '0',
                  y: '-1000',
                  width: '10000',
                  height: '1000',
                }
              : {
                  x: (plotX(price) - 7.5).toFixed(3),
                  y: (percentY(maxValue) - 25).toFixed(3),
                  rx: 7.5,
                  width: 15,
                  height: (
                    percentY(minValue) -
                    percentY(maxValue) +
                    35
                  ).toFixed(3),
                })}
            onMouseDown={onTickSelected}
          />
        </g>
      );
    });

  return (
    <g
      className={['ticks', isDragging && 'ticks--is-dragging', className]
        .filter(Boolean)
        .join(' ')}
    >
      {tickPart}
    </g>
  );
}

function TickBucketsGroup({
  tickBuckets,
  plotX,
  plotY,
  className,
  ...rest
}: {
  tickBuckets: TickGroupBucketsFilled;
  plotX: (x: BigNumber) => number;
  plotY: (y: BigNumber) => number;
  className?: string;
}) {
  return (
    <g className={['tick-buckets', className].filter(Boolean).join(' ')}>
      {tickBuckets.flatMap(
        ([lowerBound, upperBound, tokenAValue, tokenBValue], index) =>
          [
            tokenAValue?.isGreaterThan(0) && (
              <rect
                key={`${index}-0`}
                className="tick-bucket token-a"
                {...rest}
                x={plotX(lowerBound).toFixed(3)}
                width={(plotX(upperBound) - plotX(lowerBound)).toFixed(3)}
                y={plotY(tokenAValue).toFixed(3)}
                height={(plotY(new BigNumber(0)) - plotY(tokenAValue)).toFixed(
                  3
                )}
              />
            ),
            tokenBValue?.isGreaterThan(0) && (
              <rect
                key={`${index}-1`}
                className="tick-bucket token-b"
                {...rest}
                x={plotX(lowerBound).toFixed(3)}
                width={(plotX(upperBound) - plotX(lowerBound)).toFixed(3)}
                y={plotY(tokenAValue.plus(tokenBValue)).toFixed(3)}
                height={(plotY(new BigNumber(0)) - plotY(tokenBValue)).toFixed(
                  3
                )}
              />
            ),
          ].filter(Boolean)
      )}
    </g>
  );
}

function Axis({
  className = '',
  xMin,
  xMax,
  axisWidth,
  tickMarks: givenTickMarks,
  highlightedTick = -1,
  getDecimalPlaces = (tickMark) =>
    Math.max(0, -Math.floor(Math.log10(tickMark))),
  plotX,
  plotY,
  percentY,
}: {
  xMin: number;
  xMax: number;
  axisWidth?: number;
  className?: string;
  tickMarks?: number[];
  highlightedTick?: number;
  getDecimalPlaces?: ((value: number) => number) | null;
  plotX: (x: number) => number;
  plotY: (y: number) => number;
  percentY: (y: number) => number;
}) {
  if (!xMin || !xMax || xMin === xMax) return null;

  const start = Math.pow(10, Math.floor(Math.log10(xMin)));
  const tickMarks =
    givenTickMarks ||
    Array.from({ length: Math.log10(xMax / xMin) + 2 }).flatMap((_, index) => {
      const baseNumber = start * Math.pow(10, index);
      const possibleMultiples = [2, 5, 10];
      const possibleInclusions = possibleMultiples.map((v) => v * baseNumber);
      return possibleInclusions
        .map((possibleInclusion) => {
          if (possibleInclusion >= xMin && possibleInclusion <= xMax) {
            return possibleInclusion;
          }
          return 0;
        })
        .filter(Boolean);
    });

  return (
    <g className={['axis', className].filter(Boolean).join(' ')}>
      <rect
        x="0"
        width={axisWidth || plotX(xMax)}
        y={plotY(0).toFixed(0)}
        height="8"
      />
      <g className="axis-ticks">{tickMarks.map(mapTickMark)}</g>
    </g>
  );

  function mapTickMark(tickMark: number, index: number) {
    const decimalPlaces = getDecimalPlaces?.(tickMark);
    return (
      <g key={index} className="axis-tick">
        {tickMark === highlightedTick && (
          <line
            className="line--success"
            x1={plotX(tickMark).toFixed(3)}
            x2={plotX(tickMark).toFixed(3)}
            y1={plotY(0) + 8}
            y2={percentY(1)}
          />
        )}
        <text
          filter="url(#text-solid-background)"
          className={tickMark === highlightedTick ? 'text--success' : ''}
          x={(
            plotX(tickMark) +
            (highlightedTick && index > 0 ? (index === 1 ? 1.5 : -1.5) : 0)
          ).toFixed(3)}
          y={plotY(0) + 4 + 8}
          dominantBaseline="middle"
          textAnchor={
            highlightedTick && index > 0
              ? index === 1
                ? 'end'
                : 'start'
              : 'middle'
          }
          alignmentBaseline="text-before-edge"
        >
          &nbsp;
          {decimalPlaces !== undefined
            ? tickMark.toFixed(decimalPlaces)
            : tickMark}
          &nbsp;
        </text>
      </g>
    );
  }
}

function getMinYHeight(tickCount: number): number {
  return 1 / ((tickCount - 2) / 6 + 2) + 0.4;
}
