import { HttpEndpoint } from '@cosmjs/tendermint-rpc';

import { useQuery } from '@tanstack/react-query';
import { neutron } from '@duality-labs/dualityjs';
import { useMemo } from 'react';

// import cosmos from '@duality-labs/dualityjs/types/codegen/cosmos/lcd';
import * as packetforward from '@duality-labs/dualityjs/module/codegen/packetforward/lcd';
import * as PacketForward from '@duality-labs/dualityjs/types/codegen/packetforward/lcd';
import * as cosmos from '@duality-labs/dualityjs/module/codegen/cosmos/lcd';
import * as Cosmos from '@duality-labs/dualityjs/types/codegen/cosmos/lcd';

const { REACT_APP__REST_API = '' } = import.meta.env;

export function lcdClient(rpcURL = REACT_APP__REST_API) {
  return neutron.ClientFactory.createLCDClient({ restEndpoint: rpcURL });
}

type LcdClient = Awaited<
  ReturnType<typeof neutron.ClientFactory.createLCDClient>
>;

const _lcdClients: Record<string, LcdClient> = {};

const getLcdEndpointKey = (lcdEndpoint: string | HttpEndpoint) => {
  if (typeof lcdEndpoint === 'string') {
    return lcdEndpoint;
  } else if (lcdEndpoint) {
    return lcdEndpoint.url;
  }
};

const getLcdClient = async (
  lcdEndpoint: string | HttpEndpoint
): Promise<LcdClient> => {
  const key = getLcdEndpointKey(lcdEndpoint);
  if (!key) {
    throw new Error('No LCD endpoint given');
  }
  if (key in _lcdClients) {
    return _lcdClients[key];
  }
  const lcd = await neutron.ClientFactory.createLCDClient({
    restEndpoint: key,
  });
  _lcdClients[key] = lcd;
  return lcd;
};

export default getLcdClient;

/* useRPCPromise: gets an `rpc` value in a promise
 * an RPC promise can easily be used to connect single-use RPC clients
 *   eg. const rpcPromise = useRPCPromise();
 *       // in a hook or callback somewhere
 *       comst cb = useCallback(() => {
 *         const bankClientImpl = cosmos.bank.v1beta1.QueryClientImpl;
 *         const bankClient = new bankClientImpl(await rpcPromise);
 *       });
 */
export function useLcdClientPromise(
  restEndpoint = REACT_APP__REST_API
): Promise<LcdClient> {
  // return a new promise for each provided endpoint
  return useMemo(() => {
    return getLcdClient(restEndpoint);
  }, [restEndpoint]);
}

export function useCosmosLcdClient(restEndpoint = REACT_APP__REST_API) {
  const result = useQuery({
    queryKey: ['useCosmosLcdClient', restEndpoint],
    queryFn: async () => {
      return await (cosmos as typeof Cosmos).createLCDClient({ restEndpoint });
    },
    staleTime: Number.POSITIVE_INFINITY,
  });

  return result.data;
}

export function usePacketForwardMiddlewareLcdClient(
  restEndpoint = REACT_APP__REST_API
) {
  const result = useQuery({
    queryKey: ['usePacketForwardMiddlewareLcdClient', restEndpoint],
    queryFn: async () => {
      return await (packetforward as typeof PacketForward).createLCDClient({
        restEndpoint,
      });
    },
    staleTime: Number.POSITIVE_INFINITY,
  });

  return result.data;
}
