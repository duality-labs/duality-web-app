import useSWRImmutable from 'swr/immutable';
import { duality, ibc, cosmos } from '@duality-labs/dualityjs';

type CreateDexClient = typeof duality.ClientFactory.createLCDClient;
type CreateCosmosClient = typeof cosmos.ClientFactory.createLCDClient;
type CreateIbcClient = typeof ibc.ClientFactory.createLCDClient;

type DexRestClient = Awaited<ReturnType<CreateDexClient>>['duality'];
type CosmosRestClient = Awaited<ReturnType<CreateCosmosClient>>['cosmos'];
type IbcRestClient = Awaited<ReturnType<CreateIbcClient>>['ibc'];

export type { DexRestClient, CosmosRestClient, IbcRestClient };

const { REACT_APP__REST_API: defaultRestEndpoint = '' } = import.meta.env;

// create LCD/REST clients from a cached base client
// note: these `createLCDClient` functions don't create network requests
//       so putting these together here in one SWR hook is fine
function useBaseRestClients(restEndpoint: string) {
  return useSWRImmutable(['rest-clients', restEndpoint], async () => {
    const config = { restEndpoint };
    return {
      ibc: await ibc.ClientFactory.createLCDClient(config),
      cosmos: await cosmos.ClientFactory.createLCDClient(config),
      duality: await duality.ClientFactory.createLCDClient(config),
    };
  }).data;
}

export function useDexRestClient(restEndpoint = defaultRestEndpoint) {
  return useBaseRestClients(restEndpoint)?.duality.duality;
}
export function useCosmosRestClient(restEndpoint = defaultRestEndpoint) {
  return useBaseRestClients(restEndpoint)?.cosmos.cosmos;
}
export function useIbcRestClient(restEndpoint = defaultRestEndpoint) {
  return useBaseRestClients(restEndpoint)?.ibc.ibc;
}
