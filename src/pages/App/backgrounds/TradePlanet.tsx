import { CSSProperties, useCallback, useRef } from 'react';
import { alea } from 'seedrandom';

import { useAnimation } from './hooks';
import {
  BezierCurve3D,
  createBezierCircle2D,
  draw2DBezierPath,
  draw3DBezierPath,
  getContextWithOriginAtMidpoint,
  getPointTransformer,
  splitBezier2D,
  transformBezier2Dto3D,
  translate3D,
} from './utils';

const canvasWidth = 1000;
const canvasHeight = 400;
const planetRadiusPx = 100;
const planetX = 190;
const planetY = 30;
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
  const maxControlHeight = Math.PI;

  const rings = Array.from({ length: ringsTotal }).map((_, i) => {
    // make inner orbits thicker than outer orbits
    const lineWidth = 1 + 2 * (1 - i / ringsTotal);
    // add some randomness to the ring intervals
    const ringInterval = (ringMaxRadiusPx - ringMinRadiusPx) / ringsTotal;
    const ringRadius =
      ringMinRadiusPx + (i + random(-0.125, 0.125, prng)) * ringInterval;

    const ring = createBezierCircle2D(ringRadius, [0, 0])
      // split curve to have more points available
      .flatMap((curve) => splitBezier2D(curve))
      .map<BezierCurve3D>(transformBezier2Dto3D);
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
        const startHeightDelta =
          zHeight * Math.sin(radianDynamic + radianStart + 0.1) - startHeight;
        const startControlHeight =
          startHeight + startHeightDelta * maxControlHeight;
        const endHeight = zHeight * Math.sin(radianDynamic + radianEnd);
        const endHeightDelta =
          zHeight * Math.sin(radianDynamic + radianEnd + 0.1) - endHeight;
        const endControlHeight = endHeight - endHeightDelta * maxControlHeight;
        return [
          translate3D(point1, [0, 0, startHeight]),
          translate3D(controlPoint1, [0, 0, startControlHeight]),
          translate3D(controlPoint2, [0, 0, endControlHeight]),
          translate3D(point2, [0, 0, endHeight]),
        ];
      }
    );

    // and some glowing (high-saturated colors cycling on dark background)
    // rotate background gradient colors similar to given in design spec image
    // get offset between -1 and 1
    const betweenOffset = (2 * i) / (ringsTotal - 1) - 1;
    const hsl = [
      // oscillate the color parts together
      between(175, 211, betweenOffset).toFixed(0),
      between(92, 67, betweenOffset).toFixed(0) + '%',
      between(30, 45, betweenOffset).toFixed(0) + '%',
    ];
    const hslInverse = [
      // oscillate the color parts together
      between(211, 175, betweenOffset).toFixed(0),
      between(67, 92, betweenOffset).toFixed(0) + '%',
      between(45, 30, betweenOffset).toFixed(0) + '%',
    ];
    const gradientRotation = radianDynamic + (i / ringsTotal) * Math.PI * 1.5;
    const gradientX = Math.cos(gradientRotation);
    const gradientY = Math.sin(gradientRotation);
    const gradient = ctx.createLinearGradient(
      -ringRadius * gradientX + planetX,
      (-ringRadius * gradientY) / 2 + planetY,
      ringRadius * gradientX + planetX,
      (ringRadius * gradientY) / 2 + planetY
    );
    gradient.addColorStop(0, `hsl(${hsl.join(', ')})`);
    gradient.addColorStop(1, `hsl(${hslInverse.join(', ')})`);

    return [lineWidth, modifiedRing, gradient] as [
      number,
      BezierCurve3D[],
      CanvasGradient
    ];
  });

  // draw scene in parts
  // draw rings behind the planet
  rings.forEach(([lineWidth, ring, gradient]) => {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = gradient;
    draw3DBezierPath(
      ctx,
      ring.slice(0 - ring.length / 2),
      pointTransformer,
      false
    );
    ctx.stroke();
  });

  // draw planet
  const planet = createBezierCircle2D(planetRadiusPx, [planetX, planetY]);
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

  ctx.shadowColor = 'hsla(177, 87%, 29%, 0.66)';
  ctx.shadowBlur = 25;
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.shadowBlur = 0;

  // draw rings in front of planet
  rings.forEach(([lineWidth, ring, gradient]) => {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = gradient;
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
  const planetWobbleAnimation = useCallback(() => {
    // redraw canvas
    drawOnCanvas(canvasRef.current);
  }, []);
  useAnimation(planetWobbleAnimation, orbitRefreshRateHz);

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
