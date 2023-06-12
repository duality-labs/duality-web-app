import { useMemo } from 'react';
import { Bar } from '@visx/shape';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear } from '@visx/scale';

import { ChartProps } from './Chart';
import { TimeSeriesRow } from '../stats/utils';

import './TimeSeriesBarChart.scss';

const verticalMargin = 40;
const horizontalMargin = 0;

// accessors
const getX = ([unixTime]: TimeSeriesRow) => unixTime.toFixed();
const getY = ([, values]: TimeSeriesRow) =>
  values.reduce((acc, value) => acc + value, 0);

interface TimeSeriesBarChartProps extends ChartProps<TimeSeriesRow> {
  width: number;
  height: number;
  onHover: (data?: TimeSeriesRow) => void;
}

export default function TimeSeriesBarChart({
  data,
  height,
  width,
  onHover,
}: TimeSeriesBarChartProps) {
  // bounds
  const innerWidth = width - horizontalMargin;
  const innerHeight = height - verticalMargin;

  // sort data ascending (data arrives in reverse-chronological order)
  const sortedData = useMemo(() => {
    return data
      .slice(0)
      .reverse()
      .sort(([unixTimeA], [unixTimeB]) => unixTimeA - unixTimeB);
  }, [data]);

  // scales, memoize for performance
  const xScale = useMemo(
    () =>
      scaleBand<string>({
        range: [0, innerWidth],
        round: true,
        domain: sortedData.map(getX),
        padding: 0.4,
      }),
    [innerWidth, sortedData]
  );
  const yScale = useMemo(
    () =>
      scaleLinear<number>({
        range: [innerHeight, 0],
        round: true,
        domain: [0, Math.max(...data.map(getY))],
      }),
    [innerHeight, data]
  );

  return width < 10 ? null : (
    <svg className="visx-bar-chart" width={width} height={height}>
      <Group top={verticalMargin / 2}>
        {sortedData.map((datum) => {
          const x = getX(datum);
          const barWidth = xScale.bandwidth();
          const barHeight = innerHeight - (yScale(getY(datum)) ?? 0);
          const barX = xScale(x);
          const barY = innerHeight - barHeight;
          return (
            <Bar
              key={`bar-${x}`}
              x={barX}
              y={barY}
              width={barWidth}
              height={barHeight}
              fill="rgba(23, 233, 217, .5)"
              onMouseOver={() => onHover(datum)}
            />
          );
        })}
      </Group>
    </svg>
  );
}
