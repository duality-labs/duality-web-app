import { useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { alea } from 'seedrandom';

import useResizeObserver from '@react-hook/resize-observer';

import { useAnimation, useTransitionAnimation } from './backgrounds/hooks';

import './Stars.scss';

// set constant density of stars
// to that of about the design spec image (1359 stars over a 1441 x 519 image)
const starDensity = 1360 / (1440 * 520);
const maxStarDiameterPixels = 4.2;
const maxStarOpacity = 0.4;
const minStarBrightnessPeriodMS = 4000;
const maxStarBrightnessPeriodMS = 7000;
// about 20-30 frames per brightness cycle is enough resolution to look smooth
const brightnessRefreshRate = minStarBrightnessPeriodMS / 25;
const maxStarSpeed = 5; // pixels per second

// set "hyperjump" animation (on page navigation change) settings
// allow the stars to travel just a little longer than the planets (set in CSS)
// values determined empirically through a bit of trial and error :/
const displacementMs = 2750;
const displacementPx = 375;

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

let lastDrawTime = 0;
let lastCanvasWidth = 0;
let displacementMemory: number[] = [];
function draw(ctx: CanvasRenderingContext2D, offsetMs = 0): void {
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
  // unset all displacement memory longer than current star total
  if (displacementMemory.length !== starsTotal) {
    displacementMemory = displacementMemory.slice(0, starsTotal);
  }

  // loop through each star and generate a path for each
  const now = Date.now();
  for (let i = 0; i < starsTotal; i += 1) {
    // get placement
    const speed: number = random(maxStarSpeed / 100, maxStarSpeed, prng);
    // const displacement = (now / 1000 + globalOffsetMs) * speed;
    const displacementNow = (now / 1000 + offsetMs) * speed;
    const displacementLast = (lastDrawTime / 1000 + 0) * speed;
    const displacementIncrement = displacementNow - displacementLast;
    // correct the x placement only if needed
    const displacementNowWrapAdjusted =
      (canvasWidth === lastCanvasWidth
        ? displacementMemory[i]
        : // add adjustments for moving stars that either appear or disappear
        // due to a change in the screen size
        // canvas became either smaller or larger
        canvasWidth < lastCanvasWidth
        ? // canvas became smaller:
          // does the remembered point no longer fit on the page?
          // then place it somewhere spread across the new range
          // else keep the old value
          displacementMemory[i] &&
          (displacementMemory[i] + displacementIncrement) % lastCanvasWidth >
            canvasWidth
          ? displacementNow * 2
          : undefined
        : // canvas became larger:
        // if we have no memory of this point: add it as a new number
        // else keep the old value
        i >= displacementMemory.length
        ? // add the new star within the new area created by the larger canvas
          (displacementNow % (canvasWidth - lastCanvasWidth)) + lastCanvasWidth
        : undefined) ??
      // if no specific new value was set, default to memory or new point creation
      displacementMemory[i] ??
      displacementNow;
    const displacement = displacementNowWrapAdjusted + displacementIncrement;
    const x: number = displacement % canvasWidth;
    // save position for next time
    displacementMemory[i] = x;
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
  lastDrawTime = now;
  lastCanvasWidth = canvasWidth;
}

// check canvas and context before drawing entire canvas area
function drawOnCanvas(canvas: HTMLCanvasElement | null, offsetMs?: number) {
  if (canvas) {
    const context = canvas.getContext('2d');
    if (context) {
      // the offset width and height have been set from CSS rules
      // which have stretched the element to the window's extents
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      draw(context, offsetMs);
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

  // add animation for star opacity and/or movement
  const starrySkyAnimation = useCallback(function onStarrySkyAnimationFrame() {
    // just redraw canvas
    drawOnCanvas(canvasRef.current);
  }, []);
  useAnimation(starrySkyAnimation, brightnessRefreshRate);

  // add animation for star movement on navigation change
  const hyperjumpAnimation = useCallback(function onHyperjumpTransitionFrame(
    now: DOMHighResTimeStamp,
    progress: number,
    lastProgress: number
  ): void {
    // choose a line between cubic and quadratic ease-out lines
    // looks a bit like a standard ease-out curve but with a flatter start
    const getPercent = (progress: number) => {
      return (
        progress * easeOutCubic(progress) +
        (1 - progress) * easeOutQuad(progress)
      );
    };
    const percentDiff = getPercent(progress) - getPercent(lastProgress);
    // redraw canvas
    drawOnCanvas(canvasRef.current, percentDiff * displacementPx);
  },
  []);

  // play the transition when we change the top-level page: eg. /, /swap, /pools
  const mainRoute = useLocation()?.pathname.split('/').filter(Boolean)[0] || '';
  useTransitionAnimation(hyperjumpAnimation, [mainRoute], displacementMs);

  return <canvas className="stars-bg" ref={getCanvasRef}></canvas>;
}

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

function easeOutQuad(x: number): number {
  return 1 - Math.pow(1 - x, 2);
}
