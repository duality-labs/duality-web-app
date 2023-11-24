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
      `/liquidity/pair/${tokenAddressA}/${tokenAddressB}`
  );

  // add token context into pool reserves
  const token0 = useToken(token0Address);
  const token1 = useToken(token1Address);
  const isReversed = token0Address !== tokenAddressA;

  // add token context into pool reserves
  const [tickInfoA, tickInfoB] = useMemo<
    [TickInfo[] | undefined, TickInfo[] | undefined]
  >(() => {
    return (
      (token0 &&
        token1 &&
        data && [
          Array.from(data[0]).map(mapReservesToTickInfo),
          Array.from(data[1]).map(mapReservesToTickInfo),
        ]) ?? [undefined, undefined]
    );

    function mapReservesToTickInfo([tickIndex, reserves]: ReserveDataRow) {
      return {
        // NOTE: TO FIX
        fee: new BigNumber('0'), // problem must be fixed on indexer first
        price1To0: tickIndexToPrice(new BigNumber(tickIndex)), // derive from tick index
        reserve0: new BigNumber(isReversed ? 0 : reserves), // one is 0, one is reserves
        reserve1: new BigNumber(isReversed ? reserves : 0), // one is 0, one is reserves
        tickIndex1To0: new BigNumber(tickIndex), // is tick index
        token0: token0 as Token,
        token1: token1 as Token,
      };
    }
  }, [token0, token1, isReversed, data]);

  return {
    data: [tickInfoA, tickInfoB],
    isValidating: true,
    error,
  };
}
