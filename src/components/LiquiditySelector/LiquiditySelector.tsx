import { useState, useEffect } from 'react';

import './LiquiditySelector.scss';

interface LiquiditySelectorProps {
  existingTicks: Array<[number, number]>;
  tickCount: number;
}

function roundUp(value: number) {
  return Math.round((value * 1.2) / 5) * 5;
}

function roundDown(value: number) {
  return Math.round((value * 0.8) / 5) * 5; // not exactly the same gap but close enough
}

export default function LiquiditySelector({
  tickCount,
  existingTicks,
}: LiquiditySelectorProps) {
  const [graphStart, setGraphStart] = useState(0);
  const [graphEnd, setGraphEnd] = useState(5);
  const [graphHeight, setGraphHeight] = useState(100);
  const [userTicks, setUserTicks] = useState([1, 4]);

  useEffect(() => {
    let maxValue = -Infinity,
      minRate = Infinity,
      maxRate = -Infinity; // More efficient than 3 foreach loops
    existingTicks.forEach(function ([rate, value]) {
      maxValue = Math.max(maxValue, value);
      minRate = Math.min(minRate, rate);
      maxRate = Math.max(maxRate, rate);
    });
    setGraphHeight(roundUp(maxValue));
    setGraphStart(roundDown(minRate));
    setGraphEnd(roundUp(maxRate));
  }, [existingTicks]);

  useEffect(() => {
    // spread evenly after ignoring 20% on each side
    const gap = graphEnd - graphStart,
      start = graphStart + gap / 5,
      end = graphEnd - gap / 5,
      partGap = (end - start) / (tickCount - 1);
    if (tickCount === 1) setUserTicks([graphStart + gap / 2]);
    else
      setUserTicks(
        '0'
          .repeat(tickCount)
          .split('')
          .map((_, index) => start + index * partGap)
      );
  }, [tickCount, graphStart, graphEnd]);

  return (
    <svg viewBox={`${graphStart} 0 ${graphEnd} ${graphHeight}`}>
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
          className="tick current-tick"
        />
      ))}
    </svg>
  );
}
