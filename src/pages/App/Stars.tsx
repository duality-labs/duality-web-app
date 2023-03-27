import { useCallback, useRef } from 'react';
import useResizeObserver from '@react-hook/resize-observer';

import './Stars.scss';

// set constant density of stars
// to that of about the design spec image (1359 stars over a 1441 x 519 image)
const starDensity = 1360 / (1440 * 520);
const maxStarDiameterPixels = 4.2;
const maxStarOpacity = 0.4;

function createGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha = 1
) {
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0.4159, 'rgba(249, 250, 251, 0)');
  gradient.addColorStop(0.6631, `rgba(78, 177, 232, ${alpha.toFixed(3)})`);
  gradient.addColorStop(0.8439, 'rgba(250, 249, 251, 0)');
  return gradient;
}

function sizeDistribution(percentile: number) {
  return percentile > 0.85855
    ? percentile * 3.5714 - 2.5714
    : percentile * 0.5417 + 0.0298;
}

function random(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function draw(ctx: CanvasRenderingContext2D): void {
  // get canvas and star stats
  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;
  const canvasSize = canvasWidth * canvasHeight;
  const starsTotal = canvasSize * starDensity;

  const [dimPointX, dimPointY] = [canvasWidth / 2, canvasHeight];
  const dimRadius = canvasWidth;

  // clear canvas
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // loop through each star and generate a path for each
  for (let i = 0; i < starsTotal; i += 1) {
    const x: number = random(0, canvasWidth);
    const y: number = random(0, canvasHeight);
    const radius = sizeDistribution(random(0, 1)) * maxStarDiameterPixels;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    // calculate how dim the star should be in relation to its distance to the dim point
    const dimDistance = Math.sqrt(
      Math.pow(x - dimPointX, 2) + Math.pow(y - dimPointY, 2)
    );
    const dimming = Math.max(0, (dimRadius - dimDistance) / dimRadius);
    const opacity = maxStarOpacity * (1 - dimming);
    ctx.fillStyle = createGradient(ctx, x, y - radius, 0, radius * 2, opacity);
    ctx.fill();
  }
  ctx.closePath();
}

// check canvas and context before drawing entire canvas area
function drawOnCanvas(canvas: HTMLCanvasElement | null) {
  if (canvas) {
    const context = canvas.getContext('2d');
    if (context) {
      // the offset width and height have been set from CSS rules
      // which have stretched the element to the window's extents
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      draw(context);
    }
  }
}

export default function Stars() {
  // store ref but also draw on canvas when first found
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const getCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
    drawOnCanvas(canvasRef.current);
  }, []);

  // redraw canvas when the screen size changes
  useResizeObserver(canvasRef, () => {
    drawOnCanvas(canvasRef.current);
  });

  return <canvas className="stars-bg" ref={getCanvasRef}></canvas>;
}
