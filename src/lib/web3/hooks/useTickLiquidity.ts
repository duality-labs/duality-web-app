import Long from 'long';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

import {
  QueryAllTickLiquidityRequest,
  QueryAllTickLiquidityResponse,
} from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/dex/query';
import { TickLiquidity } from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/dex/tick_liquidity';
import { PoolReserves } from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/dex/pool_reserves';

import BigNumber from 'bignumber.js';

import { TickInfo, tickIndexToPrice } from '../utils/ticks';
import { useOrderedTokenPair } from './useTokenPairs';
import { useToken } from '../../../lib/web3/hooks/useTokens';

import { Token, TokenAddress } from '../utils/tokens';
import { getPairID } from '../utils/pairs';

const { REACT_APP__INDEXER_API = '' } = process.env;

interface QueryAllTickLiquidityResponseWithHeight
  extends QueryAllTickLiquidityResponse {
  height: number;
}

type QueryAllTickLiquidityState = {
  data: Array<PoolReserves> | undefined;
  isValidating: boolean;
  error: Error | null;
};

// experimentally timed that 1000 is faster than 100 or 10,000 items per page
//   - experiment list length: 1,462 + 5,729 (for each token side)
//   - time to receive first page for ~5,000 list is ~100ms
const defaultPaginationLimit = 10000;

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

  const [knownChainHeight, setKnownChainHeight] = useState<number>();

  const {
    data,
    error,
    isFetching: isValidating,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: [
      'dualitylabs.duality.dex.tickLiquidityAll',
      queryConfig?.pairID,
      queryConfig?.tokenIn,
      knownChainHeight,
    ],
    enabled: !!queryConfig,
    queryFn: async ({
      pageParam: { nextKey = undefined, height = 0 } = {},
    }): Promise<QueryAllTickLiquidityResponseWithHeight | undefined> => {
      // build path
      const orderedTokens = new Set(
        [
          queryConfig?.tokenIn ?? '',
          ...(queryConfig?.pairID ?? '').split('<>'),
        ].filter(Boolean)
      );
      const path = Array.from(orderedTokens).map(encodeURIComponent).join('/');
      // build query params
      const queryParams = new URLSearchParams();
      const nextKeyString =
        nextKey && Buffer.from(nextKey.buffer).toString('base64');
      if (nextKeyString) {
        queryParams.append('pagination.key', nextKeyString);
      } else {
        // return the item count information for stats and debugging
        queryParams.append('pagination.count_total', 'true');
        queryParams.append(
          'pagination.limit',
          defaultPaginationLimit.toFixed()
        );
      }
      const query = queryParams.toString() ? `?${queryParams}` : '';
      // request with appropriate headers
      const response = await fetch(
        `${REACT_APP__INDEXER_API}/liquidity/token/${path}${query}`,
        {
          headers: {
            ...(height > 0 && {
              // if we are requesting a "next" page: request the current height
              // eTags should have double quotes for strong conparison
              // (strong conparison allows for caching to be used)
              'If-Match': `"${height}"`,
            }),
            ...(knownChainHeight && {
              // the server should wait until it has new information to return // the next height that does not match this height, ie. long polling // if we already have the data for a current height, request // if not a "next" page, we a starting a new request "chain"
              // eTags should have double quotes for strong conparison
              // (strong conparison allows for caching to be used)
              'If-None-Match': `"${knownChainHeight}"`,
            }),
          },
        }
      );
      // get reserve with Indexer result type
      const result: {
        data: Array<[tickIndex: number, reserves: number]>;
        pagination: { next_key: string; total?: number };
      } = await response.json();
      // get the response eTag which should come enclosed in double quotes
      // (this is due to an RFC spec to distnguish weak vs. strong entity tags
      // https://www.rfc-editor.org/rfc/rfc7232#section-2.3)
      const eTag = response.headers.get('Etag')?.replace(/^"(.+)"$/, '$1');
      // we stored the chain height as the first ID part in the eTag
      const chainHeight = Number(eTag?.split('-').at(0)) || 0;
      return {
        // translate tick liquidity here
        tickLiquidity: result.data.flatMap(([tickIndexOutToIn, reserveIn]) => {
          const [token0, token1] = queryConfig?.pairID.split('<>') || [];
          if (queryConfig && token0 && token1) {
            return {
              poolReserves: {
                pairID: {
                  token0,
                  token1,
                },
                tokenIn: queryConfig.tokenIn,
                tickIndex:
                  queryConfig.tokenIn === token0
                    ? Long.fromNumber(tickIndexOutToIn)
                    : Long.fromNumber(tickIndexOutToIn).negate(),
                reserves: reserveIn.toFixed(0),
                fee: Long.ZERO,
              },
            };
          } else return [];
        }),
        pagination: {
          // note: `null` here would be cast to a string: Buffer.from('null')
          next_key: Buffer.from(result.pagination.next_key || '', 'base64'),
          total: Long.fromNumber(result.pagination.total || 0),
        },
        // add block height to response
        height: chainHeight,
      };
    },
    defaultPageParam: undefined,
    getNextPageParam: (lastPage?: QueryAllTickLiquidityResponseWithHeight) => {
      // don't pass an empty array as that will trigger another page to download
      return lastPage?.pagination?.next_key?.length
        ? // return key and also height to request the right height of next page
          {
            nextKey: lastPage?.pagination?.next_key,
            height: lastPage?.height,
          }
        : // return undefined to indicate this as the last page and stop
          undefined;
    },
  });

  // fetch more data if data has changed but there are still more pages to get
  useEffect(() => {
    // note: when a new request chain is started, data becomes `undefined`
    if (data) {
      // fetch following page
      if (hasNextPage) {
        fetchNextPage?.();
      }
      // if the end of pages has been reached, set the new known height
      else {
        setKnownChainHeight(data.pages?.at(-1)?.height);
      }
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
      if (lastPage && !lastPage.pagination?.next_key?.length) {
        const poolReserves = pages.flatMap(
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
  if (poolReserves?.reserves) {
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
