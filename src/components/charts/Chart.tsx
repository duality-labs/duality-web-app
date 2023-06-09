import { useRef, useState } from 'react';
import useResizeObserver from '@react-hook/resize-observer';

import './Chart.scss';

export interface ChartProps<DataRow> {
  width: number;
  height: number;
  data: DataRow[];
  onHover: (data?: DataRow) => void;
}

export default function Chart<DataRow>({
  data,
  height,
  onHover,
  ChartComponent,
}: {
  height: number;
  data: DataRow[];
  onHover: (data?: DataRow) => void;
  ChartComponent: React.FunctionComponent<ChartProps<DataRow>>;
}) {
  // find container size to fit
  const chartContainer = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

  // redraw canvas when the screen size changes
  useResizeObserver(chartContainer, (container) =>
    setChartSize({
      width: container.contentRect.width,
      height: container.contentRect.height,
    })
  );
  return (
    <div
      className="visx-chart-area"
      ref={chartContainer}
      style={{ height }}
      onMouseLeave={() => onHover()}
      onBlur={() => onHover()}
    >
      <ChartComponent
        width={chartSize.width || 0}
        height={chartSize.height || 0}
        data={data}
        onHover={onHover}
      />
    </div>
  );
}
