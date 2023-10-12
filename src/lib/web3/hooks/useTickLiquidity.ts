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

interface QueryAllTickLiquidityRangeResponse
  extends QueryAllTickLiquidityResponse {
  block_range: {
    from_height: number; // range from (non-incluse)
    to_height: number; // range to (inclusive)
  };
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

  const [knownHeight, setKnownChainHeight] = useState<number>();

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
      knownHeight,
    ],
    enabled: !!queryConfig,
    queryFn: async ({
      pageParam: { nextKey = undefined, height = undefined } = {},
      signal,
    }): Promise<QueryAllTickLiquidityRangeResponse | undefined> => {
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
      // add pagination params
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
      // add block range params
      // if we know a certain height already, we may request a partial update
      if (knownHeight && knownHeight > 0) {
        // an update with `block_range.from_height` may take a while to resolve.
        // if the chain has no updates since the known height it will wait
        // until there is new data and send through the update from this height.
        queryParams.append('block_range.from_height', knownHeight.toFixed(0));
      }
      // if we are requesting several pages of results, ensure the same height
      // is fetched for all subsequent request pages
      if (height && height > 0) {
        // a known issue that may be possibly experienced with multiple indexers
        // is that the liquidity data of a pair cannot be guaranteed to be found
        // for a historic height. we rely on the initial (page 0) request from
        // a front end client to populate a specific height cache in the
        // indexer so that it may be found for the subsequest page requests.
        // link: https://github.com/duality-labs/hapi-indexer/issues/22
        // these requests may fail with a 412: Precondition Failed error.
        queryParams.append('block_range.to_height', height.toFixed(0));
      }
      const query = queryParams.toString() ? `?${queryParams}` : '';
      // request with appropriate headers
      const response = await fetch(
        `${REACT_APP__INDEXER_API}/liquidity/token/${path}${query}`,
        { signal }
      );
      // get reserve with Indexer result type
      const result: {
        block_range: {
          from_height: number; // range from (non-incluse)
          to_height: number; // range to (inclusive)
        };
        data: Array<[tickIndex: number, reserves: number]>;
        pagination: { next_key: string; total?: number };
      } = await response.json();
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
        // add block heights to response
        block_range: result.block_range,
      };
    },
    defaultPageParam: undefined,
    getNextPageParam: (lastPage?: QueryAllTickLiquidityRangeResponse) => {
      // don't pass an empty array as that will trigger another page to download
      return lastPage?.pagination?.next_key?.length
        ? // return key and also height to request the right height of next page
          {
            nextKey: lastPage?.pagination?.next_key,
            height: lastPage?.block_range.to_height,
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
        setKnownChainHeight(data.pages?.at(-1)?.block_range.to_height);
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
        // check if these pages are intended to be updates (partial content)
        if (lastPage?.block_range.from_height) {
          // double check this update can be applied to the known state
          if (lastPage?.block_range.from_height === knownHeight) {
            lastLiquidity.current = Array.from(
              // create map out of previous state and new state to ensure new
              // updates to respective tick indexes overwrite previous state
              new Map(
                [...(lastLiquidity.current || []), ...poolReserves].map(
                  (reserves): [number, PoolReserves] => [
                    reserves.tickIndex.toNumber(),
                    reserves,
                  ]
                )
              ).values()
              // and remove empty reserves from array
            ).filter((poolReserves) => poolReserves.reserves !== '0');
          } else {
            // eslint-disable-next-line no-console
            console.error(
              'An update was received but there is no base to apply it to'
            );
          }
        }
        // no updateFromHeight should indicate this is a complete update
        else {
          lastLiquidity.current = poolReserves;
        }
      }
    }
    return lastLiquidity.current;
  }, [data?.pages, knownHeight]);
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
