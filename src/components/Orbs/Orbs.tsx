import React, { useCallback, useEffect, useRef, useState } from 'react';

import './Orbs.scss';

import Orb from '../Orb';

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
  const windowRatio = fullHeight / fullWidth || 1;
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
          <Orb
            left={xCenter - dx - radiusA}
            top={xCenter - radiusA}
            radius={radiusA}
            scaleRatio={reverseRatio}
          ></Orb>
          <Orb
            left={xCenter + dx - radiusB}
            top={xCenter - radiusB}
            radius={radiusB}
            scaleRatio={reverseRatio}
          ></Orb>
        </div>
      </div>
    </div>
  );
}
