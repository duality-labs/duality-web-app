import { useCallback, useRef, useState } from 'react';
import useResizeObserver from '@react-hook/resize-observer';

import './OrderbookChartConnector.scss';

export type ConnectionLine = [y1: number, y2: number];
export type ConnectionArea = [
  ConnectionLine,
  ConnectionLine,
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
  connectionLines,
  connectionAreas,
  chartAreas,
  showIndividualBuckets,
  showCumulativeBuckets,
  setShowIndividualBuckets,
  setShowCumulativeBuckets,
}: {
  connectionLines?: ConnectionLine[];
  connectionAreas?: ConnectionArea[];
  chartAreas?: ChartArea[];
  showIndividualBuckets: boolean;
  showCumulativeBuckets: boolean;
  setShowIndividualBuckets: React.Dispatch<React.SetStateAction<boolean>>;
  setShowCumulativeBuckets: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  // improve toggling behaviour to behave like a 3 option state
  const toggleShowIndividualBuckets = useCallback(() => {
    setShowIndividualBuckets((show) => !show);
    setShowCumulativeBuckets(false);
  }, [setShowCumulativeBuckets, setShowIndividualBuckets]);
  const toggleShowCumulativeBuckets = useCallback(() => {
    setShowCumulativeBuckets((show) => !show);
    setShowIndividualBuckets(false);
  }, [setShowCumulativeBuckets, setShowIndividualBuckets]);

  const maxBucketExtent = showCumulativeBuckets ? 1 : 0.9;

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
        if (connectionLines?.length) {
          // note: I don't know why but these lines appear over the areas
          drawConnectionLines(ctx, connectionLines);
        }
        connectionAreas?.forEach((connectionArea) => {
          drawConnectionArea(ctx, connectionArea);
        });
        chartAreas?.forEach((chartArea) => {
          // draw chart areas within the container
          const [y1, y2] = chartArea;
          if (
            // if price is in container area
            (y1 >= 0 || y2 >= 0) &&
            (y1 <= height || y2 <= height)
          ) {
            drawChartArea(ctx, chartArea);
          }
        });
        // draw lines over buckets
        // note: yes this is duplicated: need to draw once over each element
        if (connectionLines?.length) {
          drawConnectionLines(ctx, connectionLines);
        }
      }

      // define drawing functions
      function drawConnectionLines(
        ctx: CanvasRenderingContext2D,
        connectionLines: ConnectionLine[]
      ) {
        ctx.lineWidth = 1;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'white';
        ctx.beginPath();
        connectionLines.forEach(([y1, y2]) => {
          ctx.moveTo(connectionCurve[0], sharpPoint(y1));
          ctx.lineTo(connectionCurve[1], sharpPoint(y1));
          ctx.bezierCurveTo(
            ...[connectionCurve[2], sharpPoint(y1)],
            ...[connectionCurve[3], y2],
            ...[connectionCurve[4], y2]
          );
          ctx.lineTo(connectionCurve[5], y2);
        });
        ctx.stroke();
      }

      // define drawing functions
      function drawConnectionArea(
        ctx: CanvasRenderingContext2D,
        connectionArea: ConnectionArea
      ) {
        const [[y1, y2], [y3, y4], weight, fill = 'white'] = connectionArea;
        // skip areas with no defined points
        if (!y1 || !y2 || !y3 || !y4) return;
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
        ctx.lineTo(weight * connectionCurve[1] * maxBucketExtent + 0.5, y1);
        // draw bottom line
        ctx.lineTo(weight * connectionCurve[1] * maxBucketExtent + 0.5, y2);
        ctx.lineTo(0, y2);
        // fill
        ctx.fill();
      }

      // use points centered at half-pixels for sharp lines
      function sharpPoint(value: number): number {
        return Math.round(value) + 0.5;
      }
    },
    [chartAreas, connectionAreas, connectionLines, maxBucketExtent]
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
    <div
      className="connector-container"
      ref={containerRef}
      style={
        showCumulativeBuckets
          ? styles.max
          : showIndividualBuckets
          ? styles.open
          : styles.closed
      }
    >
      <canvas className="flex" ref={getCanvasRef}></canvas>
      <div className="connection-controls col m-sm gap-3">
        <button
          className={['button', showIndividualBuckets && 'active']
            .filter(Boolean)
            .join(' ')}
          title="Bucket Depth"
          onClick={toggleShowIndividualBuckets}
        >
          <div className="button-box bg-red" style={styles.boxWidth1}></div>
          <div className="button-box bg-red" style={styles.boxWidth2}></div>
          <div className="button-box bg-red" style={styles.boxWidth3}></div>
          <div className="button-box bg-green" style={styles.boxWidth3}></div>
          <div className="button-box bg-green" style={styles.boxWidth2}></div>
          <div className="button-box bg-green" style={styles.boxWidth1}></div>
        </button>
        <button
          className={['button', showCumulativeBuckets && 'active']
            .filter(Boolean)
            .join(' ')}
          title="Cumulative Depth"
          onClick={toggleShowCumulativeBuckets}
        >
          <div className="button-box bg-red" style={styles.boxWidth5}></div>
          <div className="button-box bg-red" style={styles.boxWidth4}></div>
          <div className="button-box bg-red" style={styles.boxWidth2}></div>
          <div className="button-box bg-green" style={styles.boxWidth2}></div>
          <div className="button-box bg-green" style={styles.boxWidth4}></div>
          <div className="button-box bg-green" style={styles.boxWidth5}></div>
        </button>
      </div>
    </div>
  );
}

const styles = {
  max: {
    width: 96,
  },
  open: {
    width: 72,
  },
  closed: {
    width: 36,
  },
  boxWidth1: {
    width: '0.2em',
  },
  boxWidth2: {
    width: '0.45em',
  },
  boxWidth3: {
    width: '0.6em',
  },
  boxWidth4: {
    width: '0.6em',
  },
  boxWidth5: {
    width: '0.8em',
  },
};
