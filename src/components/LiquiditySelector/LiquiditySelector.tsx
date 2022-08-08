import { useState, useEffect, useMemo } from 'react';
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
      .map(poolTicks => poolTicks[0] || poolTicks[1]) // read tick if it exists on either pool queue side
      .filter((tick): tick is TickInfo => !!tick) // filter to only found ticks
      .map(tick => [tick.price.toNumber(), tick.totalShares.toNumber()]);
  }, [ticks]);

  // todo: base graph start and end on existing ticks and current price
  //       (if no existing ticks exist only cuurent price can indicate start and end)
  const [graphStart, setGraphStart] = useState(0);
  const [graphEnd, setGraphEnd] = useState(0);
  const [graphHeight, setGraphHeight] = useState(100);
  const [userTicks, setUserTicks] = useState<Array<number>>([]);

  useEffect(() => {
    const { xMin, xMax, yMax } = existingTicks.reduce(
      (result, [rate, value]) => {
        if (rate < result.xMin) result.xMin = rate;
        if (rate > result.xMax) result.xMax = rate;
        if (value > result.yMax) result.yMax = value;
        return result;
      },
      { xMin: Infinity, xMax: -Infinity, yMax: -Infinity }
    );
    setGraphStart(xMin);
    setGraphEnd(xMax);
    setGraphHeight(yMax);
  }, [existingTicks]);

  const graphPadding = useMemo(() => {
    const range = graphEnd - graphStart;
    return {
      x: range * paddingPercent,
      y: graphHeight * paddingPercent,
    };
  }, [graphStart, graphEnd, graphHeight]);

  useEffect(() => {
    setUserTicks(() => {
      const range = graphEnd - graphStart;
      // set multiple ticks across the range
      if (tickCount > 1) {
        // spread evenly after adding padding on each side
        const tickStart = graphStart + range * paddingPercent;
        const tickEnd = graphEnd - range * paddingPercent;
        const tickGap = (tickEnd - tickStart) / (tickCount - 1);
        return Array.from({ length: tickCount }).map(
          (_, index) => tickStart + index * tickGap
        );
      }
      // or set single center tick
      else if (tickCount === 1) {
        return [graphStart + range / 2];
      }
      // or set no ticks
      else {
        return [];
      }
    });
  }, [tickCount, graphStart, graphEnd]);

  if (!graphEnd) {
    return <div>Chart is not currently available</div>;
  }

  return (
    <svg
      viewBox={`${
        //left
        Math.floor(graphStart - graphPadding.x)
      } ${
        // right
        '0'
      } ${
        // width
        Math.ceil(graphEnd - graphStart + 2 * graphPadding.x)
      } ${
        // height
        Math.ceil(graphHeight + graphPadding.y)
      }`}
    >
      {existingTicks.map(([rate, value]) => (
        <path
          key={rate}
          d={`M ${rate}, ${graphHeight} L ${rate} ${graphHeight - value}`}
          className="tick old-tick"
        />
      ))}
      {userTicks.map((tick, index) => (
        <path
          key={index}
          d={`M ${tick}, ${graphHeight} L ${tick} ${0}`}
          className="tick new-tick"
        />
      ))}
    </svg>
  );
}
