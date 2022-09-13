import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useLayoutEffect,
  useRef,
} from 'react';
import { TickMap, TickInfo } from '../../lib/web3/indexerProvider';
import useCurrentPriceFromTicks from './useCurrentPriceFromTicks';

import './LiquiditySelector.scss';
import BigNumber from 'bignumber.js';

interface LiquiditySelectorProps {
  ticks: TickMap | undefined;
  tickCount: number;
  feeTier: number | undefined;
  rangeMin: string | undefined;
  rangeMax: string | undefined;
  tokenValues: [valueA: string, valueB: string];
  setUserTicks?: (userTicks: TickGroup) => void;
}

export type TickGroup = Array<
  [price: BigNumber, token0Value: BigNumber, token1Value: BigNumber]
>;
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
  tickCount,
  ticks = {},
  feeTier = -1,
  rangeMin = '0',
  rangeMax = '1',
  tokenValues = ['0', '0'],
  setUserTicks: setExternalUserTicks,
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

  const currentPriceABFromTicks = useCurrentPriceFromTicks(feeTicks);
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

  const [userTicks, setUserTicks] = useState<TickGroup>([]);
  // allow userTicks to be passed back up to parent component
  const setExternalUserTicksRef = useRef(setExternalUserTicks);
  useEffect(() => {
    setExternalUserTicksRef.current = setExternalUserTicks;
  }, [setExternalUserTicks]);
  useEffect(() => {
    setExternalUserTicksRef.current?.(userTicks);
  }, [userTicks]);

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
  const [containerWidth, setContainerWidth] = useState(0);
  useLayoutEffect(() => {
    setContainerWidth(container?.clientWidth ?? 0);
  }, [container, windowWidth]);

  const bucketCount =
    (Math.ceil(containerWidth / bucketWidth) ?? 1) + // default to 1 bucket if none
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
  useEffect(() => {
    const minUserTickPrice = userTicks[0]?.[0];
    const maxUserTickPrice = userTicks[userTicks.length - 1]?.[0];
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
      .reduce((result, data) => Math.max(result, data[2].toNumber()), 0);
  }, [feeTickBuckets]);

  // plot values as percentages on a 100 height viewbox (viewBox="0 -100 100 100")
  const xMin = graphStart.sd(2, BigNumber.ROUND_DOWN).toNumber();
  const xMax = graphEnd.sd(2, BigNumber.ROUND_UP).toNumber();
  const plotX = useCallback(
    (x: number): number => {
      const leftPadding = 10;
      const rightPadding = 10;
      const width = 100 - leftPadding - rightPadding;
      return xMin === xMax
        ? // choose midpoint
          leftPadding + width / 2
        : // interpolate coordinate to graph
          leftPadding +
            (width * (Math.log(x) - Math.log(xMin))) /
              (Math.log(xMax) - Math.log(xMin));
    },
    [xMin, xMax]
  );
  const plotY = useCallback(
    (y: number): number => {
      const topPadding = 10;
      const bottomPadding = 20;
      const height = 100 - topPadding - bottomPadding;
      return graphHeight === 0
        ? -bottomPadding // pin to bottom
        : -bottomPadding - (height * y) / graphHeight;
    },
    [graphHeight]
  );
  const percentY = useCallback((y: number): number => {
    const topPadding = 10;
    const bottomPadding = 20;
    const height = 100 - topPadding - bottomPadding;
    return -bottomPadding - height * y;
  }, []);
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

  useEffect(() => {
    setUserTicks(() => {
      // set multiple ticks across the range
      if (currentPriceFromTicks.isGreaterThan(0) && tickCount > 1) {
        const tokenAmountA = new BigNumber(tokenValues[0]);
        const tokenAmountB = new BigNumber(tokenValues[1]);
        // spread evenly after adding padding on each side
        const tickStart = new BigNumber(rangeMin);
        const tickEnd = new BigNumber(rangeMax);

        // space new ticks by a multiplication ratio gap
        // use Math.pow becuse BigNumber does not support logarithm calculation
        // todo: use BigNumber logarithm compatible library to more accurately calculate tick spacing,
        //       with many ticks the effect of this precision may be quite noticable
        const tickGapRatio = new BigNumber(
          Math.pow(tickEnd.dividedBy(tickStart).toNumber(), 1 / (tickCount - 1))
        );
        const tickCounts: [number, number] = [0, 0];
        const tickPrices = Array.from({ length: tickCount }).map((_, index) => {
          const price = tickStart.multipliedBy(
            tickGapRatio.exponentiatedBy(index + 1)
          );
          const invertToken = invertTokenOrder
            ? price.isGreaterThanOrEqualTo(currentPriceFromTicks)
            : price.isLessThan(currentPriceFromTicks);
          // add to count
          tickCounts[invertToken ? 0 : 1] += 1;
          return [
            new BigNumber(price),
            new BigNumber(invertToken ? 1 : 0),
            new BigNumber(invertToken ? 0 : 1),
          ];
        });
        // normalise the tick amounts given
        return tickPrices.map(([price, countA, countB]) => {
          return [
            price,
            // ensure division is to µtokens amount but given in tokens
            tickCounts[0]
              ? tokenAmountA.multipliedBy(countA).dividedBy(tickCounts[0])
              : new BigNumber(0),
            tickCounts[1]
              ? tokenAmountB.multipliedBy(countB).dividedBy(tickCounts[1])
              : new BigNumber(0),
          ];
        });
      }
      // or set no ticks
      else {
        return [];
      }
    });
  }, [
    tokenValues,
    rangeMin,
    rangeMax,
    tickCount,
    invertTokenOrder,
    currentPriceFromTicks,
    graphHeight,
  ]);

  return (
    <svg
      className="chart-liquidity"
      viewBox="0 -100 100 100"
      preserveAspectRatio="none"
      ref={setContainer}
    >
      {graphEnd.isZero() && <text>Chart is not currently available</text>}
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
      <TicksGroup
        className="new-ticks"
        ticks={userTicks}
        plotX={plotXBigNumber}
        plotY={percentYBigNumber}
      />
      <Axis
        className="x-axis"
        // todo: make better (x-axis roughly adds tick marks to buckets near the extents)
        xMin={xMin / 1.1}
        xMax={xMax * 1.1}
        plotX={plotX}
        plotY={plotY}
      />
    </svg>
  );
}

