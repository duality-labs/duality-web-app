import {
  useState,
  useMemo,
  useCallback,
  useLayoutEffect,
  MouseEvent,
  useRef,
} from 'react';
import { TickMap, TickInfo } from '../../lib/web3/indexerProvider';
import useCurrentPriceFromTicks from './useCurrentPriceFromTicks';
import useOnDragMove from '../hooks/useOnDragMove';

import './LiquiditySelector.scss';
import BigNumber from 'bignumber.js';

export interface LiquiditySelectorProps {
  ticks: TickMap | undefined;
  feeTier: number | undefined;
  tickSelected: number | undefined;
  setTickSelected: (index: number) => void;
  setRangeMin: (rangeMin: string) => void;
  setRangeMax: (rangeMax: string) => void;
  userTicksBase?: Array<Tick | undefined>;
  userTicks?: Array<Tick | undefined>;
  setUserTicks?: (callback: (userTicks: TickGroup) => TickGroup) => void;
  advanced?: boolean;
  formatPrice?: (value: BigNumber) => string;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  canMoveX?: boolean;
}

export type Tick = [
  price: BigNumber,
  token0Value: BigNumber,
  token1Value: BigNumber
];
export type TickGroup = Array<Tick>;
type TickGroupBucketsEmpty = Array<
  [lowerBound: BigNumber, upperBound: BigNumber]
>;
type TickGroupBucketsFilled = Array<
  [
    lowerBound: BigNumber,
    upperBound: BigNumber,
    token0Value: BigNumber,
    token1Value: BigNumber
  ]
>;

function defaultFormatPrice(value: BigNumber): string {
  return value.toFixed(
    Math.max(0, value.dp() - value.sd(true) + 3),
    BigNumber.ROUND_HALF_UP
  );
}

const bucketWidth = 50; // bucket width in pixels

function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);

  useLayoutEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return width;
}

