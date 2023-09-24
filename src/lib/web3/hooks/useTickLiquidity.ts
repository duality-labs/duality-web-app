import Long from 'long';
import { useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

import {
  QueryAllTickLiquidityRequest,
  QueryAllTickLiquidityResponse,
} from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/dex/query';
import { useLcdClientPromise } from '../lcdClient';
import { TickLiquidity } from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/dex/tick_liquidity';
import { PoolReserves } from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/dex/pool_reserves';

import BigNumber from 'bignumber.js';

import { TickInfo, tickIndexToPrice } from '../utils/ticks';
import { useOrderedTokenPair } from './useTokenPairs';
import { usePairUpdateHeight } from '../indexerProvider';
import { useToken } from '../../../lib/web3/hooks/useTokens';

import { Token, TokenAddress } from '../utils/tokens';
import { getPairID } from '../utils/pairs';

type QueryAllTickLiquidityState = {
  data: Array<PoolReserves> | undefined;
  isValidating: boolean;
  error: Error | null;
};

// experimentally timed that 1000 is faster than 100 or 10,000 items per page
//   - experiment list length: 1,462 + 5,729 (for each token side)
//   - time to receive first page for ~5,000 list is ~100ms
const defaultPaginationLimit = Long.fromNumber(1000);

function useTickLiquidity({
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
    }): Promise<QueryAllTickLiquidityResponse | undefined> => {
      if (queryConfig) {
        const client = await lcdClientPromise;
        return await client.dualitylabs.duality.dex.tickLiquidityAll({
          ...queryConfig,
          pagination: {
            limit: defaultPaginationLimit,
            ...queryConfig?.pagination,
            ...(nextKey && {
              key: nextKey,
            }),
          },
        });
      }
    },
    defaultPageParam: undefined,
    getNextPageParam: (lastPage: QueryAllTickLiquidityResponse | undefined) => {
      // don't pass an empty array as that will trigger another page to download
      return lastPage?.pagination?.next_key?.length
        ? lastPage?.pagination?.next_key
        : undefined;
    },
  });

  // fetch more data if data has changed but there are still more pages to get
  useEffect(() => {
    if (fetchNextPage && hasNextPage) {
      fetchNextPage();
    }
  }, [data, fetchNextPage, hasNextPage]);

  // place pages of data into the same list
  const lastLiquidity = useRef<PoolReserves[]>();
  const tickSideLiquidity = useMemo(() => {
    // when refetching, the library sets `data` to `undefined`
    // I think this is unintuitive. we should only "empty" the data here
    // if a response comes back with an empty array, otherwise we keep the state
    const pages = data?.pages;
    if (pages && pages.length > 0) {
      const lastPage = pages[pages.length - 1];
      // update our state only if the last page of data has been reached
      if (!lastPage?.pagination?.next_key?.length) {
        const poolReserves = pages?.flatMap(
          (page) =>
            page?.tickLiquidity?.flatMap(
              (tickLiquidity) => tickLiquidity.poolReserves ?? []
            ) ?? []
        );
        lastLiquidity.current = poolReserves;
      }
    }
    return lastLiquidity.current;
  }, [data]);
  return { data: tickSideLiquidity, isValidating, error };
}

function transformPoolReserves(
  token0: Token,
  token1: Token,
  poolReserves: TickLiquidity['poolReserves']
): TickInfo | [] {
  // process only ticks with pool reserves
  if (poolReserves) {
    const {
      pairID,
      tokenIn,
      tickIndex: tickIndex1To0String,
      fee: feeString,
      reserves: reservesString,
    } = poolReserves;
    const tickIndex1To0 = Number(tickIndex1To0String);
    const fee = feeString && Number(feeString);
    if (
      !isNaN(tickIndex1To0) &&
      tokenIn &&
      token0.address === pairID?.token0 &&
      token1.address === pairID?.token1 &&
      !isNaN(Number(reservesString)) &&
      !isNaN(Number(fee)) &&
      fee !== undefined
    ) {
      // calculate price from tickIndex1To0, try to keep price values consistent:
      //   JS rounding may be inconsistent with API's rounding
      const bigTickIndex1To0 = new BigNumber(tickIndex1To0 || 0);
      const bigPrice1To0 = tickIndexToPrice(bigTickIndex1To0);

      if (tokenIn === token0.address) {
        return {
          token0,
          token1,
          tickIndex1To0: bigTickIndex1To0,
          price1To0: bigPrice1To0,
          fee: new BigNumber(fee),
          reserve0: new BigNumber(reservesString || 0),
          reserve1: new BigNumber(0),
        };
      } else if (tokenIn === token1.address) {
        return {
          token0,
          token1,
          tickIndex1To0: bigTickIndex1To0,
          price1To0: bigPrice1To0,
          fee: new BigNumber(fee),
          reserve0: new BigNumber(0),
          reserve1: new BigNumber(reservesString || 0),
        };
      }
    }
    throw new Error('Unexpected tickLiquidity shape');
  } else {
    return [];
  }
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
  const [token0Address, token1Address] =
    useOrderedTokenPair([tokenA, tokenB]) || [];
  const pairID =
    token0Address && token1Address
      ? getPairID(token0Address, token1Address)
      : null;
  const token0TicksState = useTickLiquidity({
    query:
      pairID && token0Address
        ? { pairID, tokenIn: token0Address, pagination: {} }
        : null,
  });
  const token1TicksState = useTickLiquidity({
    query:
      pairID && token1Address
        ? { pairID, tokenIn: token1Address, pagination: {} }
        : null,
  });

  // add token context into pool reserves
  const token0 = useToken(token0Address);
  const token1 = useToken(token1Address);
  const data = useMemo<[TickInfo[] | undefined, TickInfo[] | undefined]>(() => {
    return token0 && token1
      ? [
          token0TicksState.data?.flatMap((reserves) =>
            transformPoolReserves(token0, token1, reserves)
          ),
          token1TicksState.data?.flatMap((reserves) =>
            transformPoolReserves(token0, token1, reserves)
          ),
        ]
      : [undefined, undefined];
  }, [token0, token0TicksState.data, token1, token1TicksState.data]);

  return {
    data,
    isValidating:
      token0TicksState.isValidating && token1TicksState.isValidating,
    error: token0TicksState.error || token1TicksState.error,
  };
}
