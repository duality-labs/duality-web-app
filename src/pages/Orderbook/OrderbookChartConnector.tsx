import { useCallback, useState } from 'react';
import useResizeObserver from '@react-hook/resize-observer';

import './OrderbookChartConnector.scss';

type ConnectionPoint = [number, number];

export default function OrderbookChartConnector({
  connectionPoints,
}: {
  connectionPoints?: ConnectionPoint[];
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

      // use points centered at half-pixels for sharp lines
      function sharpPoint(value: number): number {
        return Math.round(value) + 0.5;
      }
    },
    [connectionPoints]
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
