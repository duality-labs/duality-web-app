import React, { useCallback, useEffect, useRef, useState } from 'react';

import './Orbs.scss';

interface OrbsProps {
  rate: number;
}

export default function Orbs({ rate }: OrbsProps) {
  const [fullHeight, setfullHeight] = useState(0);
  const [fullWidth, setFullWidth] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const safeRate =
    !rate || rate === Infinity ? 1 : Math.min(Math.max(0.2, rate), 5);
  const baseOrbRadius = 50;
  const radiusA = baseOrbRadius * safeRate;
  const radiusB = baseOrbRadius / safeRate;
  const dx = fullWidth / 3;
  const xCenter = fullWidth / 2;
  const windowRatio = fullHeight / fullWidth;
  const reverseRatio = 1 / windowRatio;

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
      <div
        className="y-shrink"
        style={{ '--scale-ratio': windowRatio } as React.CSSProperties}
      >
        <div className="rotate-slow">
          <div
            className="orb-container counter-rotate-slow"
            style={{
              width: radiusA * 2,
              height: radiusA * 2,
              top: xCenter - radiusA,
              left: xCenter - dx - radiusA,
            }}
          >
            <div
              className="orb y-expand"
              style={{ '--scale-ratio': reverseRatio } as React.CSSProperties}
            ></div>
          </div>

          <div
            className="orb-container counter-rotate-slow"
            style={{
              width: radiusB * 2,
              height: radiusB * 2,
              top: xCenter - radiusB,
              left: xCenter + dx - radiusB,
            }}
          >
            <div
              className="orb y-expand"
              style={{ '--scale-ratio': reverseRatio } as React.CSSProperties}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}
