import Long from 'long';
import { useEffect, useMemo } from 'react';

import { useLcdClientPromise } from '../lcdClient';

import {
  QueryTotalSupplyRequest,
  QueryTotalSupplyResponse,
} from '@duality-labs/dualityjs/types/codegen/cosmos/bank/v1beta1/query';
import { getShareInfo } from '../utils/shares';
import { getPairID } from '../utils/pairs';
import { TokenID } from '../utils/tokens';
import { useInfiniteQuery } from '@tanstack/react-query';

type QueryAllTokenMapState = {
  data: [TokenID, TokenID][] | undefined;
  isValidating: boolean;
  error: Error | null;
};

// experimentally timed that 250 is faster than 100 or 1000 items per page
//   - experiment list length: 7,220)
const defaultPaginationLimit = Long.fromNumber(250);

export default function useTokenPairs({
  queryOptions,
  query: queryConfig,
  queryClient: queryClientConfig,
}: {
  // todo: pass entire useQuery options set here
  queryOptions?: { refetchInterval: number | false };
  query?: QueryTotalSupplyRequest;
  queryClient?: string;
} = {}): QueryAllTokenMapState {
  const lcdClientPromise = useLcdClientPromise(queryClientConfig);

  const {
    data,
    error,
    isFetching: isValidating,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    ...queryOptions,
    queryKey: ['cosmos.bank.v1beta1.totalSupply'],
    queryFn: async ({
      pageParam: nextKey,
    }): Promise<QueryTotalSupplyResponse | undefined> => {
      const client = await lcdClientPromise;
      return await client.cosmos.bank.v1beta1.totalSupply({
        ...queryConfig,
        pagination: {
          limit: defaultPaginationLimit,
          ...queryConfig?.pagination,
          ...(nextKey && {
            key: nextKey,
          }),
        },
      });
    },
    defaultPageParam: undefined,
    getNextPageParam: (lastPage: QueryTotalSupplyResponse | undefined) => {
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
  const tradingPairs = useMemo(() => {
    const tradingPairMap = data?.pages?.reduce<Map<string, [TokenID, TokenID]>>(
      (acc, page) => {
        page?.supply.forEach((coin) => {
          const match = getShareInfo(coin);
          if (match) {
            const { token0Address, token1Address } = match;
            acc.set(getPairID(token0Address, token1Address), [
              token0Address,
              token1Address,
            ]);
          }
        });

        return acc;
      },
      new Map<string, [TokenID, TokenID]>()
    );
    return tradingPairMap && Array.from(tradingPairMap.values());
  }, [data]);

  // return state
  return { data: tradingPairs, isValidating, error };
}

// add convenience method to fetch ticks in a pair
export function useOrderedTokenPair([tokenA, tokenB]: [TokenID?, TokenID?]):
  | [token0: TokenID, token1: TokenID]
  | undefined {
  const { data: tokenPairs } = useTokenPairs();
  // search for ordered token pair in our token pair list
  return tokenA && tokenB
    ? tokenPairs?.find((tokenPair) => {
        return tokenPair.includes(tokenA) && tokenPair.includes(tokenB);
      })
    : undefined;
}
