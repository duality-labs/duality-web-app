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
import { seconds } from '../../utils/time';

const { REACT_APP__INDEXER_API = '' } = process.env;

type ReserveDataRow = [tickIndex: number, reserves: number];
interface IndexerQueryAllPairLiquidityRangeResponse {
  block_range: {
    from_height: number; // range from (non-incluse)
    to_height: number; // range to (inclusive)
  };
  data: [Array<ReserveDataRow>, Array<ReserveDataRow>];
  pagination: { next_key: string; total?: number };
}

interface QueryAllPairLiquidityRangeResponse
  extends Omit<QueryAllTickLiquidityResponse, 'tickLiquidity'> {
  tickLiquidity: [
    QueryAllTickLiquidityResponse['tickLiquidity'],
    QueryAllTickLiquidityResponse['tickLiquidity']
  ];
  block_range: IndexerQueryAllPairLiquidityRangeResponse['block_range'];
}

type QueryAllPairLiquidityState = {
  data: [Array<PoolReserves>, Array<PoolReserves>] | undefined;
  isValidating: boolean;
  error: Error | null;
};

// experimentally timed that a 10,000-25,000 list is a good gzipped size request
const defaultPaginationLimit = 10000;

function usePairLiquidity({
  query: queryConfig,
  queryClient: queryClientConfig,
}: {
  query: QueryAllTickLiquidityRequest | null;
  queryClient?: string;
}): QueryAllPairLiquidityState {
  if (queryConfig && !queryConfig?.pairID) {
    throw new Error('Cannot fetch liquidity: no pair ID given');
  }
  if (queryConfig && !queryConfig?.tokenIn) {
    throw new Error('Cannot fetch liquidity: no token ID given');
  }

  const [knownHeight, setKnownChainHeight] = useState<number>();

  // figure out which direction this query is in
  const [token0, token1] = useMemo(
    () => queryConfig?.pairID.split('<>') || [],
    [queryConfig]
  );
  const [tokenA, tokenB] = useMemo(() => {
    const orderedTokens = new Set(
      [queryConfig?.tokenIn ?? '', token0, token1].filter(Boolean)
    );
    return Array.from(orderedTokens.values());
  }, [queryConfig, token0, token1]);

  const {
    data,
    error,
    isFetching: isValidating,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    // note: don't allow "update requests" to be considered stale (refetchable):
    // when a component loads this hook and this hook contains cached data,
    // the component will receive the cached progressive update request pages
    // in order starting from `knownHeight = undefined`, this works well.
    // but if the data is considered stale then useQuery will send out a request
    // for each cached page the component reads, generating a lot of requests
    // and cancelled requests as the component catches up on the known heights
    staleTime: Infinity,
    // note: we don't want to persist the data too long, because the hook
    // will basically loop through all cached heights to build the liquidity
    // and while this is fast, it can take a lot of time if there are many known
    // heights to process. So we remove these values from the cache early.
    gcTime: 30 * seconds,
    queryKey: [
      'dualitylabs.duality.dex.tickLiquidityAll',
      tokenA,
      tokenB,
      knownHeight,
    ],
    enabled: !!queryConfig,
    queryFn: async ({
      pageParam: { nextKey = undefined, height = undefined } = {},
      signal,
    }): Promise<QueryAllPairLiquidityRangeResponse | undefined> => {
      // build path
      const path = [tokenA, tokenB].map(encodeURIComponent).join('/');
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
      // request with appropriate query
      const urlPath = `${REACT_APP__INDEXER_API}/liquidity/pair/${path}`;
      const response = await fetch(`${urlPath}${query}`, { signal });
      // get reserve with Indexer result type
      const result: IndexerQueryAllPairLiquidityRangeResponse =
        await response.json();
      const [resultA, resultB] = result.data;
      return {
        // translate tick liquidity here
        tickLiquidity: [
          resultA.flatMap(transformToPoolReserves(tokenA)),
          resultB.flatMap(transformToPoolReserves(tokenB)),
        ],
        pagination: {
          // note: `null` here would be cast to a string: Buffer.from('null')
          next_key: Buffer.from(result.pagination.next_key || '', 'base64'),
          total: Long.fromNumber(result.pagination.total || 0),
        },
        // add block heights to response
        block_range: result.block_range,
      };

      function transformToPoolReserves(token: string) {
        return ([tickIndexOutToIn, reserveIn]: [number, number]) => {
          if (token && token0 && token1) {
            return {
              poolReserves: {
                pairID: {
                  token0,
                  token1,
                },
                tokenIn: token,
                tickIndex:
                  token === token0
                    ? Long.fromNumber(tickIndexOutToIn)
                    : Long.fromNumber(tickIndexOutToIn).negate(),
                reserves: reserveIn.toFixed(0),
                fee: Long.ZERO,
              },
            };
          } else return [];
        };
      }
    },
    defaultPageParam: undefined,
    getNextPageParam: (lastPage?: QueryAllPairLiquidityRangeResponse) => {
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
  const lastLiquidity = useRef<[PoolReserves[], PoolReserves[]]>();
  const tickSideLiquidity = useMemo(() => {
    // when refetching, the library sets `data` to `undefined`
    // I think this is unintuitive. we should only "empty" the data here
    // if a response comes back with an empty array, otherwise we keep the state
    const pages = data?.pages;
    if (pages && pages.length > 0) {
      const lastPage = pages[pages.length - 1];
      // update our state only if the last page of data has been reached
      if (lastPage && !lastPage.pagination?.next_key?.length) {
        const [poolReservesA, poolReservesB] = pages.flatMap((page) => {
          const [liquidityA, liquidityB] = page?.tickLiquidity || [];
          return [
            liquidityA?.flatMap(
              (tickLiquidity) => tickLiquidity.poolReserves ?? []
            ) ?? [],
            liquidityB?.flatMap(
              (tickLiquidity) => tickLiquidity.poolReserves ?? []
            ) ?? [],
          ];
        });
        // check if these pages are intended to be updates (partial content)
        if (lastPage?.block_range.from_height) {
          // double check this update can be applied to the known state
          if (lastPage?.block_range.from_height === knownHeight) {
            const [currentA, currentB] = lastLiquidity.current ?? [];
            lastLiquidity.current = [
              Array.from(
                // create map out of previous state and new state to ensure new
                // updates to respective tick indexes overwrite previous state
                new Map(
                  [...(currentA || []), ...poolReservesA].map(
                    (reserves): [number, PoolReserves] => [
                      reserves.tickIndex.toNumber(),
                      reserves,
                    ]
                  )
                ).values()
              )
                // and remove empty reserves from array
                .filter((poolReserves) => poolReserves.reserves !== '0')
                // re-sort the array (on the reduced length array)
                .sort((a, b) => b.tickIndex.subtract(a.tickIndex).toNumber()),
              Array.from(
                // create map out of previous state and new state to ensure new
                // updates to respective tick indexes overwrite previous state
                new Map(
                  [...(currentB || []), ...poolReservesB].map(
                    (reserves): [number, PoolReserves] => [
                      reserves.tickIndex.toNumber(),
                      reserves,
                    ]
                  )
                ).values()
              )
                // and remove empty reserves from array
                .filter((poolReserves) => poolReserves.reserves !== '0')
                // re-sort the array (on the reduced length array)
                .sort((a, b) => a.tickIndex.subtract(b.tickIndex).toNumber()),
            ];
          } else {
            // eslint-disable-next-line no-console
            console.error(
              'An update was received but there is no base to apply it to'
            );
          }
        }
        // no updateFromHeight should indicate this is a complete update
        else {
          lastLiquidity.current = [poolReservesA, poolReservesB];
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
  const pairState = usePairLiquidity({
    query:
      pairID && tokenA ? { pairID, tokenIn: tokenA, pagination: {} } : null,
  });

  // add token context into pool reserves
  const token0 = useToken(token0Address);
  const token1 = useToken(token1Address);
  const data = useMemo<[TickInfo[] | undefined, TickInfo[] | undefined]>(() => {
    return token0 && token1
      ? [
          pairState.data?.[0]?.flatMap((reserves) =>
            transformPoolReserves(token0, token1, reserves)
          ),
          pairState.data?.[1]?.flatMap((reserves) =>
            transformPoolReserves(token0, token1, reserves)
          ),
        ]
      : [undefined, undefined];
  }, [token0, token1, pairState.data]);

  return {
    ...pairState,
    data,
  };
}
