import { useState, useEffect, useMemo, useCallback } from 'react';
import { TickMap, TickInfo } from '../../lib/web3/indexerProvider';

import './LiquiditySelector.scss';

interface LiquiditySelectorProps {
  ticks: TickMap | undefined;
  tickCount: number;
}

const paddingPercent = 0.2;

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
  const [graphStart, setGraphStart] = useState(0);
  const [graphEnd, setGraphEnd] = useState(0);
  const [graphHeight, setGraphHeight] = useState(0);

  const [userTicks, setUserTicks] = useState<Array<[number, number]>>([]);

  useEffect(() => {
    const {
      xMin = 0,
      xMax = 0,
      yMax = 0,
    } = existingTicks.reduce<{ [key: string]: number }>(
      (result, [price, totalShares]) => {
        if (price < (result.xMin ?? Infinity)) result.xMin = price;
        if (price > (result.xMax ?? -Infinity)) result.xMax = price;
        if (totalShares > (result.yMax ?? -Infinity)) result.yMax = totalShares;
        return result;
      },
      {}
    );
    // set data min/max values
    setGraphStart(xMin);
    setGraphEnd(xMax);
    setGraphHeight(yMax);
  }, [existingTicks]);

  // plot values as percentages on a 100 height viewbox (viewBox="0 -100 100 100")
  const plotX = useCallback(
    (x: number): string => {
      const leftPadding = 10;
      const rightPadding = 10;
      const width = 100 - leftPadding - rightPadding;
      return graphEnd === graphStart
        ? (leftPadding + width / 2).toFixed(0)
        : (
            leftPadding +
            (width * (x - graphStart)) / (graphEnd - graphStart)
          ).toFixed(3);
    },
    [graphStart, graphEnd]
  );
  const plotY = useCallback(
    (y: number): string => {
      const topPadding = 10;
      const bottomPadding = 20;
      const height = 100 - topPadding - bottomPadding;
      return graphHeight === 0
        ? (-bottomPadding - height / 2).toFixed(0)
        : (-bottomPadding - (height * (y - 0)) / (graphHeight - 0)).toFixed(3);
    },
    [graphHeight]
  );

  useEffect(() => {
    setUserTicks(() => {
      const range = graphEnd - graphStart;
      // set multiple ticks across the range
      if (tickCount > 1) {
        // spread evenly after adding padding on each side
        const tickStart = graphStart + range * paddingPercent;
        const tickEnd = graphEnd - range * paddingPercent;
        const tickGap = (tickEnd - tickStart) / (tickCount - 1);
        return Array.from({ length: tickCount }).map((_, index) => [
          tickStart + index * tickGap,
          graphHeight,
        ]);
      }
      // or set single center tick
      else if (tickCount === 1) {
        return [[graphStart + range / 2, graphHeight]];
      }
      // or set no ticks
      else {
        return [];
      }
    });
  }, [tickCount, graphStart, graphEnd, graphHeight]);

  if (!graphEnd) {
    return <div>Chart is not currently available</div>;
  }

  return (
    <svg
      className="chart-liquidity"
      viewBox="0 -100 100 100"
      preserveAspectRatio="none"
    >
      <TicksGroup
        className="old-tick"
        ticks={existingTicks}
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
  ticks: Array<[number, number]>;
  plotX: (x: number) => string;
  plotY: (y: number) => string;
  className?: string;
}) {
  return (
    <g>
      {ticks.map(([price, totalShares], index) => (
        <line
          key={index}
          {...rest}
          x1={plotX(price)}
          x2={plotX(price)}
          y1={plotY(0)}
          y2={plotY(totalShares)}
          className={['tick', className].filter(Boolean).join(' ')}
        />
      ))}
    </g>
  );
}
