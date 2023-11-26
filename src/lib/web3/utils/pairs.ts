import { TickInfo } from './ticks';
import {
  TokenID,
  TokenIdPair,
  TokenPair,
  resolveTokenId,
  resolveTokenIdPair,
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
 * @param token0 ID of token 0
 * @param token1 ID of token 1
 * @returns pair id for tokens
 */
export function getPairID(
  token0: TokenID = '',
  token1: TokenID = ''
): PairIdString {
  return token0 && token1 ? `${token0}<>${token1}` : '';
}
export function getTokenPairID(
  tokenPair: TokenPair | TokenIdPair
): PairIdString {
  const tokenIdPair = resolveTokenIdPair(tokenPair);
  return getPairID(...tokenIdPair);
}

/**
 * Check if the current TokenA/TokenB pair is in the same order as Token0/1
 * @param pairID pair id for tokens
 * @param tokenA ID of token A
 * @param tokenB ID of token B
 * @returns bool for inverted order
 */
export function hasInvertedOrder(
  pairID: string,
  tokenPair: TokenPair | TokenIdPair
): boolean {
  return getTokenPairID(tokenPair) !== pairID;
}

export function guessInvertedOrder(
  tokens: TokenPair | TokenIdPair
): boolean | undefined {
  // assume that Array.sort is equivalent to the sorting function in Golang
  // for all known token ID values
  const tokenPairID = getPairID(...tokens.map(resolveTokenId).sort());
  return tokens[0] && tokens[1]
    ? hasInvertedOrder(tokenPairID, tokens)
    : undefined;
}

/**
 * Checks given token pair against stored data to determine
 * if the current TokenA/TokenB pair exists and is in the same order as Token0/1
 * @param pairMap pair map of stored tokens
 * @param tokenA ID of token A
 * @param tokenB ID of token B
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
