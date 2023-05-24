import { TickInfo } from './ticks';
import { TokenAddress } from './tokens';

export interface PairInfo {
  token0: string;
  token1: string;
  token0Ticks: TickInfo[];
  token1Ticks: TickInfo[];
}

export interface PairMap {
  [pairID: string]: PairInfo;
}

/**
 * Gets the pair id for a sorted pair of tokens
 * @param token0 address of token 0
 * @param token1 address of token 1
 * @returns pair id for tokens
 */
export function getPairID(
  token0: TokenAddress = '',
  token1: TokenAddress = ''
) {
  return token0 && token1 ? `${token0}<>${token1}` : '';
}

/**
 * Check if the current TokenA/TokenB pair is in the same order as Token0/1
 * @param pairID pair id for tokens
 * @param tokenA address of token A
 * @param tokenB address of token B
 * @returns bool for inverted order
 */
export function hasInvertedOrder(
  pairID: string,
  tokenA: string,
  tokenB: string
): boolean {
  return getPairID(tokenA, tokenB) !== pairID;
}

/**
 * Checks given token pair against stored data to determine
 * if the current TokenA/TokenB pair exists and is in the same order as Token0/1
 * @param pairMap pair map of stored tokens
 * @param tokenA address of token A
 * @param tokenB address of token B
 * @returns [isSorted, isInverseSorted] array for determining sort order (both may be `false` if pair is not found)
 */
export function hasMatchingPairOfOrder(
  pairMap: PairMap,
  tokenA: string,
  tokenB: string
): [boolean, boolean] {
  const forward = !!pairMap?.[getPairID(tokenA, tokenB)];
  const reverse = !!pairMap?.[getPairID(tokenB, tokenA)];
  return [forward, reverse];
}
