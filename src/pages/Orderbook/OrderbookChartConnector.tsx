import { useCallback, useRef, useState } from 'react';
import useResizeObserver from '@react-hook/resize-observer';

import './OrderbookChartConnector.scss';

type ConnectionPoint = [number, number];
export type ConnectionArea = [
  ConnectionPoint,
  ConnectionPoint,
  weight: number,
  fillColor?: string | CanvasGradient | CanvasPattern
];
export type ChartArea = [
  y1: number,
  y2: number,
  weight: number,
  fillColor?: string | CanvasGradient | CanvasPattern
];

export default function OrderbookChartConnector({
  connectionPoints,
  connectionAreas,
  chartAreas,
}: {
  connectionPoints?: ConnectionPoint[];
  connectionAreas?: ConnectionArea[];
  chartAreas?: ChartArea[];
}) {
  // define what to draw
  const draw = useCallback(
    (canvas: HTMLCanvasElement | null, container: HTMLDivElement | null) => {
      const ctx = canvas?.getContext('2d');

      const connectionCurve = ctx
        ? [
            0,
            ctx.canvas.width - 30,
            ctx.canvas.width - 10,
            ctx.canvas.width - 15,
            ctx.canvas.width - 1,
            ctx.canvas.width,
          ]
        : [];

      if (container && canvas && ctx) {
        // reset canvas
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;
        const width = canvas.width;
        const height = canvas.height;
        ctx?.clearRect(0, 0, width, height);
        // draw elements
        if (connectionPoints?.length) {
          drawConnectionPoints(ctx, connectionPoints);
        }
        connectionAreas?.forEach((connectionArea) => {
          drawConnectionArea(ctx, connectionArea);
        });
        chartAreas?.forEach((chartArea) => {
          drawChartArea(ctx, chartArea);
        });
      }

      // define drawing functions
      function drawConnectionPoints(
        ctx: CanvasRenderingContext2D,
        connectionPoints: ConnectionPoint[]
      ) {
        ctx.lineWidth = 1;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'white';
        ctx.beginPath();
        connectionPoints.forEach(([y1, y2]) => {
          ctx.moveTo(sharpPoint(connectionCurve[0]), sharpPoint(y1));
          ctx.lineTo(sharpPoint(connectionCurve[1]), sharpPoint(y1));
          ctx.bezierCurveTo(
            ...[sharpPoint(connectionCurve[2]), sharpPoint(y1)],
            ...[sharpPoint(connectionCurve[3]), sharpPoint(y2)],
            ...[sharpPoint(connectionCurve[4]), sharpPoint(y2)]
          );
          ctx.lineTo(sharpPoint(connectionCurve[5]), sharpPoint(y2));
        });
        ctx.stroke();
      }

      // define drawing functions
      function drawConnectionArea(
        ctx: CanvasRenderingContext2D,
        connectionArea: ConnectionArea
      ) {
        const [[y1, y2], [y3, y4], weight, fill = 'white'] = connectionArea;
        ctx.lineJoin = 'round';
        ctx.fillStyle = fill;
        ctx.filter = `opacity(${weight})`;
        ctx.beginPath();
        // draw top line
        ctx.moveTo(connectionCurve[0], y1);
        ctx.lineTo(connectionCurve[1], y1);
        ctx.bezierCurveTo(
          ...[connectionCurve[2], y1],
          ...[connectionCurve[3], y2],
          ...[connectionCurve[4], y2]
        );
        ctx.lineTo(connectionCurve[5], y2);
        // draw bottom line
        ctx.lineTo(connectionCurve[5], y4);
        ctx.lineTo(connectionCurve[4], y4);
        ctx.bezierCurveTo(
          ...[connectionCurve[3], y4],
          ...[connectionCurve[2], y3],
          ...[connectionCurve[1], y3]
        );
        ctx.lineTo(connectionCurve[0], y3);
        // fill
        ctx.fill();
      }

      // define drawing functions
      function drawChartArea(
        ctx: CanvasRenderingContext2D,
        chartArea: ChartArea
      ) {
        const [y1, y2, weight, fill = 'white'] = chartArea;
        ctx.fillStyle = fill;
        ctx.filter = 'opacity(1)';
        ctx.beginPath();
        // draw top line
        ctx.moveTo(0, y1);
        ctx.lineTo(weight * connectionCurve[1] + 0.5, y1);
        // draw bottom line
        ctx.lineTo(weight * connectionCurve[1] + 0.5, y2);
        ctx.lineTo(0, y2);
        // fill
        ctx.fill();
      }

      // use points centered at half-pixels for sharp lines
      function sharpPoint(value: number): number {
        return Math.round(value) + 0.5;
      }
    },
    [chartAreas, connectionAreas, connectionPoints]
  );

  // store ref but also draw on canvas when first found
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const getCanvasRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      setCanvas(canvas);
      draw(canvas, containerRef.current);
    },
    [draw]
  );

  // redraw canvas when the screen size changes
  const containerRef = useRef<HTMLDivElement | null>(null);
  useResizeObserver(containerRef, () => draw(canvas, containerRef.current));

  return (
    <div className="connector-container" ref={containerRef}>
      <canvas className="flex" ref={getCanvasRef}></canvas>
    </div>
  );
}
