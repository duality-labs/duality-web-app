import useSWRImmutable from 'swr/immutable';
import { QueryClient, createProtobufRpcClient } from '@cosmjs/stargate';
import { Tendermint34Client } from '@cosmjs/tendermint-rpc';
import { neutron, ibc, cosmos } from '@duality-labs/dualityjs';

const { REACT_APP__RPC_API: defaultRpcEndpoint = '' } = import.meta.env;

// create RPC query clients from a cached base client
export function useRPC(rpcEndpoint = defaultRpcEndpoint) {
  return useSWRImmutable(['rpc', rpcEndpoint], async () => {
    const tmClient = await Tendermint34Client.connect(rpcEndpoint);
    const client = new QueryClient(tmClient);
    return createProtobufRpcClient(client);
  }).data;
}

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

export function useNeutronRpcQueryClient(rpcEndpoint = defaultRpcEndpoint) {
  return useBaseRpcQueryClients(rpcEndpoint)?.neutron.neutron;
}
export function useCosmosRpcQueryClient(rpcEndpoint = defaultRpcEndpoint) {
  return useBaseRpcQueryClients(rpcEndpoint)?.cosmos.cosmos;
}
export function useIbcRpcQueryClient(rpcEndpoint = defaultRpcEndpoint) {
  return useBaseRpcQueryClients(rpcEndpoint)?.ibc.ibc;
}
