import { TickInfo } from './ticks';
import {
  TokenAddress,
  TokenAddressPair,
  TokenPair,
  getTokenAddressPair,
} from './tokens';

export interface PairInfo {
  token0: string;
  token1: string;
  token0Ticks: TickInfo[];
  token1Ticks: TickInfo[];
}

export interface PairMap {
  [pairID: string]: PairInfo;
}

export type PairIdString = string;

/**
 * Gets the pair id for a sorted pair of tokens
 * @param token0 address of token 0
 * @param token1 address of token 1
 * @returns pair id for tokens
 */
export function getPairID(
  token0: TokenAddress = '',
  token1: TokenAddress = ''
): PairIdString {
  return token0 && token1 ? `${token0}<>${token1}` : '';
}
export function getTokenAddressPairID(
  tokenPair: TokenPair | TokenAddressPair
): PairIdString {
  const tokenAddressPair = getTokenAddressPair(tokenPair);
  return getPairID(...tokenAddressPair);
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

export function guessInvertedOrder(
  tokenA?: string,
  tokenB?: string
): boolean | undefined {
  // assume that Array.sort is equivalent to the sorting function in Golang
  // for all known token address values
  const pairID = getPairID(...[tokenA, tokenB].sort());
  return tokenA && tokenB
    ? hasInvertedOrder(pairID, tokenA, tokenB)
    : undefined;
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
