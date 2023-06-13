import { useMatch } from 'react-router-dom';
import React, { useMemo } from 'react';

import planetSwapSVG from '../../assets/planets/planet-swap.svg';
import planetLiquiditySVG from '../../assets/planets/planet-liquidity.svg';

import './Planets.scss';

const planets: { [planetName: string]: string | undefined } = {
  swap: planetSwapSVG,
  pools: planetLiquiditySVG,
};

export default function Planets() {
  return (
    <>
      <Planet name="swap" bottom={0} width={947} right={0} />
      <Planet name="pairs" top="10vh" width={774} right={0} />
    </>
  );
}

function Planet({
  name,
  src = planets[name],
  className,
  top,
  bottom,
  left,
  right,
  width = '100%',
}: {
  name: string;
  src?: string;
  className?: string;
  style?: React.CSSProperties;
  top?: number | string;
  bottom?: number | string;
  left?: number | string;
  right?: number | string;
  width?: number | string;
}) {
  const active = useMatch(name);
  const style = useMemo(() => {
    return {
      top,
      bottom,
      width,
      // add dynamic left or right calculation
      ...(left !== undefined && {
        left: active
          ? left
          : `calc(${measurementToString(left)} - ${measurementToString(
              width
            )})`,
      }),
      ...(right !== undefined && {
        right: active
          ? right
          : `calc(${measurementToString(right)} - ${measurementToString(
              width
            )})`,
      }),
    };
  }, [active, top, bottom, width, left, right]);
  return src ? (
    <img
      src={src}
      className={['planet-bg', active && 'active', className]
        .filter(Boolean)
        .join(' ')}
      alt={`planet of ${name}`}
      style={style}
    />
  ) : null;
}

function measurementToString(value: number | string): string {
  return typeof value === 'number' ? `${value.toFixed(0)}px` : value;
}
