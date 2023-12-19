import useSWRImmutable from 'swr/immutable';
import { QueryClient, createProtobufRpcClient } from '@cosmjs/stargate';
import { Tendermint34Client } from '@cosmjs/tendermint-rpc';
import { neutron, ibc, cosmos } from '@duality-labs/neutronjs';

const { REACT_APP__RPC_API: defaultRpcEndpoint = '' } = import.meta.env;

// create RPC clients from a cached base client
// note: these `createRPCQueryClient` functions don't create network requests
//       so putting these together here in one SWR hook is fine
function useBaseRpcQueryClients(rpcEndpoint: string) {
  return useSWRImmutable(['rpc-query-clients', rpcEndpoint], async () => {
    const config = { rpcEndpoint };
    return {
      ibc: await ibc.ClientFactory.createRPCQueryClient(config),
      cosmos: await cosmos.ClientFactory.createRPCQueryClient(config),
      neutron: await neutron.ClientFactory.createRPCQueryClient(config),
    };
  }).data;
}

export function useDexRpcQueryClient(rpcEndpoint = defaultRpcEndpoint) {
  return useBaseRpcQueryClients(rpcEndpoint)?.neutron.neutron;
}
export function useCosmosRpcQueryClient(rpcEndpoint = defaultRpcEndpoint) {
  return useBaseRpcQueryClients(rpcEndpoint)?.cosmos.cosmos;
}
export function useIbcRpcQueryClient(rpcEndpoint = defaultRpcEndpoint) {
  return useBaseRpcQueryClients(rpcEndpoint)?.ibc.ibc;
}

// create RPC query clients from a cached base client
// note: the `Tendermint34Client.connect` function does create a network request
//       so it is helpful to cache this once per endpoint here
function useRPC(rpcEndpoint = defaultRpcEndpoint) {
  return useSWRImmutable(['rpc', rpcEndpoint], async () => {
    const tmClient = await Tendermint34Client.connect(rpcEndpoint);
    const client = new QueryClient(tmClient);
    return createProtobufRpcClient(client);
  }).data;
}

function useBaseRpcTxClients(rpcEndpoint = defaultRpcEndpoint) {
  const rpc = useRPC(rpcEndpoint);
  return useSWRImmutable(
    ['rpc-tx-clients', rpcEndpoint],
    rpc
      ? async () => {
          const config = { rpc };
          return {
            ibc: await ibc.ClientFactory.createRPCMsgClient(config),
            cosmos: await cosmos.ClientFactory.createRPCMsgClient(config),
            neutron: await neutron.ClientFactory.createRPCMsgClient(config),
          };
        }
      : null
  ).data;
}

export function useDexRpcTxClient(rpcEndpoint = defaultRpcEndpoint) {
  return useBaseRpcTxClients(rpcEndpoint)?.neutron.neutron;
}
export function useCosmosRpcTxClient(rpcEndpoint = defaultRpcEndpoint) {
  return useBaseRpcTxClients(rpcEndpoint)?.cosmos.cosmos;
}
export function useIbcRpcTxClient(rpcEndpoint = defaultRpcEndpoint) {
  return useBaseRpcTxClients(rpcEndpoint)?.ibc.ibc;
}
