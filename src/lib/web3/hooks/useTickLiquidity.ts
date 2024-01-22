import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { TickInfo, tickIndexToPrice } from '../utils/ticks';
import { useOrderedTokenPair } from './useTokenPairs';

import { useIndexerStreamOfDualDataSet } from './useIndexer';
import { Token, TokenID } from '../utils/tokens';
import { useToken } from './useDenomClients';

type ReserveDataRow = [tickIndex: number, reserves: number];
type ReserveDataSet = Map<ReserveDataRow['0'], ReserveDataRow['1']>;

// add convenience method to fetch liquidity maps of a pair
export function useTokenPairMapLiquidity([tokenIdA, tokenIdB]: [
  TokenID?,
  TokenID?
]): {
  data?: [ReserveDataSet, ReserveDataSet];
  error?: unknown;
} {
  const encodedA = tokenIdA && encodeURIComponent(tokenIdA);
  const encodedB = tokenIdB && encodeURIComponent(tokenIdB);
  // stream data from indexer
  return useIndexerStreamOfDualDataSet<ReserveDataRow>(
    encodedA && encodedB && `/liquidity/pair/${encodedA}/${encodedB}`,
    {
      // remove entries of value 0 from the accumulated map, they are not used
      mapEntryRemovalValue: 0,
    }
  );
}

// add convenience method to fetch ticks in a pair
export function useTokenPairTickLiquidity([tokenIdA, tokenIdB]: [
  TokenID?,
  TokenID?
]): {
  data: [TickInfo[] | undefined, TickInfo[] | undefined];
  isValidating: boolean;
  error: unknown;
} {
  const [tokenId0, tokenId1] = useOrderedTokenPair([tokenIdA, tokenIdB]) || [];

  // use stream data from indexer
  const { data, error } = useTokenPairMapLiquidity([tokenIdA, tokenIdB]);

  // add token context into pool reserves
  const { data: token0 } = useToken(tokenId0);
  const { data: token1 } = useToken(tokenId1);

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
