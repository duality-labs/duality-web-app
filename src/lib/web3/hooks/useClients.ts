import useSWRImmutable from 'swr/immutable';
import { QueryClient, createProtobufRpcClient } from '@cosmjs/stargate';
import { Tendermint34Client } from '@cosmjs/tendermint-rpc';
import { neutron, ibc, cosmos } from '@duality-labs/dualityjs';

const {
  REACT_APP__RPC_API: defaultRpcEndpoint = '',
  REACT_APP__REST_API: defaultRestEndpoint = '',
} = import.meta.env;

function useBaseRestClients(restEndpoint: string) {
  return useSWRImmutable(['rest-clients', restEndpoint], async () => {
    const config = { restEndpoint };
    return {
      ibc: await ibc.ClientFactory.createLCDClient(config),
      cosmos: await cosmos.ClientFactory.createLCDClient(config),
      neutron: await neutron.ClientFactory.createLCDClient(config),
    };
  }).data;
}

export function useNeutronRestClient(restEndpoint = defaultRestEndpoint) {
  return useBaseRestClients(restEndpoint)?.neutron.neutron;
}
export function useCosmosRestClient(restEndpoint = defaultRestEndpoint) {
  return useBaseRestClients(restEndpoint)?.cosmos.cosmos;
}
export function useIBCRestClient(restEndpoint = defaultRestEndpoint) {
  return useBaseRestClients(restEndpoint)?.ibc.ibc;
}

function useRPC(rpcEndpoint = defaultRpcEndpoint) {
  return useSWRImmutable(['rpc', rpcEndpoint], async () => {
    const tmClient = await Tendermint34Client.connect(rpcEndpoint);
    const client = new QueryClient(tmClient);
    return createProtobufRpcClient(client);
  }).data;
}

export function useRPCQueryClient(rpcEndpoint = defaultRpcEndpoint) {
  const rpc = useRPC(rpcEndpoint);
  return useSWRImmutable(['rpc-query-client', rpcEndpoint], () => {
    return rpc && neutron.ClientFactory.createRPCQueryClient({ rpcEndpoint });
  }).data;
}

export function useNeutronTxClient(rpcEndpoint = defaultRpcEndpoint) {
  const rpc = useRPC(rpcEndpoint);
  return useSWRImmutable(['neutron-rpc-msg-client', rpcEndpoint], () => {
    return rpc && neutron.ClientFactory.createRPCMsgClient({ rpc });
  }).data?.neutron;
}
export function useCosmosTxClient(rpcEndpoint = defaultRpcEndpoint) {
  const rpc = useRPC(rpcEndpoint);
  return useSWRImmutable(['cosmos-rpc-msg-client', rpcEndpoint], () => {
    return rpc && cosmos.ClientFactory.createRPCMsgClient({ rpc });
  }).data?.cosmos;
}

export function useIBCTxClient(rpcEndpoint = defaultRpcEndpoint) {
  const rpc = useRPC(rpcEndpoint);
  return useSWRImmutable(['ibc-rpc-msg-client', rpcEndpoint], () => {
    return rpc && ibc.ClientFactory.createRPCMsgClient({ rpc });
  }).data?.ibc;
}
