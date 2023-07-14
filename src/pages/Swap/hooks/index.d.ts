import { BigNumber } from 'bignumber.js';

export interface PairRequest {
  /** address of token A */
  tokenA?: string;
  /** address of token B */
  tokenB?: string;
  /** value of token A (falsy if B was just altered) */
  valueA?: string;
  /** value of token B (falsy if A was just altered) */
  valueB?: string;
}

export interface PairResult {
  /** address of token A */
  tokenA: string;
  /** address of token B */
  tokenB: string;
  /** value for token A */
  valueA: string;
  /** (estimated) value for token B */
  valueB: string;
  /** (estimated) rate of exchange */
  rate: string;
  /** (estimated) gas fee */
  gas: string;
}

/**
 * RouterResult is a reflection of the backend structue "MsgSwap"
 * but utilising BigNumber type instead of BigNumberString type properties
 */
export interface RouterResult {
  tokenIn: string; // address
  tokenOut: string; // address
  amountIn: BigNumber;
  amountOut: BigNumber;
  priceBToAIn: BigNumber | undefined;
  priceBToAOut: BigNumber | undefined;
  tickIndexIn: BigNumber | undefined;
  tickIndexOut: BigNumber | undefined;
}
