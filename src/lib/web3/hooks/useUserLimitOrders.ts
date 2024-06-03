import Long from 'long';
import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { PageRequest } from '@duality-labs/neutronjs/types/codegen/cosmos/base/query/v1beta1/pagination';
import type { QueryAllUserLimitOrdersResponse } from '@duality-labs/neutronjs/types/codegen/neutron/dex/query';

import { DexLimitOrderEvent } from '../utils/events';

import { useDexRestClientPromise } from '../clients/restClients';
import { useWeb3 } from '../useWeb3';
import { useFetchAllPaginatedPages } from './useQueries';
import { useSwrResponseFromReactQuery } from './useSWR';
import useOnUserDexMsg from './useOnUserDexMsg';

const LimitOrderActions: Array<DexLimitOrderEvent['attributes']['action']> = [
  'PlaceLimitOrder',
  'WithdrawLimitOrder',
  'CancelLimitOrder',
];

export function useUserLimitOrderTranches() {
  const { address } = useWeb3();

  const restClientPromise = useDexRestClientPromise();
  const result = useInfiniteQuery({
    queryKey: ['dex.limitOrderTrancheUserAllByAddress', address],
    enabled: !!address,
    queryFn: async ({
      pageParam: pageKey,
    }: {
      pageParam: Uint8Array | undefined;
    }): Promise<QueryAllUserLimitOrdersResponse> => {
      const client = await restClientPromise;
      return address
        ? // query chain for user's transactions
          client.dex.limitOrderTrancheUserAllByAddress({
            address,
            pagination: {
              key: pageKey || [],
            } as PageRequest,
          })
        : // or return no transactions
          { limit_orders: [], pagination: { total: Long.ZERO } };
    },
    initialPageParam: undefined as Uint8Array | undefined,
    getNextPageParam: (lastPage): Uint8Array | undefined => {
      // don't pass an empty array as that will trigger another page to download
      return lastPage?.pagination?.next_key?.length
        ? lastPage?.pagination?.next_key ?? undefined
        : undefined;
    },
  });

  const { refetch } = result;

  // subscribe to updates to the user's limit orders
  useOnUserDexMsg<DexLimitOrderEvent>(LimitOrderActions, () => {
    refetch({ cancelRefetch: false });
  });

  // fetch all pages
  useFetchAllPaginatedPages(result);

  // combine all user limit orders
  const pages = result.data?.pages;
  const userTranches = useMemo(() => {
    return pages?.flatMap((page) => page?.limit_orders || []);
  }, [pages]);

  return useSwrResponseFromReactQuery(userTranches, result);
}
