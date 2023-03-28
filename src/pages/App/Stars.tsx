import { useCallback, useEffect, useRef } from 'react';
import { alea } from 'seedrandom';

import useResizeObserver from '@react-hook/resize-observer';

import './Stars.scss';

// set constant density of stars
// to that of about the design spec image (1359 stars over a 1441 x 519 image)
const starDensity = 1360 / (1440 * 520);
const maxStarDiameterPixels = 4.2;
const maxStarOpacity = 0.4;
const minStarBrightnessPeriodMS = 5000;
const maxStarBrightnessPeriodMS = 10000;
// about 20-30 frames per brightness cycle is enough resolution to look smooth
const brightnessRefreshRate = minStarBrightnessPeriodMS / 20;
const maxStarSpeed = 2.5; // pixels per second

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

function random(min: number, max: number, rng = Math.random) {
  return min + rng() * (max - min);
}

function draw(ctx: CanvasRenderingContext2D): void {
  // get canvas and star stats
  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;
  const canvasSize = canvasWidth * canvasHeight;
  const starsTotal = canvasSize * starDensity;

  const [dimPointX, dimPointY] = [canvasWidth / 2, canvasHeight];
  const dimRadius = canvasWidth;

  const prng = alea('duality');

  // clear canvas
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // loop through each star and generate a path for each
  const now = Date.now();
  for (let i = 0; i < starsTotal; i += 1) {
    // get placement
    const speed: number = random(maxStarSpeed / 100, maxStarSpeed, prng);
    const displacement = (now / 1000) * speed;
    const x: number = displacement % canvasWidth;
    const y: number = random(0, canvasHeight, prng);
    const radius = sizeDistribution(random(0, 1, prng)) * maxStarDiameterPixels;
    // get brightness
    const brightnessPeriodMs = random(
      minStarBrightnessPeriodMS,
      maxStarBrightnessPeriodMS,
      prng
    );
    const brightnessOffset = Math.sin((now / brightnessPeriodMs) * Math.PI * 2); // from -1 to 1
    const brightness = 0.5 + 0.5 * brightnessOffset; // from 0 to 1

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    // calculate how dim the star should be in relation to its distance to the dim point
    const dimDistance = Math.sqrt(
      Math.pow(x - dimPointX, 2) + Math.pow(y - dimPointY, 2)
    );
    const dimming = Math.max(0, (dimRadius - dimDistance) / dimRadius);
    const opacity = brightness * maxStarOpacity * (1 - dimming);
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

  // add animation
  useEffect(() => {
    let lastTimeStamp = 0;
    let animationFrame = window?.requestAnimationFrame(onFrame);
    return () => cancelAnimationFrame(animationFrame);

    function onFrame(timestamp: DOMHighResTimeStamp) {
      // don't animate too frequently: redraw only if enough time has passed
      if (timestamp - lastTimeStamp > brightnessRefreshRate) {
        lastTimeStamp = timestamp;
        // redraw canvas
        drawOnCanvas(canvasRef.current);
      }
      animationFrame = window?.requestAnimationFrame(onFrame);
    }
  }, []);

  return <canvas className="stars-bg" ref={getCanvasRef}></canvas>;
}
