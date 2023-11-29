import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { TickInfo, tickIndexToPrice } from '../utils/ticks';
import { useOrderedTokenPair } from './useTokenPairs';
import { useToken } from '../../../lib/web3/hooks/useTokens';

import { Token, TokenAddress } from '../utils/tokens';
import { useIndexerStreamOfDualDataSet } from './useIndexer';

type ReserveDataRow = [tickIndex: number, reserves: number];

// add convenience method to fetch ticks in a pair
export function useTokenPairTickLiquidity([tokenAddressA, tokenAddressB]: [
  TokenAddress?,
  TokenAddress?
]): {
  data: [TickInfo[] | undefined, TickInfo[] | undefined];
  isValidating: boolean;
  error: unknown;
} {
  const [token0Address, token1Address] =
    useOrderedTokenPair([tokenAddressA, tokenAddressB]) || [];
  // stream data from indexer
  const { data, error } = useIndexerStreamOfDualDataSet<ReserveDataRow>(
    tokenAddressA &&
      tokenAddressB &&
      `/liquidity/pair/${tokenAddressA}/${tokenAddressB}`,
    {
      // remove entries of value 0 from the accumulated map, they are not used
      mapEntryRemovalValue: 0,
    }
  );

  // add token context into pool reserves
  const token0 = useToken(token0Address);
  const token1 = useToken(token1Address);

  // add token context into pool reserves
  const [tickInfoA, tickInfoB] = useMemo<
    [TickInfo[] | undefined, TickInfo[] | undefined]
  >(() => {
    return (
      (token0 &&
        token1 &&
        data && [
          // liquidity is stored in tickIndex format relative to each token side
          Array.from(data[0])
            .sort(([a], [b]) => b - a)
            .map(getMapFunction({ invert: false })),
          // the opposite side index must be inverted to get to this direction
          Array.from(data[1])
            .sort(([a], [b]) => b - a)
            .map(getMapFunction({ invert: true })),
        ]) ?? [undefined, undefined]
    );

    function getMapFunction({ invert }: { invert: boolean }) {
      const tickIndexFactor = invert ? -1 : 1;
      return ([relativeTickIndex, reserves]: ReserveDataRow) => {
        const tickIndex = tickIndexFactor * relativeTickIndex;
        return {
          fee: new BigNumber('0'), // this endpoint does not return fee info
          price1To0: tickIndexToPrice(new BigNumber(tickIndex)), // derive from tick index
          reserve0: new BigNumber(invert ? 0 : reserves), // one is 0, one is reserves
          reserve1: new BigNumber(invert ? reserves : 0), // one is 0, one is reserves
          tickIndex1To0: new BigNumber(tickIndex), // is tick index
          token0: token0 as Token,
          token1: token1 as Token,
        };
      };
    }
  }, [token0, token1, data]);

  return {
    data: [tickInfoA, tickInfoB],
    isValidating: true,
    error,
  };
}
