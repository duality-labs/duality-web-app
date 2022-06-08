import { BigNumber } from 'ethers';

export interface PairRequest {
  /** address of altered token */
  token0?: string;
  /** address of other token */
  token1?: string;
  /** value of altered token */
  value0?: string;
}

export interface PairResult {
  /** address of token 0 */
  token0: string;
  /** address of token 1 */
  token1: string;
  /** value for token 0 */
  value0: string;
  /** (estimated) value for token 1 */
  value1: string;
  /** (estimated) rate of exchange */
  rate: string;
  /** (estimated) gas fee */
  gas: string;
}

// TODO Add interface structure and remove esline comment
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface PermitData {}

export interface RouterResult {
  amountIn: BigNumber;
  tokens: Array<string>;
  prices0: Array<Array<BigNumber>>;
  prices1: Array<Array<BigNumber>>;
  fees: Array<Array<BigNumber>>;
  jitProtectionArr: Array<Array<boolean>>;
  useInternalAccounts: boolean;
  permitData: Array<PermitData>;
}
