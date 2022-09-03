import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useLayoutEffect,
} from 'react';
import { TickMap, TickInfo } from '../../lib/web3/indexerProvider';

import './LiquiditySelector.scss';

interface LiquiditySelectorProps {
  ticks: TickMap | undefined;
  tickCount: number;
  feeTier: number | undefined;
}

type TickGroup = Array<
  [price: number, token0Value: number, token1Value: number]
>;
type TickGroupBucketsEmpty = Array<[lowerBound: number, upperBound: number]>;
type TickGroupBucketsFilled = Array<
  [
    lowerBound: number,
    upperBound: number,
    token0Value: number,
    token1Value: number
  ]
>;

const paddingPercent = 0.2;
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
}: LiquiditySelectorProps) {
  // collect tick information in a more useable form
  const feeTicks: TickGroup = useMemo(() => {
    return Object.values(ticks)
      .map((poolTicks) => poolTicks[0] || poolTicks[1]) // read tick if it exists on either pool queue side
      .filter((tick): tick is TickInfo => tick?.fee.isEqualTo(feeTier) === true) // filter to only fee ticks
      .map((tick) => [
        tick.price.toNumber(),
        tick.reserve0.toNumber(),
        tick.reserve1.toNumber(),
      ]);
  }, [ticks, feeTier]);

  // todo: base graph start and end on existing ticks and current price
  //       (if no existing ticks exist only cuurent price can indicate start and end)

  const [userTicks, setUserTicks] = useState<TickGroup>([]);

  const [dataStart, setDataStart] = useState(0);
  const [dataEnd, setDataEnd] = useState(0);

  useEffect(() => {
    const { xMin = 0, xMax = 0 } = feeTicks.reduce<{
      [key: string]: number;
    }>((result, [price]) => {
      if (price < (result.xMin ?? Infinity)) result.xMin = price;
      if (price > (result.xMax ?? -Infinity)) result.xMax = price;
      return result;
    }, {});
    // set data min/max values
    setDataStart(xMin);
    setDataEnd(xMax);
  }, [feeTicks]);

  // find container size that buckets should fit
  const [container, setContainer] = useState<SVGSVGElement | null>(null);
  const windowWidth = useWindowWidth();
  const [containerWidth, setContainerWidth] = useState(0);
  useLayoutEffect(() => {
    setContainerWidth(container?.clientWidth ?? 0);
  }, [container, windowWidth]);

  // calculate bucket extents
  const emptyBuckets = useMemo<TickGroupBucketsEmpty>(() => {
    // get bounds
    const xMin = roundDownToPrecision(dataStart, 2);
    const xMax = roundUpToPrecision(dataEnd, 2);
    const xWidth = xMax - xMin;
    // find bucket size
    const bucketCount = Math.ceil(containerWidth / bucketWidth) ?? 1; // default to 1 bucket if none
    const bucketSize = roundUpToPrecision(xWidth / bucketCount, 1);
    // find bucket starting value to cover all values
    const totalBucketSize = bucketSize * bucketCount;
    const remainder = totalBucketSize - xWidth;
    const xStart = xMin - remainder / 2;
    // decide where to put the bucket start
    const xStartRounded = xStart - (xStart % bucketSize);

    return Array.from({ length: bucketCount }).map((_, index) => {
      return [
        xStartRounded + bucketSize * index,
        xStartRounded + bucketSize * (index + 1),
      ];
    });

    function roundDownToPrecision(number: number, precision: number) {
      if (number === 0) return 0;
      const orderOfMagnitude = Math.floor(Math.log10(number)) - precision + 1;
      const roundingExponent = Math.pow(10, orderOfMagnitude);
      return Math.floor(number / roundingExponent) * roundingExponent;
    }
    function roundUpToPrecision(number: number, precision: number) {
      if (number === 0) return 0;
      const orderOfMagnitude = Math.floor(Math.log10(number)) - precision + 1;
      const roundingExponent = Math.pow(10, orderOfMagnitude);
      return Math.ceil(number / roundingExponent) * roundingExponent;
    }
  }, [containerWidth, dataStart, dataEnd]);

  // calculate graph extents
  const [graphStart, graphEnd] = useMemo(() => {
    return [
      Math.min(userTicks[0]?.[0], emptyBuckets[0]?.[0]) || 0, // minimum bound
      Math.max(
        userTicks[userTicks.length - 1]?.[0],
        emptyBuckets[emptyBuckets.length - 1]?.[0]
      ) || 0, // maximum bound
    ];
  }, [emptyBuckets, userTicks]);

  // calculate histogram values
  const feeTickBuckets = useMemo<TickGroupBucketsFilled>(() => {
    const remainingTicks = feeTicks.slice();
    return emptyBuckets.map(([lowerBound, upperBound]) => {
      const [token0Value, token1Value] = remainingTicks.reduceRight(
        (result, [price, token0Value, token1Value], index) => {
          if (price >= lowerBound && price <= upperBound) {
            remainingTicks.splice(index, 1); // remove from set to minimise reduce time
            return [result[0] + token0Value, result[1] + token1Value];
          }
          return result;
        },
        [0, 0]
      );
      return [lowerBound, upperBound, token0Value, token1Value];
    });
  }, [emptyBuckets, feeTicks]);

  const graphHeight = useMemo(() => {
    return feeTickBuckets.reduce(
      (result, data) => Math.max(result, data[2]),
      0
    );
  }, [feeTickBuckets]);

  // plot values as percentages on a 100 height viewbox (viewBox="0 -100 100 100")
  const plotX = useCallback(
    (x: number): number => {
      const leftPadding = 10;
      const rightPadding = 10;
      const width = 100 - leftPadding - rightPadding;
      return graphEnd === graphStart
        ? leftPadding + width / 2
        : leftPadding + (width * (x - graphStart)) / (graphEnd - graphStart);
    },
    [graphStart, graphEnd]
  );
  const plotY = useCallback(
    (y: number): number => {
      const topPadding = 10;
      const bottomPadding = 20;
      const height = 100 - topPadding - bottomPadding;
      return graphHeight === 0
        ? -bottomPadding - height / 2
        : -bottomPadding - (height * (y - 0)) / (graphHeight - 0);
    },
    [graphHeight]
  );

  const invertTokenOrder = useMemo(() => {
    const { token0Count, token0Value, token1Count, token1Value } =
      feeTicks.reduce(
        (result, [price, token0Value, token1Value]) => {
          result.token0Value += price * token0Value;
          result.token0Count += token0Value;
          result.token1Value += price * token1Value;
          result.token1Count += token1Value;
          return result;
        },
        { token0Count: 0, token0Value: 0, token1Count: 0, token1Value: 0 }
      );
    const averageToken0Value = token0Value / token0Count;
    const averageToken1Value = token1Value / token1Count;
    return averageToken0Value > averageToken1Value;
  }, [feeTicks]);

  // estimate current price from ticks
  const currentPriceFromTicks = useMemo(() => {
    const remainingTicks = feeTicks.slice();
    const highTokenValueIndex = invertTokenOrder ? 2 : 1;
    const lowTokenValueIndex = invertTokenOrder ? 1 : 2;
    let highestLowTokenTickIndex = findLastIndex(
      remainingTicks,
      (tick) => tick[lowTokenValueIndex] > 0
    );
    let lowestHighTokenTickIndex = remainingTicks.findIndex(
      (tick) => tick[highTokenValueIndex] > 0
    );
    do {
      const highestLowTokenTick = remainingTicks[highestLowTokenTickIndex];
      const lowestHighTokenTick = remainingTicks[lowestHighTokenTickIndex];
      if (highestLowTokenTick && lowestHighTokenTick) {
        // check if prices are resolved and current price can be plain average of these values
        if (lowestHighTokenTick[0] >= highestLowTokenTick[0]) {
          return (lowestHighTokenTick[0] + highestLowTokenTick[0]) / 2;
        } else {
          const highestLowTokenTickValue =
            highestLowTokenTick[lowTokenValueIndex] * highestLowTokenTick[0];
          const lowestHighTokenTickValue =
            lowestHighTokenTick[highTokenValueIndex] * lowestHighTokenTick[0];
          if (highestLowTokenTickValue < lowestHighTokenTickValue) {
            remainingTicks.splice(highestLowTokenTickIndex, 1);
            highestLowTokenTickIndex = findLastIndex(
              remainingTicks,
              (tick) => tick[lowTokenValueIndex] > 0
            ); // todo: search from last known index here
            lowestHighTokenTickIndex = remainingTicks.indexOf(
              lowestHighTokenTick,
              lowestHighTokenTickIndex
            );
          } else {
            remainingTicks.splice(lowestHighTokenTickIndex, 1);
            lowestHighTokenTickIndex = remainingTicks.findIndex(
              (tick) => tick[highTokenValueIndex] > 0
            ); // todo: search from last known index here
            highestLowTokenTickIndex = remainingTicks.lastIndexOf(
              highestLowTokenTick,
              highestLowTokenTickIndex
            );
          }
        }
      } else {
        return undefined;
      }
    } while (remainingTicks.length > 0);
  }, [feeTicks, invertTokenOrder]);

  useEffect(() => {
    setUserTicks(() => {
      const range = dataEnd - dataStart;
      const midpoint = dataStart + range / 2;
      // set multiple ticks across the range
      if (tickCount > 1) {
        // spread evenly after adding padding on each side
        const tickStart = dataStart - range * paddingPercent;
        const tickEnd = dataEnd + range * paddingPercent;
        const tickGap = (tickEnd - tickStart) / (tickCount - 1);
        const currentPrice = currentPriceFromTicks || midpoint;
        return Array.from({ length: tickCount }).map((_, index) => {
          const price = tickStart + index * tickGap;
          const invertToken = invertTokenOrder
            ? price >= currentPrice
            : price < currentPrice;
          return [
            price,
            invertToken ? graphHeight : 0,
            invertToken ? 0 : graphHeight,
          ];
        });
      }
      // or set single center tick
      else if (tickCount === 1) {
        return [[midpoint, graphHeight / 2, graphHeight / 2]];
      }
      // or set no ticks
      else {
        return [];
      }
    });
  }, [
    tickCount,
    invertTokenOrder,
    currentPriceFromTicks,
    dataStart,
    dataEnd,
    graphHeight,
  ]);

  return (
    <svg
      className="chart-liquidity"
      viewBox="0 -100 100 100"
      preserveAspectRatio="none"
      ref={setContainer}
    >
      {graphEnd === 0 && <text>Chart is not currently available</text>}
      <TickBucketsGroup
        className="old-tick-bucket"
        tickBuckets={feeTickBuckets}
        plotX={plotX}
        plotY={plotY}
      />
      <TicksGroup
        className="new-tick"
        ticks={userTicks}
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
  plotX: (x: number) => number;
  plotY: (y: number) => number;
  className?: string;
}) {
  return (
    <g>
      {ticks.map(([price, token0Value, token1Value], index) => (
        <line
          key={index}
          {...rest}
          x1={plotX(price).toFixed(3)}
          x2={plotX(price).toFixed(3)}
          y1={plotY(0).toFixed(3)}
          y2={plotY(token0Value || token1Value).toFixed(3)}
          className={['tick', className].filter(Boolean).join(' ')}
        />
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
  plotX: (x: number) => number;
  plotY: (y: number) => number;
  className?: string;
}) {
  return (
    <g>
      {tickBuckets.flatMap(
        ([lowerBound, upperBound, token0Value, token1Value], index) =>
          [
            token0Value && (
              <rect
                key={`${index}-0`}
                {...rest}
                x={plotX(lowerBound).toFixed(3)}
                width={(plotX(upperBound) - plotX(lowerBound)).toFixed(3)}
                y={plotY(token0Value).toFixed(3)}
                height={(plotY(0) - plotY(token0Value)).toFixed(3)}
                className={['tick-bucket', 'token-a', className]
                  .filter(Boolean)
                  .join(' ')}
              />
            ),
            token1Value && (
              <rect
                key={`${index}-1`}
                {...rest}
                x={plotX(lowerBound).toFixed(3)}
                width={(plotX(upperBound) - plotX(lowerBound)).toFixed(3)}
                y={plotY(token0Value + token1Value).toFixed(3)}
                height={(plotY(0) - plotY(token1Value)).toFixed(3)}
                className={['tick-bucket', 'token-b', className]
                  .filter(Boolean)
                  .join(' ')}
              />
            ),
          ].filter(Boolean)
      )}
    </g>
  );
}

/**
 * Returns the index of the last element in the array where predicate is true, and -1
 * otherwise.
 * @param array The source array to search in
 * @param predicate find calls predicate once for each element of the array, in descending
 * order, until it finds one where predicate returns true. If such an element is found,
 * findLastIndex immediately returns that element index. Otherwise, findLastIndex returns -1.
 */
export function findLastIndex<T>(
  array: Array<T>,
  predicate: (value: T, index: number, obj: T[]) => boolean
): number {
  let l = array.length;
  while (l--) {
    if (predicate(array[l], l, array)) return l;
  }
  return -1;
}
