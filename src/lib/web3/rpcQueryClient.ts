import {
  QueryClient,
  createProtobufRpcClient,
  ProtobufRpcClient,
} from '@cosmjs/stargate';
import { Tendermint37Client, HttpEndpoint } from '@cosmjs/tendermint-rpc';

import { useMemo } from 'react';

const { REACT_APP__RPC_API = '' } = process.env;

const getRpcEndpointKey = (
  rpcEndpoint: string | HttpEndpoint = REACT_APP__RPC_API
) => {
  if (typeof rpcEndpoint === 'string') {
    return rpcEndpoint;
  } else if (!!rpcEndpoint) {
    return rpcEndpoint.url;
  }
};

const _rpcClients: Record<string, ProtobufRpcClient> = {};
const getRpcClient = async (
  rpcEndpoint?: string | HttpEndpoint
): Promise<ProtobufRpcClient> => {
  const key = getRpcEndpointKey(rpcEndpoint);
  if (!key) {
    throw new Error('No RPC endpoint given');
  }
  if (_rpcClients.hasOwnProperty(key)) {
    return _rpcClients[key];
  }
  const tmClient = await Tendermint37Client.connect(key);
  const client = new QueryClient(tmClient);
  const rpc = createProtobufRpcClient(client);
  _rpcClients[key] = rpc;
  return rpc;
};

/* useRPCPromise: gets an `rpc` value in a promise
 * an RPC promise can easily be used to connect single-use RPC clients
 *   eg. const rpcPromise = useRPCPromise();
 *       // in a hook or callback somewhere
 *       comst cb = useCallback(() => {
 *         const bankClientImpl = cosmos.bank.v1beta1.QueryClientImpl;
 *         const bankClient = new bankClientImpl(await rpcPromise);
 *       });
 */
export function useRpcPromise(
  rpcEndpoint?: string | HttpEndpoint
): Promise<ProtobufRpcClient> {
  // return a new promise for each provided endpoint
  return useMemo(() => {
    return getRpcClient(rpcEndpoint);
  }, [rpcEndpoint]);
}