function TicksGroup({
  ticks,
  plotX,
  plotY,
  className,
  ...rest
}: {
  ticks: TickGroup;
  plotX: (x: BigNumber) => number;
  plotY: (y: BigNumber) => number;
  className?: string;
}) {
  const cumulativeToken0Values = ticks.reduce(
    (result, [price, token0Value]) => result.plus(token0Value),
    new BigNumber(0)
  );
  const cumulativeToken1Values = ticks.reduce(
    (result, [price, _, token1Value]) => result.plus(token1Value),
    new BigNumber(0)
  );
  return (
    <g className={['ticks', className].filter(Boolean).join(' ')}>
      {ticks.map(([price, token0Value, token1Value], index) => (
        <g
          key={index}
          className={[
            'tick',
            token0Value.isGreaterThan(0) ? 'token-a' : 'token-b',
          ].join(' ')}
        >
          <line
            {...rest}
            x1={plotX(price).toFixed(3)}
            x2={plotX(price).toFixed(3)}
            y1={plotY(new BigNumber(0)).toFixed(3)}
            y2={plotY(
              token0Value.isGreaterThan(0)
                ? token0Value.dividedBy(cumulativeToken0Values)
                : token1Value.dividedBy(cumulativeToken1Values)
            ).toFixed(3)}
            className="line"
          />
          <line
            x1={plotX(price).toFixed(3)}
            x2={plotX(price).toFixed(3)}
            y1={(
              plotY(
                token0Value.isGreaterThan(0)
                  ? token0Value.dividedBy(cumulativeToken0Values)
                  : token1Value.dividedBy(cumulativeToken1Values)
              ) + 1
            ).toFixed(3)}
            y2={plotY(
              token0Value.isGreaterThan(0)
                ? token0Value.dividedBy(cumulativeToken0Values)
                : token1Value.dividedBy(cumulativeToken1Values)
            ).toFixed(3)}
            className="tip"
          />
        </g>
      ))}
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
  const tickMarks = Array.from({ length: Math.log10(xMax / xMin) + 1 }).flatMap(
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
      <line x1="0" x2="100" y1={plotY(0).toFixed(0)} y2={plotY(0).toFixed(0)} />
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
          y2={plotY(0) + 1}
        />
        <text
          x={plotX(tickMark).toFixed(3)}
          y={plotY(0) + 2}
          dy="3"
          dominantBaseline="middle"
          textAnchor="middle"
        >
          {tickMark.toFixed(decimalPlaces)}
        </text>
      </g>
    );
  }
}
