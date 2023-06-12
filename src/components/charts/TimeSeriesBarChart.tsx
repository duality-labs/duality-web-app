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
const getX = (d: DataTuple) => d.x;
const getY = (d: DataTuple) => d.y;

interface DataTuple {
  x: string;
  y: number;
}

interface TimeSeriesBarChartProps extends ChartProps<TimeSeriesRow> {
  width: number;
  height: number;
  onHover: (data?: TimeSeriesRow) => void;
}

function useChartData(data: TimeSeriesRow[] | undefined) {
  // map data to chart
  return useMemo(() => {
    return data
      ?.map(([unixTime, values]) => {
        // add values here properly with price data
        return {
          x: unixTime.toFixed(),
          y: values.reduce((acc, value) => acc + value, 0),
        };
      })
      .reverse();
  }, [data]);
}

export default function TimeSeriesBarChart({
  data: timeSeries,
  height,
  width,
  onHover,
}: TimeSeriesBarChartProps) {
  // bounds
  const innerWidth = width - horizontalMargin;
  const innerHeight = height - verticalMargin;

  const data = useChartData(timeSeries || undefined);

  // scales, memoize for performance
  const xScale = useMemo(
    () =>
      scaleBand<string>({
        range: [0, innerWidth],
        round: true,
        domain: (data || []).map(getX),
        padding: 0.4,
      }),
    [innerWidth, data]
  );
  const yScale = useMemo(
    () =>
      scaleLinear<number>({
        range: [innerHeight, 0],
        round: true,
        domain: [0, Math.max(...(data || []).map(getY))],
      }),
    [innerHeight, data]
  );

  return width < 10 ? null : (
    <svg className="visx-bar-chart" width={width} height={height}>
      <Group top={verticalMargin / 2}>
        {timeSeries.reverse().map((data) => {
          const [unixTime, values] = data;
          // add values here properly with price data
          const d = {
            x: unixTime.toFixed(),
            y: values.reduce((acc, value) => acc + value, 0),
          };
          const x = getX(d);
          const barWidth = xScale.bandwidth();
          const barHeight = innerHeight - (yScale(getY(d)) ?? 0);
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
              onMouseOver={() => onHover(data)}
            />
          );
        })}
      </Group>
    </svg>
  );
}
