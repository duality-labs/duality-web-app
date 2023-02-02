import flat from './liquidity-shapes/flat.svg';
import normal from './liquidity-shapes/normal.svg';
import increasing from './liquidity-shapes/increasing.svg';
import decreasing from './liquidity-shapes/decreasing.svg';

export type LiquidityShapes = 'flat' | 'normal' | 'increasing' | 'decreasing';
export interface LiquidityShape {
  icon: string;
  value: LiquidityShapes;
  label: string;
}

export const liquidityShapes: Array<LiquidityShape> = [
  {
    value: 'flat',
    label: 'Uniform',
    icon: flat,
  },
  {
    value: 'normal',
    label: 'Normal',
    icon: normal,
  },
  {
    value: 'increasing',
    label: 'Increasing',
    icon: increasing,
  },
  {
    value: 'decreasing',
    label: 'Decreasing',
    icon: decreasing,
  },
];
