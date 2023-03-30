/**
 * types
 */

type Point2D = [x: number, y: number];
type BezierCurve2D = [
  point1: Point2D,
  controlPoint1: Point2D,
  controlPoint2: Point2D,
  point2: Point2D
];

type Point3D = [x: number, y: number, z: number];
type BezierCurve3D = [
  point1: Point3D,
  controlPoint1: Point3D,
  controlPoint2: Point3D,
  point2: Point3D
];

// a function that can transform points from one cartesian plane to another
type PointTransformer = (point: Point3D) => Point3D;

/**
 * basic transformations
 */

export function transformPoint2Dto3D([x, y]: Point2D): Point3D {
  return [x, y, 0];
}
export function transformBezier2Dto3D(curve: BezierCurve2D): BezierCurve3D {
  return curve.map<Point3D>(transformPoint2Dto3D) as BezierCurve3D;
}

export function transformPoint3Dto2D([x, y, _]: Point3D): Point2D {
  return [x, y];
}
export function transformBezier3Dto2D(curve: BezierCurve3D): BezierCurve2D {
  return curve.map<Point2D>(transformPoint3Dto2D) as BezierCurve2D;
}

/**
 * path functions
 */

export function draw2DBezierPath(
  context: CanvasRenderingContext2D,
  path: BezierCurve2D[]
) {
  context.beginPath();

  // move to first point
  const [[initialPoint]] = path;
  context.moveTo(...initialPoint);

  // curve through the path
  // assuming that this path is continuous, i.e. point 1 of n is point 2 of n-1
  path.forEach(([_, controlPoint1, controlPoint2, point2]: BezierCurve2D) => {
    context.bezierCurveTo(...controlPoint1, ...controlPoint2, ...point2);
  });

  context.closePath();
}

export function draw3DBezierPath(
  context: CanvasRenderingContext2D,
  path: BezierCurve3D[],
  pointTransformer: PointTransformer
) {
  context.beginPath();

  // move to first point
  const [[initialPoint]] = path;
  context.moveTo(...transformPoint3Dto2D(pointTransformer(initialPoint)));

  // curve through the path
  // assuming that this path is continuous, i.e. point 1 of n is point 2 of n-1
  path.forEach(([_, controlPoint1, controlPoint2, point2]: BezierCurve3D) => {
    context.bezierCurveTo(
      ...transformPoint3Dto2D(pointTransformer(controlPoint1)),
      ...transformPoint3Dto2D(pointTransformer(controlPoint2)),
      ...transformPoint3Dto2D(pointTransformer(point2))
    );
  });

  context.closePath();
}

// radius factor to best approximate circles using bezier curves
const bezierCircleFactor = (4 / 3) * Math.tan(Math.PI / 2 / 4);
export function createBezierCircle2D(
  radius: number,
  [xOrigin, yOrigin]: Point2D = [0, 0]
): BezierCurve2D[] {
  const f = bezierCircleFactor;
  const unitCircle: BezierCurve2D[] = [
    [
      [1, 0],
      [1, f],
      [f, 1],
      [0, 1],
    ],
    [
      [0, 1],
      [-f, 1],
      [-1, f],
      [-1, 0],
    ],
    [
      [-1, 0],
      [-1, -f],
      [-f, -1],
      [0, -1],
    ],
    [
      [0, -1],
      [f, -1],
      [1, -f],
      [1, 0],
    ],
  ];
  return unitCircle.map<BezierCurve2D>((curve: BezierCurve2D) => {
    return curve.map<Point2D>(([x, y]: Point2D) => {
      // translate point to desired size and position
      return [x * radius + xOrigin, y * radius + yOrigin];
    }) as BezierCurve2D;
  });
}

export function createBezierCircle3D(
  radius: number,
  [x, y, z]: Point3D = [0, 0, 0]
): BezierCurve3D[] {
  // create circle at z = 0
  const bezierCircle2D = createBezierCircle2D(radius, [x, y]);
  const circle = bezierCircle2D.map<BezierCurve3D>(transformBezier2Dto3D);
  // add z information if desired
  return z === 0
    ? circle
    : circle.map<BezierCurve3D>((curve: BezierCurve3D) => {
        return curve.map<Point3D>(([x, y]: Point3D) => [
          x,
          y,
          z,
        ]) as BezierCurve3D;
      });
}

/**
 * main 3D transformation logic
 */

export function getPointTransformer(
  // use typical CSS properties as basis for transformation
  [rotationX, rotationY] = [0, 0],
  perspectiveDistance = 1000,
  perspectiveOrigin: Point3D = [0, 0, 0],
  // optional and helpful to move points after transformation
  [translateX, translateY] = [0, 0]
): PointTransformer {
  // find the vector representing looking at the view point from the origin
  const perspectiveVector = [
    perspectiveDistance * Math.sin(rotationY) * Math.cos(rotationX),
    perspectiveDistance * Math.sin(rotationY) * Math.sin(rotationX),
    perspectiveDistance * Math.cos(rotationX),
  ];

  // find the perspective's view point
  const perspectivePoint: Point3D = [
    perspectiveVector[0] - perspectiveOrigin[0],
    perspectiveVector[1] - perspectiveOrigin[1],
    perspectiveVector[2] - perspectiveOrigin[2],
  ];

  // define plane function: ax + by + cz + d = 0
  // coefficients a, b, c are the normal vector coordinates
  const [a, b, c] = perspectiveVector;
  // get plane coefficient d from the dot product of normal vector and origin point
  const d = [
    perspectiveVector[0] * perspectiveOrigin[0],
    perspectiveVector[1] * perspectiveOrigin[1],
    perspectiveVector[2] * perspectiveOrigin[2],
  ].reduce((sum, value) => sum + value, 0);

  // the following code is adapted from: https://stackoverflow.com/questions/5666222/3d-line-plane-intersection#45362069
  // we can precompute the numerator factor given a set perspective and plane
  const [px, py, pz] = perspectivePoint;
  const t = -(a * px + b * py + c * pz + d);

  // for any point q: find its intersection with the specified plane
  return function pointTransformer([qx, qy, qz]: Point3D): Point3D {
    const tDenom = a * (qx - px) + b * (qy - py) + c * (qz - pz);
    // return point if it is already lying inside the plane
    if (tDenom === 0) return [qx, qy, qz];

    // compute new point by projecting from the perspective point
    return [
      px + (t / tDenom) * (qx - px) + translateX,
      py + (t / tDenom) * (qy - py) + translateY,
      pz + (t / tDenom) * (qz - pz),
    ];
  };
}

/**
 * util functions
 */

export function random(min: number, max: number, rng = Math.random) {
  return min + rng() * (max - min);
}

export function between(
  min: number,
  max: number,
  signedOffset: number
): number {
  const identityOffset = (signedOffset + 1) / 2;
  return min + identityOffset * (max - min);
}

// check canvas and context before drawing entire canvas area
export function getContextWithOriginAtMidpoint(
  canvas: HTMLCanvasElement | null,
  clear = true
): CanvasRenderingContext2D | undefined {
  if (canvas) {
    const context = canvas.getContext('2d');
    if (context) {
      // set basis of canvas work to have the center point as 0,0
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.translate(canvas.width / 2, canvas.height / 2);
      if (clear) {
        context.clearRect(
          -canvas.width / 2,
          -canvas.height / 2,
          canvas.width,
          canvas.height
        );
      }
      return context;
    }
  }
}
