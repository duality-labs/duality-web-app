import useSWRImmutable from 'swr/immutable';
import { neutron, ibc, cosmos } from '@duality-labs/dualityjs';

type CreateNeutronClient = typeof neutron.ClientFactory.createLCDClient;
type CreateCosmosClient = typeof cosmos.ClientFactory.createLCDClient;
type CreateIbcClient = typeof ibc.ClientFactory.createLCDClient;

type NeutronRestClient = Awaited<ReturnType<CreateNeutronClient>>['neutron'];
type CosmosRestClient = Awaited<ReturnType<CreateCosmosClient>>['cosmos'];
type IbcRestClient = Awaited<ReturnType<CreateIbcClient>>['ibc'];

export type { NeutronRestClient, CosmosRestClient, IbcRestClient };

const { REACT_APP__REST_API: defaultRestEndpoint = '' } = import.meta.env;

// create LCD/REST clients from a cached base client
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
export function useIbcRestClient(restEndpoint = defaultRestEndpoint) {
  return useBaseRestClients(restEndpoint)?.ibc.ibc;
}
