import { BigNumber } from 'bignumber.js';

export interface PairRequest {
  /** address of altered token */
  tokenA?: string;
  /** address of other token */
  tokenB?: string;
  /** value of altered token */
  valueA?: string;
}

export interface PairResult {
  /** address of token 0 */
  tokenA: string;
  /** address of token 1 */
  tokenB: string;
  /** value for token 0 */
  valueA: string;
  /** (estimated) value for token 1 */
  valueB: string;
  /** (estimated) rate of exchange */
  rate: string;
  /** (estimated) gas fee */
  gas: string;
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
