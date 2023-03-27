import { useCallback } from 'react';

import './Stars.scss';

// set constant density of stars
// to that of about the design spec image (1359 stars over a 1441 x 519 image)
const starDensity = 1360 / (1440 * 520);
const maxStarDiameterPixels = 4.2;

function createGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0.4159, '#F9FAFB00');
  gradient.addColorStop(0.6631, '#4EB1E866'); // 40% opacity for all stars
  gradient.addColorStop(0.8439, '#FAF9FB00');
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

  // loop through each star and generate a path for each
  for (let i = 0; i < starsTotal; i += 1) {
    const x: number = random(0, canvasWidth);
    const y: number = random(0, canvasHeight);
    const radius = sizeDistribution(random(0, 1)) * maxStarDiameterPixels;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = createGradient(ctx, x, y - radius, 0, radius * 2);
    ctx.fill();
  }
  ctx.closePath();
}

export default function Stars() {
  // draw on canvas when first found
  const getCanvasRef = useCallback((canvas: HTMLCanvasElement) => {
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
  }, []);

  return <canvas className="stars-bg" ref={getCanvasRef}></canvas>;
}
