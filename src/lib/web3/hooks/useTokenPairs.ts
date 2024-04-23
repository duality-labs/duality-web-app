import { useMemo } from 'react';
import { Token, TokenID } from '../utils/tokens';
import { useIndexerStreamOfSingleDataSet } from './useIndexer';
import { useTokenByDenom, useUniqueDenoms } from './useDenomClients';
import { SWRCommon, useSwrResponse } from './useSWR';
import { useSimplePrice } from '../../tokenPrices';

export type TokenPairReserves = [
  denom0: TokenID,
  denom1: TokenID,
  reserves0: number,
  reserves1: number
];
type DataRow = [index: number, values: TokenPairReserves];

type TokenPairsState = {
  data: TokenPairReserves[] | undefined;
  error: Error | null;
};

export default function useTokenPairs(): TokenPairsState {
  const { data, error } =
    useIndexerStreamOfSingleDataSet<DataRow>('/liquidity/pairs');

  const values: TokenPairReserves[] | undefined = useMemo(() => {
    if (data) {
      const values = Array.from(data)
        .sort(([a], [b]) => a - b)
        .map((row) => row[1]);
      return values;
    }
  }, [data]);

  // return state
  return { data: values, error: error || null };
}

export function useTokenPairsDenoms() {
  const { data: tokenPairs } = useTokenPairs();
  // return unique list of sorted token denoms (no update on different order)
  return useUniqueDenoms(
    tokenPairs?.flatMap(([token0, token1]) => [token0, token1])
  );
}

export interface ValuedTokenPair {
  denom0: TokenID;
  denom1: TokenID;
  token0: Token;
  token1: Token;
  reserves0: number;
  reserves1: number;
  value: number;
}

export function useValuedTokenPairs(
  tokenPairs: TokenPairReserves[] | undefined
): SWRCommon<ValuedTokenPair[]> {
  const { data: tokensByDenomMap, ...swr } = useTokenByDenom(
    tokenPairs?.flatMap(([token0, token1]) => [token0, token1])
  );
  const tokenList = useMemo(() => {
    return Array.from(tokensByDenomMap?.values() ?? []);
  }, [tokensByDenomMap]);

  const { data: tokenPrices } = useSimplePrice(tokenList);

  const tokenPriceByDenomMap = useMemo(() => {
    return tokenList.reduce<Map<string, number | undefined>>(
      (acc, token, index) => {
        acc.set(token.base, tokenPrices[index]);
        return acc;
      },
      new Map()
    );
  }, [tokenList, tokenPrices]);

  const valuedTokenPairs = useMemo<ValuedTokenPair[] | undefined>(() => {
    return (
      tokenPairs
        // find tokens from denoms
        ?.flatMap<
          [
            denom0: TokenID,
            denom1: TokenID,
            token0: Token,
            token1: Token,
            reserve0: number,
            reserve1: number
          ]
        >(([denom0, denom1, reserve0, reserve1]) => {
          const token0 = tokensByDenomMap?.get(denom0);
          const token1 = tokensByDenomMap?.get(denom1);
          return token0 && token1
            ? [[denom0, denom1, token0, token1, reserve0, reserve1]]
            : [];
        })
        // add token pair values
        ?.map<ValuedTokenPair>(
          ([denom0, denom1, token0, token1, reserves0, reserves1]) => {
            const price0 = tokenPriceByDenomMap.get(denom0) || 0;
            const price1 = tokenPriceByDenomMap.get(denom1) || 0;
            return {
              denom0,
              denom1,
              token0,
              token1,
              reserves0,
              reserves1,
              value: reserves0 * price0 + reserves1 * price1,
            };
          }
        )
        // sort by descending token pair values
        .sort((a, b) => b.value - a.value)
    );
  }, [tokenPairs, tokensByDenomMap, tokenPriceByDenomMap]);

  // return state
  return useSwrResponse(valuedTokenPairs, swr);
}

// add convenience method to fetch ticks in a pair
export function useOrderedTokenPair([tokenA, tokenB]: [
  tokenA?: TokenID,
  tokenB?: TokenID
]): TokenPairReserves | undefined {
  const { data: tokenPairs } = useTokenPairs();
  // search for ordered token pair in our token pair list
  return tokenA && tokenB
    ? tokenPairs?.find((tokenPair) => {
        return tokenPair.includes(tokenA) && tokenPair.includes(tokenB);
      })
    : undefined;
}
