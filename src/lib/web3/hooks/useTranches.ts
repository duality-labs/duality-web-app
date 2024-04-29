import Long from 'long';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  QueryGetLimitOrderTrancheRequest,
  QueryGetLimitOrderTrancheResponse,
} from '@duality-labs/neutronjs/types/codegen/neutron/dex/query';

import { getPairID } from '../utils/pairs';
import { DexPlaceLimitOrderEvent } from '../utils/events';

import { useDexRpcQueryClient } from '../clients/rpcClients';
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
