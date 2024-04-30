import Long from 'long';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  QueryGetLimitOrderTrancheRequest,
  QueryGetLimitOrderTrancheResponse,
  QueryGetLimitOrderTrancheUserResponse,
} from '@duality-labs/neutronjs/types/codegen/neutron/dex/query';

import { getPairID } from '../utils/pairs';
import { DexPlaceLimitOrderEvent } from '../utils/events';

import { useWeb3 } from '../useWeb3';
import { useDexRpcQueryClient } from '../clients/rpcClients';
import { useDexRestClientPromise } from '../clients/restClients';
import { useSwrResponseFromReactQuery } from './useSWR';

export function useTranche(placeLimitOrderEvent?: DexPlaceLimitOrderEvent) {
  // use RPC client due to denom "/" character parsing issues in the REST API
  const rpcClient = useDexRpcQueryClient();

  const trancheRequest = useMemo<
    QueryGetLimitOrderTrancheRequest | undefined
  >(() => {
    if (placeLimitOrderEvent) {
      const attr = placeLimitOrderEvent.attributes;
      return {
        pair_id: getPairID(attr.TokenZero, attr.TokenOne),
        tick_index: Long.fromString(attr.LimitTick).negate(),
        token_in: attr.TokenIn,
        tranche_key: attr.TrancheKey,
      };
    }
  }, [placeLimitOrderEvent]);

  const { data, ...state } = useQuery({
    queryKey: ['dex.limitOrderTranche', trancheRequest],
    enabled: !!rpcClient && !!trancheRequest,
    queryFn: (): Promise<QueryGetLimitOrderTrancheResponse> | undefined => {
      return trancheRequest && rpcClient?.dex.limitOrderTranche(trancheRequest);
    },
  });

  return useSwrResponseFromReactQuery(data, state);
}

export function useUserTranche(trancheKey?: string) {
  const { address } = useWeb3();
  const restClientPromise = useDexRestClientPromise();

  const { data, ...state } = useQuery({
    queryKey: ['dex.LimitOrderTrancheUser', address, trancheKey],
    enabled: !!address && !!trancheKey,
    queryFn: async (): Promise<
      QueryGetLimitOrderTrancheUserResponse | undefined
    > => {
      const client = await restClientPromise;
      return address && trancheKey
        ? client?.dex.limitOrderTrancheUser({
            address,
            tranche_key: trancheKey,
          })
        : undefined;
    },
  });

  return useSwrResponseFromReactQuery(data, state);
}
