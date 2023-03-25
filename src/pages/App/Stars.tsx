import { useCallback } from 'react';

import './Stars.scss';

// set constant density of stars
const starDensity = 1 / 2000;
const maxStarDiameterPixels = 5;

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
    const width: number = random(1, maxStarDiameterPixels);
    const height: number = width / 3;
    const alpha: number = random(0, 40);
    ctx.fillStyle = `#ffffff${alpha.toFixed(0)}`;
    ctx.fillRect(x, y, width, height);
  }
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
