import { useMatch } from 'react-router-dom';
import React, { useMemo } from 'react';

import planetSwapSVG from '../../assets/planets/planet-swap.svg';
import planetLiquiditySVG from '../../assets/planets/planet-liquidity.svg';
import planetPortfolioSVG from '../../assets/planets/planet-portfolio.svg';
import marsSVG from '../../assets/planets/mars.svg';

import './Planets.scss';

const planets: { [planetName: string]: string | undefined } = {
  swap: planetSwapSVG,
  pools: planetLiquiditySVG,
  portfolio: planetPortfolioSVG,
  'apps/mars': marsSVG,
};

export default function Planets() {
  return (
    <>
      <Planet name="swap" bottom={0} width={947} right={0} />
      <Planet name="pools" top="10vh" width={774} right={0} />
      <Planet name="portfolio" top="10vh" width={1200} right={0} />
      <Planet name="apps/mars" top={0} width={1200} right={0} />
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
  const active = useMatch(`${name}/*`);
  const isMars = name === 'apps/mars';
  const style = useMemo(() => {
    if (isMars) {
    }
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
  }, [isMars, top, bottom, width, left, active, right]);
  return src ? (
    <img
      src={src}
      className={
        isMars
          ? 'planet-bg'
          : ['planet-bg', active && 'active', className]
              .filter(Boolean)
              .join(' ')
      }
      alt={`planet of ${name}`}
      style={style}
    />
  ) : null;
}

function measurementToString(value: number | string): string {
  return typeof value === 'number' ? `${value.toFixed(0)}px` : value;
}
