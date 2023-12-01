import { useMemo } from 'react';
import { TokenID } from '../utils/tokens';
import { useIndexerStreamOfSingleDataSet } from './useIndexer';

export type TokenPairReserves = [
  token0: TokenID,
  token1: TokenID,
  reserve0: number,
  reserve1: number
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
