import { useEffect, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

import {
  QueryAllTickLiquidityRequest,
  QueryAllTickLiquidityResponseSDKType,
} from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/dex/query';
import { useLcdClientPromise } from '../lcdClient';
import { TickLiquiditySDKType } from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/dex/tick_liquidity';

import { addressableTokenMap as tokenMap } from '../../../lib/web3/hooks/useTokens';
import BigNumber from 'bignumber.js';
import { TickInfo, tickIndexToPrice } from '../utils/ticks';
import { useOrderedTokenPair } from './useTokenPairs';
import { usePairUpdateHeight } from '../indexerProvider';

import { TokenAddress } from '../utils/tokens';
import { getPairID } from '../utils/pairs';

type QueryAllTickLiquidityState = {
  data: Array<TickInfo> | undefined;
  isValidating: boolean;
  error: Error | null;
};

export default function useTickLiquidity({
  query: queryConfig,
  queryClient: queryClientConfig,
}: {
  query: QueryAllTickLiquidityRequest | null;
  queryClient?: string;
}): QueryAllTickLiquidityState {
  if (queryConfig && !queryConfig?.pairID) {
    throw new Error('Cannot fetch liquidity: no pair ID given');
  }
  if (queryConfig && !queryConfig?.tokenIn) {
    throw new Error('Cannot fetch liquidity: no token ID given');
  }

  const lcdClientPromise = useLcdClientPromise(queryClientConfig);

  // on swap the user shares hasn't changed, the user may not be a liquidity provider
  // a CosmosSDK websocket subscription updates our pair update height store
  // whenever the user has a successful transaction against the chain
  // todo: this value should update on any liquidity change within the pair
  // not just changes from the current user
  const pairUpdateHeight = usePairUpdateHeight(queryConfig?.pairID);

  const {
    data,
    error,
    isFetching: isValidating,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: [
      'dualitylabs.duality.dex.tickLiquidityAll',
      queryConfig,
      pairUpdateHeight,
    ],
    queryFn: async ({
      pageParam: nextKey,
    }): Promise<QueryAllTickLiquidityResponseSDKType | undefined> => {
      if (queryConfig) {
        const client = await lcdClientPromise;
        return await client.dualitylabs.duality.dex.tickLiquidityAll({
          ...queryConfig,
          pagination: nextKey ? { key: nextKey } : queryConfig.pagination,
        });
      }
    },
    defaultPageParam: undefined,
    getNextPageParam: (
      lastPage: QueryAllTickLiquidityResponseSDKType | undefined
    ) => {
      return lastPage?.pagination?.next_key ?? undefined;
    },
  });

  // fetch more data if data has changed but there are still more pages to get
  useEffect(() => {
    if (fetchNextPage && hasNextPage) {
      fetchNextPage();
    }
  }, [data, fetchNextPage, hasNextPage]);

  // place pages of data into the same list
  const tradingPairs = useMemo(() => {
    const liquidity = data?.pages?.flatMap((page) => page?.tickLiquidity ?? []);
    return liquidity && transformData(liquidity);
  }, [data]);
  return { data: tradingPairs, isValidating, error };
}

function transformData(ticks: Array<TickLiquiditySDKType>): Array<TickInfo> {
  return ticks.map<TickInfo>(function ({
    poolReserves: {
      pairID: { token0 = '', token1 = '' } = {},
      tokenIn,
      tickIndex: tickIndex1To0String,
      fee: feeString,
      reserves: reservesString,
    } = {},
  }) {
    const tickIndex1To0 = Number(tickIndex1To0String);
    const fee = feeString && Number(feeString);
    if (
      !isNaN(tickIndex1To0) &&
      tokenIn &&
      token0 &&
      token1 &&
      tokenMap[tokenIn] &&
      tokenMap[token0] &&
      tokenMap[token1] &&
      !isNaN(Number(reservesString)) &&
      !isNaN(Number(fee)) &&
      fee !== undefined
    ) {
      // calculate price from tickIndex1To0, try to keep price values consistent:
      //   JS rounding may be inconsistent with API's rounding
      const bigTickIndex1To0 = new BigNumber(tickIndex1To0 || 0);
      const bigPrice1To0 = tickIndexToPrice(bigTickIndex1To0);

      if (tokenIn === token0) {
        return {
          token0: tokenMap[token0],
          token1: tokenMap[token1],
          tickIndex1To0: bigTickIndex1To0,
          price1To0: bigPrice1To0,
          fee: new BigNumber(fee),
          reserve0: new BigNumber(reservesString || 0),
          reserve1: new BigNumber(0),
        };
      } else if (tokenIn === token1) {
        return {
          token0: tokenMap[token0],
          token1: tokenMap[token1],
          tickIndex1To0: bigTickIndex1To0,
          price1To0: bigPrice1To0,
          fee: new BigNumber(fee),
          reserve0: new BigNumber(0),
          reserve1: new BigNumber(reservesString || 0),
        };
      }
    }
    throw new Error('Unexpected tickLiquidity shape');
  });
}

// add convenience method to fetch ticks in a pair
export function useTokenPairTickLiquidity([tokenA, tokenB]: [
  TokenAddress?,
  TokenAddress?
]): {
  data: [TickInfo[] | undefined, TickInfo[] | undefined];
  isValidating: boolean;
  error: unknown;
} {
  const [token0, token1] = useOrderedTokenPair([tokenA, tokenB]) || [];
  const pairID = token0 && token1 ? getPairID(token0, token1) : null;
  const token0TicksState = useTickLiquidity({
    query: pairID && token0 ? { pairID, tokenIn: token0 } : null,
  });
  const token1TicksState = useTickLiquidity({
    query: pairID && token1 ? { pairID, tokenIn: token1 } : null,
  });
  return {
    data: [token0TicksState.data, token1TicksState.data],
    isValidating:
      token0TicksState.isValidating && token1TicksState.isValidating,
    error: token0TicksState.error || token1TicksState.error,
  };
}
