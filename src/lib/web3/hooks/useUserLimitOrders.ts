import { useEffect, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { PageRequest } from '@duality-labs/neutronjs/types/codegen/cosmos/base/query/v1beta1/pagination';
import type { QueryAllUserLimitOrdersResponse } from '@duality-labs/neutronjs/types/codegen/neutron/dex/query';

import subscriber from '../subscriptionManager';
import { MessageActionEvent, TendermintTxData } from '../events';
import {
  DexLimitOrderEvent,
  DexPlaceLimitOrderEvent,
  mapEventAttributes,
} from '../utils/events';

import { useDexRestClientPromise } from '../clients/restClients';
import { useWeb3 } from '../useWeb3';
import { useFetchAllPaginatedPages } from './useQueries';
import { useSwrResponseFromReactQuery } from './useSWR';

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
      return client.dex.limitOrderTrancheUserAllByAddress({
        address: address || '',
        pagination: {
          key: pageKey || [],
        } as PageRequest,
      });
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
  useEffect(() => {
    if (address) {
      const onUserDexMsg = (
        _event: MessageActionEvent,
        tx: TendermintTxData
      ) => {
        const events = tx.value.TxResult.result.events.map(mapEventAttributes);
        const dexEvents = events.filter(
          (event): event is DexLimitOrderEvent => event.type === 'message'
        );

        if (
          dexEvents.find((event): event is DexPlaceLimitOrderEvent =>
            LimitOrderActions.includes(event.attributes.action)
          )
        ) {
          // update all known users limit orders
          refetch({ cancelRefetch: false });
        }
      };
      // subscribe to all the user's dex messages
      subscriber.subscribeMessage(onUserDexMsg, {
        message: { module: 'dex', Creator: address },
      });
      return () => {
        subscriber.unsubscribeMessage(onUserDexMsg);
      };
    }
  }, [refetch, address]);

  // fetch all pages
  useFetchAllPaginatedPages(result);

  // combine all user limit orders
  const pages = result.data?.pages;
  const userTranches = useMemo(() => {
    return pages?.flatMap((page) => page?.limit_orders || []);
  }, [pages]);

  return useSwrResponseFromReactQuery(userTranches, result);
}
