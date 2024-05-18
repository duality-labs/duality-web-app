import { useCallback, useState } from 'react';
import useResizeObserver from '@react-hook/resize-observer';

import './OrderbookChartConnector.scss';

type ConnectionPoint = [number, number];
type ConnectionArea = [ConnectionPoint, ConnectionPoint, weight: number];

export default function OrderbookChartConnector({
  connectionPoints,
  connectionAreas,
}: {
  connectionPoints?: ConnectionPoint[];
  connectionAreas?: ConnectionArea[];
}) {
  // define what to draw
  const draw = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        // reset canvas
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
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
      }

      // define drawing functions
      function drawConnectionPoints(
        ctx: CanvasRenderingContext2D,
        connectionPoints: ConnectionPoint[],
        width: number = ctx.canvas.width
      ) {
        ctx.lineWidth = 1;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'white';
        ctx.beginPath();
        connectionPoints.forEach(([y1, y2]) => {
          ctx.moveTo(sharpPoint(0), sharpPoint(y1));
          ctx.lineTo(sharpPoint(0.4 * width), sharpPoint(y1));
          ctx.bezierCurveTo(
            ...[sharpPoint(0.75 * width), sharpPoint(y1)],
            ...[sharpPoint(0.65 * width), sharpPoint(y2)],
            ...[sharpPoint(width - 1), sharpPoint(y2)]
          );
          ctx.lineTo(sharpPoint(width), sharpPoint(y2));
        });
        ctx.stroke();
      }

      // define drawing functions
      function drawConnectionArea(
        ctx: CanvasRenderingContext2D,
        connectionArea: ConnectionArea,
        width: number = ctx.canvas.width
      ) {
        const [[y1, y2], [y3, y4], weight] = connectionArea;
        ctx.lineJoin = 'round';
        ctx.fillStyle = 'white';
        ctx.filter = `opacity(${weight})`;
        ctx.beginPath();
        // draw top line
        ctx.moveTo(sharpPoint(0), sharpPoint(y1));
        ctx.lineTo(sharpPoint(0.4 * width), sharpPoint(y1));
        ctx.bezierCurveTo(
          ...[sharpPoint(0.75 * width), sharpPoint(y1)],
          ...[sharpPoint(0.65 * width), sharpPoint(y2)],
          ...[sharpPoint(width - 1), sharpPoint(y2)]
        );
        ctx.lineTo(sharpPoint(width), sharpPoint(y2));
        // draw bottom line
        ctx.lineTo(sharpPoint(width), sharpPoint(y4));
        ctx.lineTo(sharpPoint(width - 1), sharpPoint(y4));
        ctx.bezierCurveTo(
          ...[sharpPoint(0.65 * width), sharpPoint(y4)],
          ...[sharpPoint(0.75 * width), sharpPoint(y3)],
          ...[sharpPoint(0.4 * width), sharpPoint(y3)]
        );
        ctx.lineTo(sharpPoint(0), sharpPoint(y3));
        // fill
        ctx.fill();
      }

      // use points centered at half-pixels for sharp lines
      function sharpPoint(value: number): number {
        return Math.round(value) + 0.5;
      }
    },
    [connectionAreas, connectionPoints]
  );

  // store ref but also draw on canvas when first found
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const getCanvasRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      setCanvas(canvas);
      draw(canvas);
    },
    [draw]
  );

  // redraw canvas when the screen size changes
  useResizeObserver(canvas, () => draw(canvas));

  return <canvas className="flex" ref={getCanvasRef}></canvas>;
}
