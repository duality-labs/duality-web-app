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
  const invertTokenOrder = currentPriceABFromTicks
    ? currentPriceABFromTicks.isLessThan(1)
    : false;
  const currentPriceFromTicks =
    invertTokenOrder && currentPriceABFromTicks
      ? new BigNumber(1).dividedBy(currentPriceABFromTicks)
      : currentPriceABFromTicks;
  const initialGraphStart = 0;
  const initialGraphEnd = currentPriceFromTicks
    ? currentPriceFromTicks.multipliedBy(2).toNumber()
    : 0;

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
    const { xMin = new BigNumber(0), xMax = new BigNumber(0) } =
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

  // allow user ticks to reset the boundary of the graph
  useEffect(() => {
    const minUserTickPrice = userTicks[0]?.[0];
    const maxUserTickPrice = userTicks[userTicks.length - 1]?.[0];
    if (minUserTickPrice)
      setGraphStart(
        Math.min(initialGraphStart, minUserTickPrice.toNumber()) || 0
      );
    if (maxUserTickPrice)
      setGraphEnd(Math.max(initialGraphEnd, maxUserTickPrice.toNumber()) || 0);
  }, [initialGraphStart, initialGraphEnd, userTicks]);

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
    const xMin = dataStart.sd(2, BigNumber.ROUND_DOWN).toNumber();
    const xMax = dataEnd.sd(2, BigNumber.ROUND_UP).toNumber();
    const xWidth = xMax - xMin;
    // find bucket size
    const bucketCount = Math.ceil(containerWidth / bucketWidth) ?? 1; // default to 1 bucket if none
    const bucketSize = new BigNumber(xWidth)
      .dividedBy(bucketCount)
      .sd(2, BigNumber.ROUND_UP)
      .toNumber();
    // find bucket starting value to cover all values
    const totalBucketSize = bucketSize * bucketCount;
    const remainder = totalBucketSize - xWidth;
    const xStart = xMin - remainder / 2;
    // decide where to put the bucket start
    const xStartRounded = new BigNumber(xStart - (xStart % (bucketSize || 1)));

    return Array.from({ length: bucketCount }).map((_, index) => {
      return [
        xStartRounded.plus(bucketSize * index),
        xStartRounded.plus(bucketSize * (index + 1)),
      ];
    });
  }, [containerWidth, dataStart, dataEnd]);

  // calculate histogram values
  const feeTickBuckets = useMemo<TickGroupBucketsFilled>(() => {
    const remainingTicks = feeTicks.slice();
    return emptyBuckets.reduce<TickGroupBucketsFilled>(
      (result, [lowerBound, upperBound]) => {
        const [token0Value, token1Value] = remainingTicks.reduceRight(
          (result, [price, token0Value, token1Value], index) => {
            if (
              price.isGreaterThanOrEqualTo(lowerBound) &&
              price.isLessThanOrEqualTo(upperBound)
            ) {
              remainingTicks.splice(index, 1); // remove from set to minimise reduce time
              return [result[0].plus(token0Value), result[1].plus(token1Value)];
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
  }, [emptyBuckets, feeTicks]);

  const graphHeight = useMemo(() => {
    return feeTickBuckets.reduce(
      (result, data) => Math.max(result, data[2].toNumber()),
      0
    );
  }, [feeTickBuckets]);

  // plot values as percentages on a 100 height viewbox (viewBox="0 -100 100 100")
  const plotX = useCallback(
    (x: BigNumber): number => {
      const leftPadding = 10;
      const rightPadding = 10;
      const width = 100 - leftPadding - rightPadding;
      return graphEnd === graphStart
        ? leftPadding + width / 2
        : leftPadding +
            (width * (x.toNumber() - graphStart)) / (graphEnd - graphStart);
    },
    [graphStart, graphEnd]
  );
  const plotY = useCallback(
    (y: BigNumber): number => {
      const topPadding = 10;
      const bottomPadding = 20;
      const height = 100 - topPadding - bottomPadding;
      return graphHeight === 0
        ? -bottomPadding - height / 2
        : -bottomPadding - (height * (y.toNumber() - 0)) / (graphHeight - 0);
    },
    [graphHeight]
  );

  useEffect(() => {
    setUserTicks(() => {
      // set multiple ticks across the range
      if (tickCount > 1) {
        const range = dataEnd.minus(dataStart);
        const midpoint = dataStart.plus(range.dividedBy(2));
        const tickHeight = graphHeight * 0.7;
        // spread evenly after adding padding on each side
        const tickStart = new BigNumber(rangeMin);
        const tickEnd = new BigNumber(rangeMax);
        const tickGap = tickEnd.minus(tickStart).dividedBy(tickCount - 1);
        const currentPrice = currentPriceFromTicks || midpoint;
        return Array.from({ length: tickCount }).map((_, index) => {
          const price = tickStart.plus(tickGap.multipliedBy(index));
          const invertToken = invertTokenOrder
            ? price >= currentPrice
            : price < currentPrice;
          return [
            price,
            new BigNumber(invertToken ? tickHeight : 0),
            new BigNumber(invertToken ? 0 : tickHeight),
          ];
        });
      }
      // or set no ticks
      else {
        return [];
      }
    });
  }, [
    rangeMin,
    rangeMax,
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
  plotX: (x: BigNumber) => number;
  plotY: (y: BigNumber) => number;
  className?: string;
}) {
  return (
    <g className={className}>
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
              token0Value.isGreaterThan(0) ? token0Value : token1Value
            ).toFixed(3)}
            className="line"
          />
          <line
            x1={plotX(price).toFixed(3)}
            x2={plotX(price).toFixed(3)}
            y1={plotY(
              (token0Value.isGreaterThan(0)
                ? token0Value
                : token1Value
              ).multipliedBy(0.975)
            ).toFixed(3)}
            y2={plotY(
              token0Value.isGreaterThan(0) ? token0Value : token1Value
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
                height={(plotY(new BigNumber(0)) - plotY(token0Value)).toFixed(
                  3
                )}
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
                y={plotY(token0Value.plus(token1Value)).toFixed(3)}
                height={(plotY(new BigNumber(0)) - plotY(token1Value)).toFixed(
                  3
                )}
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
