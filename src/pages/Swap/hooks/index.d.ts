export interface PairRequest {
  /** address of altered token */
  address0?: string;
  /** address of other token */
  address1?: string;
  /** value of altered token */
  value0?: string;
}

export interface PairResult {
  /** address of token 0 */
  address0: string;
  /** address of token 1 */
  address1: string;
  /** value for token 1 */
  value0: string;
  /** (estimated) value for token 2 */
  value1: string;
  /** (estimated) rate of exchange */
  rate: string;
  /** (estimated) gas fee */
  gas: string;
}
