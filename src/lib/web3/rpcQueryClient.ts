import {
  QueryClient,
  createProtobufRpcClient,
  ProtobufRpcClient,
} from '@cosmjs/stargate';
import {
  Tendermint37Client,
  HttpClient,
  HttpEndpoint,
} from '@cosmjs/tendermint-rpc';

import { useMemo } from 'react';

const { REACT_APP__RPC_API = '' } = process.env;

export const getTendermintClient = async (
  rpcEndpoint: string | HttpEndpoint = REACT_APP__RPC_API
): Promise<Tendermint37Client> => {
  if (!rpcEndpoint) {
    throw new Error('No RPC endpoint given');
  }
  const httpClient = new HttpClient(rpcEndpoint);
  const tmClient = await Tendermint37Client.create(httpClient);
  return tmClient;
};

const getRpcClient = async (
  rpcEndpoint?: string | HttpEndpoint
): Promise<ProtobufRpcClient> => {
  const tmClient = await getTendermintClient(rpcEndpoint);
  const client = new QueryClient(tmClient);
  return createProtobufRpcClient(client);
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
