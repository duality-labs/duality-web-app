import { useCallback, useMemo } from 'react';
import { Bar, Circle, LinePath } from '@visx/shape';
import { Group } from '@visx/group';
import { useTooltip } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { scaleLinear } from '@visx/scale';

import { ChartProps } from './Chart';
import { TimeSeriesRow } from '../stats/utils';

import './TimeSeriesLineChart.scss';

const verticalMargin = 40;
const horizontalMargin = 10; // leave enough space for point onHover circles

// accessors
const getX = ([unixTime]: TimeSeriesRow) => unixTime;
const getY = ([, values]: TimeSeriesRow) =>
  values.reduce((acc, value) => acc + value, 0);

interface TimeSeriesLineChartProps extends ChartProps<TimeSeriesRow> {
  width: number;
  height: number;
  onHover: (data?: TimeSeriesRow) => void;
}

export default function TimeSeriesLineChart({
  data,
  height,
  width,
  onHover,
}: TimeSeriesLineChartProps) {
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
  const xScale = useMemo(() => {
    return scaleLinear<number>({
      range: [0, innerWidth],
      round: true,
      domain:
        sortedData.length > 0
          ? [getX(sortedData[0]), getX(sortedData[sortedData.length - 1])]
          : [],
    });
  }, [innerWidth, sortedData]);
  const yScale = useMemo(
    () =>
      scaleLinear<number>({
        range: [innerHeight, 0],
        round: true,
        domain: [0, Math.max(...sortedData.map(getY))],
      }),
    [innerHeight, sortedData]
  );

  const { tooltipData, tooltipLeft, tooltipTop, showTooltip, hideTooltip } =
    useTooltip();

  // tooltip handler
  const handleTooltip = useCallback(
    (
      event: React.TouchEvent<SVGRectElement> | React.MouseEvent<SVGRectElement>
    ) => {
      const point = localPoint(event) || { x: 0 };
      const x = xScale.invert(point.x);
      const indexToRightOfX = sortedData.findIndex((d) => x <= getX(d));
      const selectedIndex = (() => {
        if (indexToRightOfX === undefined) return undefined;
        switch (true) {
          // no data to the right of this point: choose last data point
          case indexToRightOfX < 0:
            return sortedData.length - 1;
          // not enough data to compare with: choose first point
          case indexToRightOfX < 1:
            return 0;
          // compare the closest two points
          default: {
            const indexToLeftOfX = indexToRightOfX - 1;
            const xLeft = getX(sortedData[indexToLeftOfX]);
            const xRight = getX(sortedData[indexToRightOfX]);
            // test if left gap is smaller
            if (x - xLeft < xRight - x) {
              return indexToLeftOfX;
            } else {
              return indexToRightOfX;
            }
          }
        }
      })();
      const selectedData = sortedData[selectedIndex ?? -1];
      onHover(selectedData);
      if (selectedData !== undefined) {
        showTooltip({
          tooltipData: selectedData,
          tooltipLeft: xScale(getX(selectedData)),
          tooltipTop: yScale(getY(selectedData)),
        });
      }
    },
    [showTooltip, xScale, yScale, sortedData, onHover]
  );

  return width < 10 ? null : (
    <svg className="visx-line-chart" width={width} height={height}>
      <Group top={verticalMargin / 2} left={horizontalMargin / 2}>
        <LinePath
          x={(d) => xScale(getX(d)) ?? 0}
          y={(d) => yScale(getY(d)) ?? 0}
          data={data}
          stroke="rgba(23, 233, 217, .5)"
          strokeWidth={2}
        />
        {tooltipData && (
          <Circle
            className="visx-tooltip"
            cx={tooltipLeft}
            cy={tooltipTop}
            r={3.5}
            fill="blue"
            stroke="white"
            strokeWidth={1.5}
            pointerEvents="none"
          />
        )}
      </Group>
      {/* a single invisible Bar over the chart is used to place the tooltip */}
      <Bar
        width={width}
        height={height}
        fill="transparent"
        rx={0}
        onTouchStart={handleTooltip}
        onTouchMove={handleTooltip}
        onMouseMove={handleTooltip}
        onMouseLeave={() => hideTooltip()}
      />
    </svg>
  );
}
