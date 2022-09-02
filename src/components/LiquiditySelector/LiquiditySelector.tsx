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
}

const paddingPercent = 0.2;
const bucketWidth = 20; // bucket width in pixels

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
}: LiquiditySelectorProps) {
  // collect tick information in a more useable form
  const existingTicks: Array<[number, number]> = useMemo(() => {
    return Object.values(ticks)
      .map((poolTicks) => poolTicks[0] || poolTicks[1]) // read tick if it exists on either pool queue side
      .filter((tick): tick is TickInfo => !!tick) // filter to only found ticks
      .map((tick) => [tick.price.toNumber(), tick.totalShares.toNumber()]);
  }, [ticks]);

  // todo: base graph start and end on existing ticks and current price
  //       (if no existing ticks exist only cuurent price can indicate start and end)

  const [userTicks, setUserTicks] = useState<Array<[number, number]>>([]);

  const [dataStart, setDataStart] = useState(0);
  const [dataEnd, setDataEnd] = useState(0);

  useEffect(() => {
    const { xMin = 0, xMax = 0 } = existingTicks.reduce<{
      [key: string]: number;
    }>((result, [price]) => {
      if (price < (result.xMin ?? Infinity)) result.xMin = price;
      if (price > (result.xMax ?? -Infinity)) result.xMax = price;
      return result;
    }, {});
    // set data min/max values
    setDataStart(xMin);
    setDataEnd(xMax);
  }, [existingTicks]);

  // find container size that buckets should fit
  const [container, setContainer] = useState<SVGSVGElement | null>(null);
  const windowWidth = useWindowWidth();
  const [containerWidth, setContainerWidth] = useState(0);
  useLayoutEffect(() => {
    setContainerWidth(container?.clientWidth ?? 0);
  }, [container, windowWidth]);

  // calculate bucket extents
  const emptyBuckets = useMemo<
    Array<[lowerBound: number, upperBound: number]>
  >(() => {
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
    const xStartRoundedUp = roundUpToPrecision(xStart, 1);
    const xStartRoundedDown = roundDownToPrecision(xStart, 1);
    // decide where to put the bucket start
    const xStartRounded =
      xStartRoundedUp - xStart < xStart - xStartRoundedDown
        ? xStartRoundedUp
        : xStartRoundedDown;

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
  const existingTickBuckets = useMemo<
    Array<[lowerBound: number, upperBound: number, value: number]>
  >(() => {
    const remainingTicks = existingTicks.slice();
    return emptyBuckets.map(([lowerBound, upperBound]) => {
      const count = remainingTicks.reduceRight(
        (result, [price, total], index) => {
          if (price >= lowerBound && price <= upperBound) {
            remainingTicks.splice(index, 1); // remove from set to minimise reduce time
            return result + total;
          }
          return result;
        },
        0
      );
      return [lowerBound, upperBound, count];
    });
  }, [emptyBuckets, existingTicks]);

  const graphHeight = useMemo(() => {
    return existingTickBuckets.reduce((result, data) => result + data[2], 0);
  }, [existingTickBuckets]);

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

  useEffect(() => {
    setUserTicks(() => {
      const range = dataEnd - dataStart;
      // set multiple ticks across the range
      if (tickCount > 1) {
        // spread evenly after adding padding on each side
        const tickStart = dataStart - range * paddingPercent;
        const tickEnd = dataEnd + range * paddingPercent;
        const tickGap = (tickEnd - tickStart) / (tickCount - 1);
        return Array.from({ length: tickCount }).map((_, index) => [
          tickStart + index * tickGap,
          graphHeight,
        ]);
      }
      // or set single center tick
      else if (tickCount === 1) {
        return [[dataStart + range / 2, graphHeight]];
      }
      // or set no ticks
      else {
        return [];
      }
    });
  }, [tickCount, dataStart, dataEnd, graphHeight]);

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
        tickBuckets={existingTickBuckets}
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
  ticks: Array<[lprice: number, value: number]>;
  plotX: (x: number) => number;
  plotY: (y: number) => number;
  className?: string;
}) {
  return (
    <g>
      {ticks.map(([price, totalShares], index) => (
        <line
          key={index}
          {...rest}
          x1={plotX(price).toFixed(3)}
          x2={plotX(price).toFixed(3)}
          y1={plotY(0).toFixed(3)}
          y2={plotY(totalShares).toFixed(3)}
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
  tickBuckets: Array<[lowerBound: number, upperBound: number, value: number]>;
  plotX: (x: number) => number;
  plotY: (y: number) => number;
  className?: string;
}) {
  return (
    <g>
      {tickBuckets.map(([lowerBound, upperBound, totalShares], index) => (
        <rect
          key={index}
          {...rest}
          x={plotX(lowerBound).toFixed(3)}
          width={(plotX(upperBound) - plotX(lowerBound)).toFixed(3)}
          y={plotY(totalShares).toFixed(3)}
          height={(plotY(0) - plotY(totalShares)).toFixed(3)}
          className={['tick-bucket', className].filter(Boolean).join(' ')}
        />
      ))}
    </g>
  );
}
