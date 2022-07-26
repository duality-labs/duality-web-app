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
  path?: RouterResult;
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
  path?: RouterResult;
}

export interface RouterResult {
  amountIn: BigNumber;
  tokens: Array<string>;
  prices0: Array<Array<BigNumber>>;
  prices1: Array<Array<BigNumber>>;
  fees: Array<Array<BigNumber>>;
  reserves0: Array<Array<BigNumber>>;
  reserves1: Array<Array<BigNumber>>;
}
