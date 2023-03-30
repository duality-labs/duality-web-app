import { CSSProperties, useCallback, useEffect, useRef } from 'react';
import { alea } from 'seedrandom';
import {
  BezierCurve3D,
  createBezierCircle2D,
  createBezierCircle3D,
  draw2DBezierPath,
  draw3DBezierPath,
  getContextWithOriginAtMidpoint,
  getPointTransformer,
  translate3D,
} from './utils';

const canvasWidth = 1000;
const canvasHeight = 400;
const planetRadiusPx = 100;
const ringsTotal = 12;
const ringMinRadiusPx = 180;
const ringMaxRadiusPx = 580;

const orbitRefreshRateHz = 10;

function random(min: number, max: number, rng = Math.random) {
  return min + rng() * (max - min);
}

function between(min: number, max: number, signedOffset: number): number {
  const identityOffset = (signedOffset + 1) / 2;
  return min + identityOffset * (max - min);
}

function draw(ctx: CanvasRenderingContext2D): void {
  const prng = alea('duality');

  // draw rings
  const now = Date.now();
  const radianDynamic = ((now / 4000) % Math.PI) * 2;
  const zHeight = 30;
  const sineWavePeriod = Math.PI;
  const maxControlHeight =
    (zHeight * sineWavePeriod) /
    (Math.PI * 2) /
    ((4 / 3) * Math.tan(Math.PI / 2 / 4));

  const rings = Array.from({ length: ringsTotal }).map((_, i) => {
    // make inner orbits thicker than outer orbits
    const lineWidth = 1 + 2 * (1 - i / ringsTotal);
    // add some randomness to the ring intervals
    const ringInterval = (ringMaxRadiusPx - ringMinRadiusPx) / ringsTotal;
    const ringRadius =
      ringMinRadiusPx + (i + random(-0.125, 0.125, prng)) * ringInterval;

    const ring = createBezierCircle3D(ringRadius, [0, 0, 0]);
    const modifiedRing = ring.map(
      (
        [point1, controlPoint1, controlPoint2, point2],
        index,
        rings
      ): BezierCurve3D => {
        // find height at all points on the curve
        const radianStart = (index / rings.length) * 2 * Math.PI;
        const radianEnd = ((index + 1) / rings.length) * 2 * Math.PI;
        const startHeight = zHeight * Math.sin(radianDynamic + radianStart);
        const startControlHeight =
          startHeight +
          maxControlHeight * Math.cos(radianDynamic + radianStart);
        const endHeight = zHeight * Math.sin(radianDynamic + radianEnd);
        const endControlHeight =
          endHeight - maxControlHeight * Math.cos(radianDynamic + radianEnd);
        return [
          translate3D(point1, [0, 0, startHeight]),
          translate3D(controlPoint1, [0, 0, startControlHeight]),
          translate3D(controlPoint2, [0, 0, endControlHeight]),
          translate3D(point2, [0, 0, endHeight]),
        ];
      }
    );

    // and some glowing (high-saturated colors cycling on dark background)
    // oscillate between defined gradient color stops
    // the i part of the factor makes it look like colors "travel outward"
    const factor = Math.sin(now / 3000 + random(0, 2 * Math.PI, prng));
    const hsla = [
      // oscillate the color parts together
      between(175, 211, factor).toFixed(0),
      between(92, 67, factor).toFixed(0) + '%',
      between(30, 45, factor).toFixed(0) + '%',
      // adjust the opacity separately for a "layered opacity twinkle" effect
      between(0.5, 1, Math.sin((now / 2000) * random(1, 2, prng))).toFixed(3),
    ];

    return [lineWidth, modifiedRing, hsla] as [
      number,
      BezierCurve3D[],
      string[]
    ];
  });

  // draw scene in parts
  // draw rings behind the planet
  rings.forEach(([lineWidth, ring, hsla]) => {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = `hsla(${hsla.join(', ')})`;
    draw3DBezierPath(
      ctx,
      ring.slice(0 - ring.length / 2),
      pointTransformer,
      false
    );
    ctx.stroke();
  });

  // draw planet
  const planetX = 190;
  const planetY = 30;
  const planet = createBezierCircle2D(planetRadiusPx, [190, 30]);
  draw2DBezierPath(ctx, planet);
  const lightRadius = -50;
  const gradient = ctx.createRadialGradient(
    planetX - planetRadiusPx * 0.2 + lightRadius * Math.sin(radianDynamic),
    planetY - planetRadiusPx * 1.2 + lightRadius * Math.cos(radianDynamic),
    0,
    planetX - planetRadiusPx * 0.2,
    planetY - planetRadiusPx * 1.2,
    planetRadiusPx * 3
  );
  gradient.addColorStop(0.14, 'hsl(180, 79%, 29%)');
  gradient.addColorStop(0.21, 'hsl(181, 78%, 28%)');
  gradient.addColorStop(0.32, 'hsl(184, 75%, 25%)');
  gradient.addColorStop(0.61, 'hsl(216, 57%, 13%)');
  gradient.addColorStop(0.62, 'hsl(221, 55%, 12%)');

  ctx.fillStyle = gradient;
  ctx.fill();

  // draw rings in front of planet
  rings.forEach(([lineWidth, ring, hsla]) => {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = `hsla(${hsla.join(', ')})`;
    draw3DBezierPath(
      ctx,
      ring.slice(0, ring.length / 2),
      pointTransformer,
      false
    );
    ctx.stroke();
  });
}

// check canvas and context before drawing entire canvas area
function drawOnCanvas(canvas: HTMLCanvasElement | null) {
  const context = getContextWithOriginAtMidpoint(canvas);
  if (context) draw(context);
}

export default function TradePlanet({
  active = false,
  className,
  style,
}: {
  active?: boolean;
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
    if (!active) return;
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
  }, [active]);

  return (
    <canvas
      className={['planet--trade', active && 'active', className]
        .filter(Boolean)
        .join(' ')}
      ref={getCanvasRef}
      style={style}
      width={canvasWidth}
      height={canvasHeight}
    />
  );
}

// define our specific perspective transformation here
const pointTransformer = getPointTransformer(
  // rotation X and Y
  [Math.PI / 2.4, Math.PI / 6],
  // perspective distance
  1500,
  // perspective origin
  [0, 0, 0],
  // translate points after transformation
  [190, 30]
);
