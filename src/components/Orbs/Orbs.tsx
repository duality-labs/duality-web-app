import { useCallback, useEffect, useRef, useState } from 'react';

import './Orbs.scss';

interface OrbsProps {
  rate: number;
}

export default function Orbs({ rate }: OrbsProps) {
  const [fullHeight, setfullHeight] = useState(0);
  const [fullWidth, setFullWidth] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const safeRate =
    rate === 0 || rate === Infinity ? 1 : Math.min(Math.max(0.1, rate), 10);
  const baseOrbRadius = 50;
  const radiusA = baseOrbRadius * safeRate;
  const radiusB = baseOrbRadius / safeRate;
  const dx = fullWidth / 3,
    xCenter = fullWidth / 2;
  const dy = (fullHeight * 3) / 7,
    yCenter = fullHeight / 2;
  const x0 = xCenter - dx,
    x1 = xCenter + dx;
  const y0 = yCenter - dy,
    y1 = yCenter + dy;
  const circlePath = `M ${x0}, ${yCenter}
        C ${x0}, ${y1}  ${x1}, ${y1} ${x1}, ${yCenter}
        C ${x1}, ${y0}  ${x0}, ${y0} ${x0}, ${yCenter}`;

  const updateDimensions = useCallback(function () {
    setfullHeight(bodyRef.current?.offsetHeight || 0);
    setFullWidth(bodyRef.current?.offsetWidth || 0);
  }, []);

  useEffect(() => {
    window.addEventListener('resize', updateDimensions);
    updateDimensions();
  }, [updateDimensions]);

  return (
    <div className="orbs-bg" ref={bodyRef}>
      <svg width={fullWidth} height={fullHeight}>
        <path
          d={circlePath}
          className="circle circle-a"
          style={{ strokeWidth: radiusA }}
        />
        <path
          d={circlePath}
          className="circle circle-b"
          style={{ strokeWidth: radiusB }}
        />
      </svg>
    </div>
  );
}
