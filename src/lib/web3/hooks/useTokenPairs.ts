import { useMemo } from 'react';
import { TokenAddress } from '../utils/tokens';
import { useIndexerStreamOfSingleDataSet } from './useIndexer';

type DataRowValues = [
  token0: TokenAddress,
  token1: TokenAddress,
  reserve0: number,
  reserve1: number
];
type DataRow = [index: number, values: DataRowValues];

type TokenPairsState = {
  data: DataRowValues[] | undefined;
  error: Error | null;
};

export default function useTokenPairs(): TokenPairsState {
  const { data, error } =
    useIndexerStreamOfSingleDataSet<DataRow>('/liquidity/pairs');

  const values: DataRowValues[] | undefined = useMemo(() => {
    if (data) {
      const values = Array.from(data, (row) => row[1])
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
  TokenAddress?,
  TokenAddress?
]): DataRowValues | undefined {
  const { data: tokenPairs } = useTokenPairs();
  // search for ordered token pair in our token pair list
  return tokenA && tokenB
    ? tokenPairs?.find((tokenPair) => {
        return tokenPair.includes(tokenA) && tokenPair.includes(tokenB);
      })
    : undefined;
}