export default function LiquiditySelector({
  ticks = {},
  feeTier = -1,
  tickSelected = -1,
  setTickSelected,
  setRangeMin,
  setRangeMax,
  userTicks = [],
  userTicksBase = userTicks,
  setUserTicks,
  advanced = false,
  formatPrice = defaultFormatPrice,
  canMoveUp,
  canMoveDown,
  canMoveX,
}: LiquiditySelectorProps) {
  // collect tick information in a more useable form
  const feeTicks: TickGroup = useMemo(() => {
    return Object.values(ticks)
      .map((poolTicks) => poolTicks[0] || poolTicks[1]) // read tick if it exists on either pool queue side
      .filter((tick): tick is TickInfo => tick?.fee.isEqualTo(feeTier) === true) // filter to only fee ticks
      .map((tick) => [tick.price, tick.reserve0, tick.reserve1]);
  }, [ticks, feeTier]);

  // todo: base graph start and end on existing ticks and current price
  //       (if no existing ticks exist only cuurent price can indicate start and end)

  const currentPriceABFromTicks = useCurrentPriceFromTicks(
    ticks,
    useCallback(
      (tick: TickInfo | undefined) => {
        return tick?.fee.isEqualTo(feeTier) === true;
      },
      [feeTier]
    )
  );

  const invertTokenOrder = currentPriceABFromTicks?.isLessThan(1) || false;
  const currentPriceFromTicks = useMemo(() => {
    const one = new BigNumber(1);
    return currentPriceABFromTicks
      ? invertTokenOrder
        ? one.dividedBy(currentPriceABFromTicks)
        : currentPriceABFromTicks
      : one;
  }, [currentPriceABFromTicks, invertTokenOrder]);
  const initialGraphStart = useMemo(() => {
    const graphStart = currentPriceFromTicks.dividedBy(4);
    return graphStart.isLessThan(1 / 1.1) ? new BigNumber(1 / 1.1) : graphStart;
  }, [currentPriceFromTicks]);
  const initialGraphEnd = useMemo(() => {
    const graphEnd = currentPriceFromTicks.multipliedBy(4);
    return graphEnd.isLessThan(1.1) ? new BigNumber(1.1) : graphEnd;
  }, [currentPriceFromTicks]);

  const [dataStart, dataEnd] = useMemo(() => {
    const { xMin = new BigNumber(1 / 1.1), xMax = new BigNumber(1.1) } =
      feeTicks.reduce<{
        [key: string]: BigNumber;
      }>((result, [price]) => {
        if (result.xMin === undefined || price.isLessThan(result.xMin))
          result.xMin = price;
        if (result.xMax === undefined || price.isGreaterThan(result.xMax))
          result.xMax = price;
        return result;
      }, {});
    return [xMin, xMax];
  }, [feeTicks]);

  // set and allow ephemeral setting of graph extents
  const [graphStart, setGraphStart] = useState(initialGraphStart);
  const [graphEnd, setGraphEnd] = useState(initialGraphEnd);

  // find container size that buckets should fit
  const [container, setContainer] = useState<SVGSVGElement | null>(null);
  const windowWidth = useWindowWidth();
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    setContainerSize({
      width: container?.clientWidth ?? 0,
      height: container?.clientHeight ?? 0,
    });
  }, [container, windowWidth]);

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
    // get bounds
    const xMin = dataStart.sd(2, BigNumber.ROUND_DOWN).toNumber();
    const xMax = dataEnd.sd(2, BigNumber.ROUND_UP).toNumber();
    const tokenABuckets = Array.from({ length: bucketCount }).reduce<
      [min: BigNumber, max: BigNumber][]
    >((result) => {
      const newValue = result[0]?.[0] ?? currentPriceFromTicks;
      return newValue.isLessThan(xMin)
        ? // return finished array
          result
        : // prepend new bucket
          [[newValue.dividedBy(bucketRatio), newValue], ...result];
    }, []);
    const tokenBBuckets = Array.from({ length: bucketCount }).reduce<
      [min: BigNumber, max: BigNumber][]
    >((result) => {
      const newValue = result[result.length - 1]?.[1] ?? currentPriceFromTicks;
      return newValue.isGreaterThan(xMax)
        ? // return finished array
          result
        : // append new bucket
          [...result, [newValue, newValue.multipliedBy(bucketRatio)]];
    }, []);

    // return concantenated buckes
    return [tokenABuckets, tokenBBuckets];
  }, [currentPriceFromTicks, bucketRatio, bucketCount, dataStart, dataEnd]);

  // allow user ticks to reset the boundary of the graph
  useLayoutEffect(() => {
    const minUserTickPrice = userTicks.reduce<BigNumber | undefined>(
      (result, tick) => {
        if (!tick) return result;
        const [price] = tick;
        return !result || price.isLessThan(result) ? price : result;
      },
      undefined
    );
    const maxUserTickPrice = userTicks.reduce<BigNumber | undefined>(
      (result, tick) => {
        if (!tick) return result;
        const [price] = tick;
        return !result || price.isGreaterThan(result) ? price : result;
      },
      undefined
    );
    // todo: ensure buckets (of maximum bucketWidth) can fit onto the graph extents
    // by padding dataStart and dataEnd with the needed amount of pixels
    const minExistingTickPrice = dataStart;
    const maxExistingTickPrice = dataEnd;
    const minTickPrice = minUserTickPrice?.isLessThan(minExistingTickPrice)
      ? minUserTickPrice
      : minExistingTickPrice;
    const maxTickPrice = maxUserTickPrice?.isGreaterThan(maxExistingTickPrice)
      ? maxUserTickPrice
      : maxExistingTickPrice;
    if (minTickPrice)
      setGraphStart(
        minTickPrice.isLessThan(initialGraphStart)
          ? minTickPrice
          : initialGraphStart
      );
    if (maxTickPrice)
      setGraphEnd(
        maxTickPrice.isGreaterThan(initialGraphEnd)
          ? maxTickPrice
          : initialGraphEnd
      );
  }, [initialGraphStart, initialGraphEnd, dataStart, dataEnd, userTicks]);

  // calculate histogram values
  const feeTickBuckets = useMemo<
    [TickGroupBucketsFilled, TickGroupBucketsFilled]
  >(() => {
    const remainingTicks = feeTicks.slice();
    function fillBuckets(emptyBuckets: TickGroupBucketsEmpty) {
      return emptyBuckets.reduce<TickGroupBucketsFilled>(
        (result, [lowerBound, upperBound]) => {
          const [token0Value, token1Value] = remainingTicks.reduceRight(
            (result, [price, token0Value, token1Value]) => {
              if (
                price.isGreaterThanOrEqualTo(lowerBound) &&
                price.isLessThanOrEqualTo(upperBound)
              ) {
                // TODO: remove safely used ticks from set to minimise reduce time
                return [
                  result[0].plus(token0Value),
                  result[1].plus(token1Value),
                ];
              }
              return result;
            },
            [new BigNumber(0), new BigNumber(0)]
          );
          if (token0Value || token1Value) {
            result.push([lowerBound, upperBound, token0Value, token1Value]);
          }
          return result;
        },
        []
      );
    }
    return [fillBuckets(emptyBuckets[0]), fillBuckets(emptyBuckets[1])];
  }, [emptyBuckets, feeTicks]);

  const graphHeight = useMemo(() => {
    return feeTickBuckets
      .flat()
      .reduce((result, [lowerBound, upperBound, token0Value, token1Value]) => {
        return Math.max(result, token0Value.toNumber(), token1Value.toNumber());
      }, 0);
  }, [feeTickBuckets]);

  // plot values as percentages on a 100 height viewbox (viewBox="0 -100 100 100")
  const xMin = graphStart.sd(2, BigNumber.ROUND_DOWN).toNumber();
  const xMax = graphEnd.sd(2, BigNumber.ROUND_UP).toNumber();
  const plotX = useCallback(
    (x: number): number => {
      const leftPadding = containerSize.width * 0.1;
      const rightPadding = containerSize.width * 0.1;
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
      const leftPadding = containerSize.width * 0.1;
      const rightPadding = containerSize.width * 0.1;
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
      const topPadding = containerSize.height * 0.05;
      const bottomPadding = containerSize.height * 0.05;
      const height = containerSize.height - topPadding - bottomPadding;
      return graphHeight === 0
        ? -bottomPadding // pin to bottom
        : -bottomPadding - (height * y) / graphHeight;
    },
    [graphHeight, containerSize.height]
  );
  const percentY = useCallback(
    (y: number): number => {
      const topPadding = containerSize.height * 0.02;
      const bottomPadding = containerSize.height * 0.05;
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

  return (
    <svg
      className="chart-liquidity"
      viewBox={`0 -${containerSize.height} ${containerSize.width} ${
        containerSize.height + 5
      }`}
      ref={setContainer}
    >
      <defs>
        <linearGradient id="white-concave-fade">
          <stop offset="0%" stopColor="white" stopOpacity="0.6" />
          <stop offset="20%" stopColor="white" stopOpacity="0.5" />
          <stop offset="46%" stopColor="white" stopOpacity="0.4" />
          <stop offset="54%" stopColor="white" stopOpacity="0.4" />
          <stop offset="80%" stopColor="white" stopOpacity="0.5" />
          <stop offset="100%" stopColor="white" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {graphEnd.isZero() && <text>Chart is not currently available</text>}
      {!advanced && (
        <TicksBackgroundArea
          className="new-ticks-area"
          ticks={userTicks.filter((tick): tick is Tick => !!tick)}
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
          currentPrice={currentPriceFromTicks}
          ticks={userTicks}
          backgroundTicks={userTicksBase}
          setUserTicks={setUserTicks}
          tickSelected={tickSelected}
          setTickSelected={setTickSelected}
          plotX={plotXBigNumber}
          plotY={percentYBigNumber}
          formatPrice={formatPrice}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          canMoveX={canMoveX}
        />
      ) : (
        <TicksArea
          className="new-ticks-area"
          ticks={userTicks.filter((tick): tick is Tick => !!tick)}
          plotX={plotXBigNumber}
          plotY={percentYBigNumber}
          setRangeMin={setRangeMin}
          setRangeMax={setRangeMax}
          plotXinverse={plotXinverse}
          bucketRatio={bucketRatio}
          formatPrice={formatPrice}
        />
      )}
      <Axis
        className="x-axis"
        // todo: make better (x-axis roughly adds tick marks to buckets near the extents)
        xMin={xMin / 1.2}
        xMax={xMax * 1.2}
        plotX={plotX}
        plotY={plotY}
      />
    </svg>
  );
}

function TicksBackgroundArea({
  ticks,
  plotX,
  plotY,
  className,
}: {
  ticks: TickGroup;
  plotX: (x: BigNumber) => number;
  plotY: (y: BigNumber) => number;
  className?: string;
}) {
  const startTickPrice = ticks?.[0]?.[0];
  const endTickPrice = ticks?.[ticks.length - 1]?.[0];

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
  ticks,
  plotX,
  plotY,
  setRangeMin,
  setRangeMax,
  plotXinverse,
  bucketRatio,
  formatPrice,
  className,
}: {
  ticks: TickGroup;
  plotX: (x: BigNumber) => number;
  plotY: (y: BigNumber) => number;
  setRangeMin: (rangeMin: string) => void;
  setRangeMax: (rangeMax: string) => void;
  plotXinverse: (x: number) => number;
  bucketRatio: number;
  formatPrice: (value: BigNumber) => string;
  className?: string;
}) {
  const startTickPrice = ticks?.[0]?.[0];
  const endTickPrice = ticks?.[ticks.length - 1]?.[0];
  const bucketWidth =
    plotX(new BigNumber(bucketRatio)) - plotX(new BigNumber(1));

  const [startDragMin, isDraggingMin] = useOnDragMove(
    useCallback(
      (ev: MouseEventInit) => {
        const x = ev.movementX;
        if (x) {
          const xStart = plotX(startTickPrice);
          const newValue = new BigNumber(plotXinverse(xStart + x));
          const newValueString = formatPrice(newValue);
          setRangeMin(newValueString);
          if (endTickPrice.isLessThanOrEqualTo(newValue)) {
            setRangeMax(newValueString);
          }
        }
      },
      [
        startTickPrice,
        endTickPrice,
        plotXinverse,
        plotX,
        setRangeMin,
        setRangeMax,
        formatPrice,
      ]
    )
  );

  const [startDragMax, isDraggingMax] = useOnDragMove(
    useCallback(
      (ev: MouseEventInit) => {
        const x = ev.movementX;
        if (x) {
          const xStart = plotX(endTickPrice);
          const newValue = new BigNumber(plotXinverse(xStart + x));
          const newValueString = formatPrice(newValue);
          setRangeMax(newValueString);
          if (startTickPrice.isGreaterThanOrEqualTo(newValue)) {
            setRangeMin(newValueString);
          }
        }
      },
      [
        startTickPrice,
        endTickPrice,
        plotXinverse,
        plotX,
        setRangeMin,
        setRangeMax,
        formatPrice,
      ]
    )
  );

  const rounding = 5;

  return startTickPrice && endTickPrice ? (
    <g className={['ticks-area', className].filter(Boolean).join(' ')}>
      <g className="pole-a">
        <line
          className="line pole-stick"
          x1={plotX(startTickPrice).toFixed(3)}
          x2={plotX(startTickPrice).toFixed(3)}
          y1={plotY(new BigNumber(0)).toFixed(3)}
          y2={plotY(new BigNumber(1)).toFixed(3)}
        />
        <rect
          className="pole-to-flag"
          x={(plotX(startTickPrice) - rounding).toFixed(3)}
          width={rounding}
          y={plotY(new BigNumber(1)).toFixed(3)}
          height={-(plotY(new BigNumber(0)) * 2).toFixed(3)}
        />
        <rect
          className="pole-flag"
          x={(plotX(startTickPrice) - 0.75 * bucketWidth).toFixed(3)}
          width={(0.75 * bucketWidth).toFixed(3)}
          y={plotY(new BigNumber(1)).toFixed(3)}
          height={-(plotY(new BigNumber(0)) * 2).toFixed(3)}
          rx={rounding}
        />
        <line
          className="pole-flag-stripe"
          x1={(plotX(startTickPrice) - 0.45 * bucketWidth).toFixed(3)}
          x2={(plotX(startTickPrice) - 0.45 * bucketWidth).toFixed(3)}
          y1={plotY(new BigNumber(0.97)).toFixed(3)}
          y2={plotY(new BigNumber(0.92)).toFixed(3)}
        />
        <line
          className="pole-flag-stripe"
          x1={(plotX(startTickPrice) - 0.25 * bucketWidth).toFixed(3)}
          x2={(plotX(startTickPrice) - 0.25 * bucketWidth).toFixed(3)}
          y1={plotY(new BigNumber(0.97)).toFixed(3)}
          y2={plotY(new BigNumber(0.92)).toFixed(3)}
        />
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
            x={(plotX(startTickPrice) - 0.75 * bucketWidth).toFixed(3)}
            width={(0.75 * bucketWidth).toFixed(3)}
            y={plotY(new BigNumber(1)).toFixed(3)}
            height={-(plotY(new BigNumber(0)) * 2).toFixed(3)}
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
      </g>
      <g className="pole-b">
        <line
          className="line pole-stick"
          x1={plotX(endTickPrice).toFixed(3)}
          x2={plotX(endTickPrice).toFixed(3)}
          y1={plotY(new BigNumber(0)).toFixed(3)}
          y2={plotY(new BigNumber(1)).toFixed(3)}
        />
        <rect
          className="pole-to-flag"
          x={plotX(endTickPrice).toFixed(3)}
          width={rounding}
          y={plotY(new BigNumber(1)).toFixed(3)}
          height={-(plotY(new BigNumber(0)) * 2).toFixed(3)}
        />
        <rect
          className="pole-flag"
          x={plotX(endTickPrice).toFixed(3)}
          width={(0.75 * bucketWidth).toFixed(3)}
          y={plotY(new BigNumber(1)).toFixed(3)}
          height={-(plotY(new BigNumber(0)) * 2).toFixed(3)}
          rx={rounding}
        />
        <line
          className="pole-flag-stripe"
          x1={(plotX(endTickPrice) + 0.45 * bucketWidth).toFixed(3)}
          x2={(plotX(endTickPrice) + 0.45 * bucketWidth).toFixed(3)}
          y1={plotY(new BigNumber(0.97)).toFixed(3)}
          y2={plotY(new BigNumber(0.92)).toFixed(3)}
        />
        <line
          className="pole-flag-stripe"
          x1={(plotX(endTickPrice) + 0.25 * bucketWidth).toFixed(3)}
          x2={(plotX(endTickPrice) + 0.25 * bucketWidth).toFixed(3)}
          y1={plotY(new BigNumber(0.97)).toFixed(3)}
          y2={plotY(new BigNumber(0.92)).toFixed(3)}
        />
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
            width={(0.75 * bucketWidth).toFixed(3)}
            y={plotY(new BigNumber(1)).toFixed(3)}
            height={-(plotY(new BigNumber(0)) * 2).toFixed(3)}
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
  ticks,
  backgroundTicks,
  setUserTicks,
  tickSelected,
  setTickSelected,
  plotX,
  plotY,
  formatPrice,
  className,
  canMoveUp = false,
  canMoveDown = false,
  canMoveX = false,
  ...rest
}: {
  currentPrice: BigNumber;
  ticks: Array<Tick | undefined>;
  backgroundTicks: Array<Tick | undefined>;
  setUserTicks?: (
    callback: (userTicks: TickGroup, meta?: { index?: number }) => TickGroup
  ) => void;
  tickSelected: number;
  setTickSelected: (index: number) => void;
  plotX: (x: BigNumber) => number;
  plotY: (y: BigNumber) => number;
  formatPrice: (value: BigNumber) => string;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  canMoveX?: boolean;
  className?: string;
}) {
  // save Tick sum reducer to pick token values by index
  const mapNumberByIndex = (tokenIndex: number) => {
    return (token: Tick | undefined) => {
      return token ? token[tokenIndex].toNumber() || [] : [];
    };
  };
  const tick0Numbers = ticks.flatMap(mapNumberByIndex(1));
  const tick1Numbers = ticks.flatMap(mapNumberByIndex(2));
  const backgroundTick0Numbers = backgroundTicks.flatMap(mapNumberByIndex(1));
  const backgroundTick1Numbers = backgroundTicks.flatMap(mapNumberByIndex(2));

  // find max cumulative value of either the current ticks or background ticks
  const cumulativeToken0Values: number = Math.max(
    tick0Numbers.reduce((acc, v) => acc + v, 0),
    backgroundTick0Numbers.reduce((acc, v) => acc + v, 0)
  );
  const cumulativeToken1Values: number = Math.max(
    tick1Numbers.reduce((acc, v) => acc + v, 0),
    backgroundTick1Numbers.reduce((acc, v) => acc + v, 0)
  );

  const max0Value = Math.max(...tick0Numbers, ...backgroundTick0Numbers);
  const max1Value = Math.max(...tick1Numbers, ...backgroundTick1Numbers);
  const minMaxHeight0 = getMinYHeight(backgroundTick0Numbers.length);
  const minMaxHeight1 = getMinYHeight(backgroundTick1Numbers.length);

  // add a scaling factor if the maximum tick is very short (scale up to minMaxHeight)
  const scalingFactor0 =
    cumulativeToken0Values && max0Value / cumulativeToken0Values > minMaxHeight0
      ? 0.925
      : (1 / (max0Value / cumulativeToken0Values)) * minMaxHeight0;
  const scalingFactor1 =
    cumulativeToken1Values && max1Value / cumulativeToken1Values > minMaxHeight1
      ? 0.925
      : (1 / (max1Value / cumulativeToken1Values)) * minMaxHeight1;

  const lastSelectedTick = useRef<{ tick: Tick; index: number }>();

  const [startDragTick, isDragging] = useOnDragMove(
    useCallback(
      (ev: Event, displacement = { x: 0, y: 0 }) => {
        // exit if there is no tick
        const { index: tickSelected, tick } = lastSelectedTick.current || {};
        if (!tick || tickSelected === undefined || isNaN(tickSelected)) return;

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
              if (tickSelected === index) {
                const newPrice = tick[0].multipliedBy(displacementRatio);
                return [new BigNumber(formatPrice(newPrice)), tick[1], tick[2]];
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
            meta.index = tickSelected;
            // calculate position movement
            const linearPixels =
              plotY(new BigNumber(1)) - plotY(new BigNumber(0));
            // todo: attempt an algorithm that places the value at the approximate mouseover value
            // will require current max Y value to interpolate from
            const displacementPercent = displacement.y / linearPixels;
            const dragSpeedFactor = 5; //larger is faster
            const adjustedMovement = 1 + dragSpeedFactor * displacementPercent;
            return userTicks?.map((userTick, index) => {
              // modify price
              if (tickSelected === index) {
                const original0Value = backgroundTicks[index]?.[1];
                const original1Value = backgroundTicks[index]?.[2];
                const new0Value = tick[1].multipliedBy(adjustedMovement);
                const new1Value = tick[2].multipliedBy(adjustedMovement);
                return [
                  tick[0],
                  (!canMoveDown &&
                    original0Value &&
                    new0Value.isLessThan(original0Value)) ||
                  (!canMoveUp &&
                    original0Value &&
                    new0Value.isGreaterThan(original0Value))
                    ? original0Value
                    : new0Value,
                  (!canMoveDown &&
                    original1Value &&
                    new1Value.isLessThan(original1Value)) ||
                  (!canMoveUp &&
                    original1Value &&
                    new1Value.isGreaterThan(original1Value))
                    ? original1Value
                    : new1Value,
                ];
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
        plotY,
        formatPrice,
      ]
    )
  );

  const onTickSelected = useCallback(
    (e: MouseEvent) => {
      // set last tick synchronously
      const index = parseInt(
        (e.target as HTMLElement)?.getAttribute('data-key') || ''
      );
      const tick = ticks?.[index];
      if (!isNaN(index) && tick) {
        setTickSelected(index);
        lastSelectedTick.current = {
          tick,
          index,
        };
      }

      startDragTick(e);
    },
    [ticks, startDragTick, setTickSelected]
  );

  // todo: sort ticks so that the selected tick always appears last (on top)
  //       for easier user selection when many ticks are present
  const tickPart = ticks.map((tick, index) => {
    if (tick) {
      const backgroundTick = backgroundTicks[index] || tick;
      const background = {
        price: backgroundTick[0],
        token0Value: backgroundTick[1],
        token1Value: backgroundTick[2],
      };
      const [price, token0Value, token1Value] = tick;
      const scalingFactor = background.token0Value.isGreaterThan(0)
        ? scalingFactor0
        : scalingFactor1;
      // todo: display cumulative value of both side of ticks, not just one side
      const totalValue =
        (token0Value.isGreaterThan(0)
          ? cumulativeToken0Values &&
            token0Value
              .multipliedBy(scalingFactor)
              .dividedBy(cumulativeToken0Values)
          : cumulativeToken1Values &&
            token1Value
              .multipliedBy(scalingFactor)
              .dividedBy(cumulativeToken1Values)) || new BigNumber(0);
      const backgroundValue =
        (background.token0Value.isGreaterThan(0)
          ? cumulativeToken0Values &&
            background.token0Value
              .multipliedBy(scalingFactor)
              .dividedBy(cumulativeToken0Values)
          : cumulativeToken1Values &&
            background.token1Value
              .multipliedBy(scalingFactor)
              .dividedBy(cumulativeToken1Values)) || new BigNumber(0);

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
            tickSelected === index && 'tick--selected',
            token0Value.isGreaterThan(0) ? 'token-a' : 'token-b',
            !totalValue.isEqualTo(backgroundValue) &&
              (totalValue.isLessThan(backgroundValue)
                ? 'tick--diff-negative'
                : 'tick--diff-positive'),
            // warn user if this seems to be a bad trade
            token0Value.isGreaterThan(0)
              ? price.isGreaterThan(currentPrice) && 'tick--price-warning'
              : price.isLessThan(currentPrice) && 'tick--price-warning',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <line
            {...rest}
            x1={plotX(price).toFixed(3)}
            x2={plotX(price).toFixed(3)}
            y1={plotY(new BigNumber(0)).toFixed(3)}
            y2={plotY(minValue).toFixed(3)}
            className="line"
          />
          {tick !== backgroundTick && (
            <line
              {...rest}
              x1={plotX(price).toFixed(3)}
              x2={plotX(price).toFixed(3)}
              y1={plotY(minValue).toFixed(3)}
              y2={plotY(maxValue).toFixed(3)}
              className="line line--diff"
            />
          )}
          <circle
            cx={plotX(price).toFixed(3)}
            cy={plotY(backgroundValue).toFixed(3)}
            r="5"
            className="tip"
          />
          {tick !== backgroundTick && (
            <circle
              cx={plotX(price).toFixed(3)}
              cy={plotY(totalValue).toFixed(3)}
              r="5"
              className="tip tip--diff"
            />
          )}
          <text
            x={plotX(price).toFixed(3)}
            y={(plotY(maxValue) - 28).toFixed(3)}
            dy="12"
            dominantBaseline="middle"
            textAnchor="middle"
          >
            {index + 1}
          </text>
          <ellipse
            className="tick--hit-area"
            data-key={index}
            cx={plotX(price).toFixed(3)}
            cy={(plotY(totalValue) - 9).toFixed(3)}
            rx={isDragging ? '1000' : '12.5'}
            ry={isDragging ? '1000' : '22.5'}
            onMouseDown={onTickSelected}
          />
        </g>
      );
    } else {
      return null;
    }
  });

  return (
    <g className={['ticks', className].filter(Boolean).join(' ')}>{tickPart}</g>
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
        ([lowerBound, upperBound, token0Value, token1Value], index) =>
          [
            token0Value?.isGreaterThan(0) && (
              <rect
                key={`${index}-0`}
                className="tick-bucket token-a"
                {...rest}
                x={plotX(lowerBound).toFixed(3)}
                width={(plotX(upperBound) - plotX(lowerBound)).toFixed(3)}
                y={plotY(token0Value).toFixed(3)}
                height={(plotY(new BigNumber(0)) - plotY(token0Value)).toFixed(
                  3
                )}
              />
            ),
            token1Value?.isGreaterThan(0) && (
              <rect
                key={`${index}-1`}
                className="tick-bucket token-b"
                {...rest}
                x={plotX(lowerBound).toFixed(3)}
                width={(plotX(upperBound) - plotX(lowerBound)).toFixed(3)}
                y={plotY(token0Value.plus(token1Value)).toFixed(3)}
                height={(plotY(new BigNumber(0)) - plotY(token1Value)).toFixed(
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
  plotX,
  plotY,
}: {
  xMin: number;
  xMax: number;
  className?: string;
  plotX: (x: number) => number;
  plotY: (y: number) => number;
}) {
  if (!xMin || !xMax || xMin === xMax) return null;

  const start = Math.pow(10, Math.floor(Math.log10(xMin)));
  const tickMarks = Array.from({ length: Math.log10(xMax / xMin) + 2 }).flatMap(
    (_, index) => {
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
    }
  );

  return (
    <g className={['axis', className].filter(Boolean).join(' ')}>
      <line
        x1="0"
        x2={plotX(xMax * 2)}
        y1={plotY(0).toFixed(0)}
        y2={plotY(0).toFixed(0)}
      />
      <g className="axis-ticks">{tickMarks.map(mapTickMark)}</g>
    </g>
  );

  function mapTickMark(tickMark: number) {
    const decimalPlaces = Math.max(0, -Math.floor(Math.log10(tickMark)));
    return (
      <g key={tickMark} className="axis-tick">
        <line
          x1={plotX(tickMark).toFixed(3)}
          x2={plotX(tickMark).toFixed(3)}
          y1={plotY(0)}
          y2={plotY(0) + 2}
        />
        <text
          x={plotX(tickMark).toFixed(3)}
          y={plotY(0) + 2}
          dy="12"
          dominantBaseline="middle"
          textAnchor="middle"
        >
          {tickMark.toFixed(decimalPlaces)}
        </text>
      </g>
    );
  }
}

function getMinYHeight(tickCount: number): number {
  return 1 / ((tickCount - 2) / 3 + 2) + 0.4;
}
