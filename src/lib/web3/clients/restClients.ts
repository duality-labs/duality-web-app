import useSWRImmutable from 'swr/immutable';
import { neutron, ibc, cosmos, packetforward } from '@duality-labs/neutronjs';
import { useMemo } from 'react';

type CreateDexClient = typeof neutron.ClientFactory.createLCDClient;
type CreateCosmosClient = typeof cosmos.ClientFactory.createLCDClient;
type CreateIbcClient = typeof ibc.ClientFactory.createLCDClient;
type CreatePacketClient = typeof packetforward.ClientFactory.createLCDClient;

type DexRestClient = Awaited<ReturnType<CreateDexClient>>['neutron'];
type CosmosRestClient = Awaited<ReturnType<CreateCosmosClient>>['cosmos'];
type IbcRestClient = Awaited<ReturnType<CreateIbcClient>>['ibc'];
type PacketRestClient = Awaited<
  ReturnType<CreatePacketClient>
>['packetforward'];

export type {
  DexRestClient,
  CosmosRestClient,
  IbcRestClient,
  PacketRestClient,
};

const { REACT_APP__REST_API = '' } = import.meta.env;
const defaultRestEndpoint: string = REACT_APP__REST_API;

// create base getter helpers
export async function getDexRestClient(restEndpoint = defaultRestEndpoint) {
  const client = await neutron.ClientFactory.createLCDClient({ restEndpoint });
  return client.neutron;
}
export async function getCosmosRestClient(restEndpoint = defaultRestEndpoint) {
  const client = await cosmos.ClientFactory.createLCDClient({ restEndpoint });
  return client.cosmos;
}
export async function getIbcRestClient(restEndpoint = defaultRestEndpoint) {
  const client = await ibc.ClientFactory.createLCDClient({ restEndpoint });
  return client.ibc;
}
export async function getPacketRestClient(restEndpoint = defaultRestEndpoint) {
  const client = await packetforward.ClientFactory.createLCDClient({
    restEndpoint,
  });
  return client.packetforward;
}

// create LCD/REST client hooks from a cached base client
// note: these `createLCDClient` functions don't create network requests
//       so putting these together here in one SWR hook is fine
function useBaseRestClients(restEndpoint?: string) {
  return useSWRImmutable(['rest-clients', restEndpoint], async () => {
    return {
      ibc: await getIbcRestClient(restEndpoint),
      cosmos: await getCosmosRestClient(restEndpoint),
      neutron: await getDexRestClient(restEndpoint),
      packetforward: await getPacketRestClient(restEndpoint),
    };
  }).data;
}

export function useDexRestClient(restEndpoint?: string) {
  return useBaseRestClients(restEndpoint)?.neutron;
}
export function useCosmosRestClient(restEndpoint?: string) {
  return useBaseRestClients(restEndpoint)?.cosmos;
}
export function useIbcRestClient(restEndpoint?: string) {
  return useBaseRestClients(restEndpoint)?.ibc;
}
export function usePacketForwardRestClient(restEndpoint?: string) {
  return useBaseRestClients(restEndpoint)?.packetforward;
}

// create promise hooks, useful for when clients are needed in cached queries
export function useDexRestClientPromise(restEndpoint?: string) {
  return useMemo(async () => getDexRestClient(restEndpoint), [restEndpoint]);
}
export function useCosmosRestClientPromise(restEndpoint?: string) {
  return useMemo(async () => getCosmosRestClient(restEndpoint), [restEndpoint]);
}
export function useIbcRestClientPromise(restEndpoint?: string) {
  return useMemo(async () => getIbcRestClient(restEndpoint), [restEndpoint]);
}
export function usePacketForwardRestClientPromise(restEndpoint?: string) {
  return useMemo(async () => getPacketRestClient(restEndpoint), [restEndpoint]);
}
