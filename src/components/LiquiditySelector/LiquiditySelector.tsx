import { useState, useEffect } from 'react';

import './LiquiditySelector.scss';

interface LiquiditySelectorProps {
  existingTicks: Array<[number, number, number, number]>;
  tickCount: number;
  userFeeTier?: number;
  backgrounds?: boolean;
  showUserTicks?: boolean;
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
  userFeeTier = 1, // 1%
  backgrounds = false,
  showUserTicks = false,
}: LiquiditySelectorProps) {
  const [graphStart, setGraphStart] = useState(0);
  const [graphEnd, setGraphEnd] = useState(5);
  const [graphHeight, setGraphHeight] = useState(100);
  const [userTicks, setUserTicks] = useState([1, 4]);

  useEffect(() => {
    let maxValue = -Infinity,
      minRate = Infinity,
      maxRate = -Infinity; // More efficient than 3 foreach loops
    existingTicks.forEach(function ([rate, valueA, valueB]) {
      maxValue = Math.max(maxValue, valueA + valueB);
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
    <svg viewBox={`${graphStart} 0 ${graphEnd - graphStart} ${graphHeight}`}>
      {/* buy tick backgrounds */}
      {backgrounds &&
        existingTicks.map(([rate, valueA, valueB, fee]) => (
          <path
            key={`${rate}-a`}
            d={`M ${rate * (1 - fee / 100)}, ${graphHeight} L ${
              rate * (1 - fee / 100)
            } ${graphHeight - valueA - valueB}`}
            className="tick old-tick tick-background tick-a"
          />
        ))}
      {/* sell tick backgrounds */}
      {backgrounds &&
        existingTicks.map(([rate, valueA, valueB, fee]) => (
          <path
            key={`${rate}-b`}
            d={`M ${rate * (1 + fee / 100)}, ${graphHeight} L ${
              rate * (1 + fee / 100)
            } ${graphHeight - valueA - valueB}`}
            className="tick old-tick tick-background tick-b"
          />
        ))}
      {/* buy ticks */}
      {existingTicks.map(([rate, valueA, valueB, fee]) => (
        <path
          key={`${rate}-a`}
          d={`M ${rate * (1 - fee / 100)}, ${graphHeight} L ${
            rate * (1 - fee / 100)
          } ${graphHeight - valueA}`}
          className="tick old-tick tick-a"
        />
      ))}
      {/* sell ticks */}
      {existingTicks.map(([rate, valueA, valueB, fee]) => (
        <path
          key={`${rate}-b`}
          d={`M ${rate * (1 + fee / 100)}, ${graphHeight} L ${
            rate * (1 + fee / 100)
          } ${graphHeight - valueB}`}
          className="tick old-tick tick-b"
        />
      ))}
      {showUserTicks &&
        userTicks.map((tick, index) => (
          <path
            key={index}
            d={`M ${tick * (1 - userFeeTier / 100)}, ${graphHeight} L ${
              tick * (1 - userFeeTier / 100)
            } ${0}`}
            className="tick current-tick tick-a"
          />
        ))}
      {showUserTicks &&
        userTicks.map((tick, index) => (
          <path
            key={index}
            d={`M ${tick * (1 + userFeeTier / 100)}, ${graphHeight} L ${
              tick * (1 + userFeeTier / 100)
            } ${0}`}
            className="tick current-tick tick-b"
          />
        ))}
    </svg>
  );
}
