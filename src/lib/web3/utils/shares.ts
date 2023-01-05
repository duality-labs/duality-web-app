export interface DexShares {
  address: string;
  pairId: string;

  /** @format int64 */
  tickIndex: string;

  /** @format uint64 */
  feeIndex: string;
  sharesOwned: string;
}
