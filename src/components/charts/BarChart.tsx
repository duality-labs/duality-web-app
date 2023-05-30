import { useMemo } from 'react';
import { Bar } from '@visx/shape';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear } from '@visx/scale';

const verticalMargin = 40;

// accessors
const getX = (d: DataTuple) => d.x;
const getY = (d: DataTuple) => d.y;

interface DataTuple {
  x: string;
  y: number;
}

type BarChartProps = {
  data: DataTuple[];
  events?: boolean;
};

interface ChartProps extends BarChartProps {
  width: number;
  height: number;
}

export default function BarChart({ data, width, height }: ChartProps) {
  // bounds
  const xMax = width;
  const yMax = height - verticalMargin;

  // scales, memoize for performance
  const xScale = useMemo(
    () =>
      scaleBand<string>({
        range: [0, xMax],
        round: true,
        domain: data.map(getX),
        padding: 0.4,
      }),
    [xMax, data]
  );
  const yScale = useMemo(
    () =>
      scaleLinear<number>({
        range: [yMax, 0],
        round: true,
        domain: [0, Math.max(...data.map(getY))],
      }),
    [yMax, data]
  );

  return width < 10 ? null : (
    <svg width={width} height={height}>
      <Group top={verticalMargin / 2}>
        {data.map((d) => {
          const x = getX(d);
          const barWidth = xScale.bandwidth();
          const barHeight = yMax - (yScale(getY(d)) ?? 0);
          const barX = xScale(x);
          const barY = yMax - barHeight;
          return (
            <Bar
              key={`bar-${x}`}
              x={barX}
              y={barY}
              width={barWidth}
              height={barHeight}
              fill="rgba(23, 233, 217, .5)"
            />
          );
        })}
      </Group>
    </svg>
  );
}
