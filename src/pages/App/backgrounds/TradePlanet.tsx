import { CSSProperties, useCallback, useEffect, useRef } from 'react';
import { alea } from 'seedrandom';

const canvasWidth = 1200;
const canvasHeight = 1200;
const ringsTotal = 12;
const ringMinRadiusPx = 190;
const ringMaxRadiusPx = 600;

const orbitRefreshRateHz = 10;

function random(min: number, max: number, rng = Math.random) {
  return min + rng() * (max - min);
}

function between(min: number, max: number, signedOffset: number): number {
  const identityOffset = (signedOffset + 1) / 2;
  return min + identityOffset * (max - min);
}

function draw(ctx: CanvasRenderingContext2D): void {
  // get canvas and star stats
  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;

  const prng = alea('duality');

  // clear canvas
  ctx.clearRect(-canvasWidth / 2, -canvasHeight / 2, canvasWidth, canvasHeight);

  // loop through each star and generate a path for each
  const now = Date.now();
  for (let i = 0; i < ringsTotal; i += 1) {
    ctx.beginPath();

    // draw rings
    for (let i = 0; i < ringsTotal; i += 1) {
      ctx.lineWidth = 8 * (1 - i / ringsTotal) + 1;
      ctx.beginPath();
      // add some randomness to the ring intervals
      const ringInterval = (ringMaxRadiusPx - ringMinRadiusPx) / ringsTotal;
      const ringRadius =
        ringMinRadiusPx + (i + random(-0.5, 0.5, prng)) * ringInterval;
      ctx.arc(0, 0, ringRadius, 0, 2 * Math.PI);
      // and some glowing (high-saturated colors cycling on dark background)
      // oscillate between defined gradient color stops
      // the i part of the factor makes it look like colors "travel outward"
      const factor = Math.sin(now / 3000 + random(0, 2 * Math.PI, prng));
      const hsla = [
        // oscillate the color parts together
        between(175, 211, factor).toFixed(0),
        // added saturation and lightness to compenstate for less opacity
        between(92 + 8, 67 + 8, factor).toFixed(0) + '%',
        between(30 + 8, 45 + 8, factor).toFixed(0) + '%',
        // adjust the opacity separately for a "layered opacity twinkle" effect
        between(0, 0.75, Math.sin((now / 2000) * random(1, 2, prng))).toFixed(
          3
        ),
      ];
      ctx.strokeStyle = `hsla(${hsla.join(', ')})`;
      ctx.stroke();
    }
  }
  ctx.closePath();
}

// check canvas and context before drawing entire canvas area
function drawOnCanvas(canvas: HTMLCanvasElement | null) {
  if (canvas) {
    const context = canvas.getContext('2d');
    if (context) {
      // set basis of canvas work to have the center point as 0,0
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.translate(canvas.height / 2, canvas.height / 2);
      context.clearRect(
        -canvasWidth / 2,
        -canvasHeight / 2,
        canvasWidth,
        canvasHeight
      );
      draw(context);
    }
  }
}

export default function TradePlanet({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  // store ref but also draw on canvas when first found
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const getCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
    drawOnCanvas(canvasRef.current);
  }, []);

  // add animation
  useEffect(() => {
    let lastTimeStamp = 0;
    let animationFrame = window?.requestAnimationFrame(onFrame);
    return () => cancelAnimationFrame(animationFrame);

    function onFrame(timestamp: DOMHighResTimeStamp) {
      // don't animate too frequently: redraw only if enough time has passed
      // and animate only if user allows it
      if (timestamp - lastTimeStamp > 1000 / orbitRefreshRateHz) {
        lastTimeStamp = timestamp;
        // redraw canvas
        drawOnCanvas(canvasRef.current);
      }
      animationFrame = window?.requestAnimationFrame(onFrame);
    }
  }, []);

  return (
    <div
      className={['planet-perspective-container', className]
        .filter(Boolean)
        .join(' ')}
      style={{
        ...styles.planetContainer,
        ...style,
      }}
    >
      <canvas
        className={'planet--trade'}
        ref={getCanvasRef}
        style={styles.planet}
        width={canvasWidth}
        height={canvasHeight}
      />
    </div>
  );
}

// define styles here because they are mostly unique to this image
const styles: { [className: string]: CSSProperties } = {
  planetContainer: {
    position: 'fixed',
    width: 1000,
    height: 400,
    perspective: 800,
    perspectiveOrigin: '900px 900px',
  },
  planet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: canvasWidth,
    height: canvasHeight,
    transform: 'rotateX(38.5deg) rotateY(351deg)',
    scale: '1',
    translate: '100px 435px',
  },
};
