import useSWRImmutable from 'swr/immutable';
import { SWRResponse } from 'swr';
import { useMemo } from 'react';
import {
  ChainRegistryClient,
  ChainRegistryClientOptions,
  ChainRegistryChainUtil,
} from '@chain-registry/client';
import { ibcDenom, getIbcAssetPath } from '@chain-registry/utils';
import { AssetList, Chain } from '@chain-registry/types';
import { DenomTrace } from '@duality-labs/dualityjs/types/codegen/ibc/applications/transfer/v1/transfer';

const {
  REACT_APP__CHAIN_NAME = '',
  REACT_APP__CHAIN_IS_TESTNET = '',
  REACT_APP__CHAIN_REGISTRY_FILE_ENDPOINTS = '["https://registry.ping.pub"]',
  REACT_APP__CHAIN_REGISTRY_PATH_ENDPOINTS = '["https://registry.ping.pub"]',
} = import.meta.env;

const isTestnet = REACT_APP__CHAIN_IS_TESTNET
  ? REACT_APP__CHAIN_IS_TESTNET === 'true'
  : REACT_APP__CHAIN_NAME.endsWith('testnet');

// chain registry endpoints are endpoints where we can get ~up-to-date (cached)
// asset and IBC data. it is expected that this data will change infrequently
const chainRegistryFileEndpoints: string[] = JSON.parse(
  REACT_APP__CHAIN_REGISTRY_FILE_ENDPOINTS
).map((endpoint: string) => (isTestnet ? `${endpoint}/testnets` : endpoint));
const chainRegistryDirectoryEndpoints: string[] = JSON.parse(
  REACT_APP__CHAIN_REGISTRY_PATH_ENDPOINTS
).map((endpoint: string) => (isTestnet ? `${endpoint}/testnets` : endpoint));

type ChainNamePair = [chainName1: string, chainName2: string];

function useAllIbcNamePairs(): Array<[string, string]> | undefined {
  return useSWRImmutable(
    ['chain-registry-client-ibc-pair-list'],
    async (): Promise<Array<ChainNamePair>> => {
      for (const chainRegistryEndpoint of chainRegistryDirectoryEndpoints) {
        try {
          const res = await fetch(`${chainRegistryEndpoint}/_IBC`);
          const json: Array<{ name: string }> = await res.json();
          return (
            json.flatMap(({ name }: { name: string }) => {
              const chainNames = name.split('.')?.at(0)?.split('-');
              if (chainNames && chainNames[0] && chainNames[1]) {
                return [[chainNames[0], chainNames[1]]];
              }
              return [];
            }) || []
          );
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(e);
          // try next endpoint if there is one
        }
      }
      throw new Error('Could not get current chain-registry data');
    },
    {
      // don't retry if we found an error we already tried all endpoints
      shouldRetryOnError: false,
    }
  ).data;
}

function useRelatedIbcNamePairs(
  exploreChainName?: string
): Array<[string, string]> | undefined {
  const allIbcNamePairs = useAllIbcNamePairs();

  return exploreChainName
    ? allIbcNamePairs?.filter((ibcPairChainNames) =>
        ibcPairChainNames.includes(exploreChainName)
      )
    : undefined;
}

// get chain, defaulting to all related one-hop assets
export function useChainClient(
  selectedChainNames: string[] = [REACT_APP__CHAIN_NAME],
  selectedAssestListNames?: string[],
  {
    fetchRelatedPairs = true,
    fetchRelatedAssets = true,
  }: { fetchRelatedPairs?: boolean; fetchRelatedAssets?: boolean } = {}
): SWRResponse<ChainRegistryClient> {
  const ibcNamePairs = useRelatedIbcNamePairs(
    fetchRelatedPairs ? selectedChainNames.at(-1) : undefined
  );
  // ensure chain name is included in each (required for chain util of native chain)
  const chainNames = Array.from(
    new Set([REACT_APP__CHAIN_NAME, ...selectedChainNames])
  );
  // if selected asset lists aren't defined, find all related assets
  const assetListNames = Array.from(
    new Set([
      REACT_APP__CHAIN_NAME,
      ...(selectedAssestListNames ||
        (fetchRelatedAssets && ibcNamePairs?.flat()) ||
        []),
    ])
  );

  // abstract out chain client creation for any chain-registry data endpoint
  async function createChainRegistryClient(opts: ChainRegistryClientOptions) {
    const chainRegistryClient = new ChainRegistryClient(opts);

    // fetch all the URLs
    try {
      await chainRegistryClient.fetchUrls();
    } catch {
      // ignore if a resource throw errors
    }

    // return just the chain utility instance
    // it is possible to get the original fetcher at chainUtil.chainInfo.fetcher
    return chainRegistryClient;
  }

  return useSWRImmutable(
    ['chain-util', chainNames, ibcNamePairs, assetListNames],
    async (): Promise<ChainRegistryClient> => {
      // restrict asset collection to specific chains or
      // check available endpoints for data
      for (const endpoint of chainRegistryFileEndpoints) {
        try {
          return await createChainRegistryClient({
            baseUrl: endpoint,
            // ensure strings arrays have uniques strings
            chainNames,
            assetListNames,
            ibcNamePairs,
          });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(e);
          // try next endpoint if there is one
        }
      }
      throw new Error('Could not get current chain-registry data');
    },
    {
      // don't retry if we found an error we already tried all endpoints
      shouldRetryOnError: false,
    }
  );
}

export function useChainUtil(
  selectedChainNames: string[] = [REACT_APP__CHAIN_NAME],
  selectedAssestListNames?: string[],
  opts: { fetchRelatedPairs?: boolean; fetchRelatedAssets?: boolean } = {}
): SWRResponse<ChainRegistryChainUtil> {
  const swr = useChainClient(selectedChainNames, selectedAssestListNames, opts);
  // return just the chain utility instance
  // it is possible to get the original fetcher at chainUtil.chainInfo.fetcher
  return {
    ...swr,
    data: swr.data?.getChainUtil(REACT_APP__CHAIN_NAME),
  } as SWRResponse;
}

export function useChain(chainName: string | undefined): SWRResponse<Chain> {
  const swr = useChainClient(chainName ? [chainName] : [], [], {
    fetchRelatedAssets: false,
    fetchRelatedPairs: false,
  });
  return {
    ...swr,
    data: swr.data?.getChain(chainName || ''),
  } as SWRResponse;
}

export function useChainNativeAssetList(): AssetList | undefined {
  const { data: client } = useChainClient();
  return useMemo(() => {
    // todo: use chainUtil?.chainInfo.nativeAssetList when types are fixed
    return client?.getChainAssetList(REACT_APP__CHAIN_NAME);
  }, [client]);
}

export function useChainGeneratedAssetLists(): AssetList[] | undefined {
  const { data: client } = useChainClient();
  return useMemo(() => {
    // note: chainUtil.chainInfo.assetLists contains asset lists as they
    //       exist on each chain, generally we will want the ibc denoms of
    //       each asset, which are generated with client.getGeneratedAssetLists
    return client?.getGeneratedAssetLists(REACT_APP__CHAIN_NAME);
  }, [client]);
}

// return all denoms within one hop of the native chain on chain-registry
export function useOneHopDenoms(): string[] {
  const { data: client } = useChainClient();
  return useMemo<string[]>(() => {
    if (client) {
      const assetLists = [
        client.getChainAssetList(REACT_APP__CHAIN_NAME),
        ...(client.getGeneratedAssetLists(REACT_APP__CHAIN_NAME) ?? []),
      ];
      return assetLists.flatMap(
        (assetList) => assetList?.assets.flatMap((asset) => asset.base) ?? []
      );
    }
    return [];
  }, [client]);
}

type DenomTraceByDenom = Map<string, DenomTrace>;

// get denom traces from default IBC network (one-hop)
export function useDefaultDenomTraceByDenom(): SWRResponse<DenomTraceByDenom> {
  const { data: client, ...swr } = useChainClient();

  // find the IBC trace information of each known IBC asset
  const denomTractByDenom = useMemo<DenomTraceByDenom>(() => {
    const assetLists = client?.getGeneratedAssetLists(REACT_APP__CHAIN_NAME);
    const map = new Map<string, DenomTrace>();
    return client && assetLists
      ? assetLists.reduce((acc, assetList) => {
          for (const asset of assetList.assets) {
            const trace = asset.traces?.at(0);
            const counterparty = trace?.counterparty.chain_name;
            const baseDenom = trace?.counterparty.base_denom;
            const ibcAssetPath: Parameters<typeof ibcDenom>['0'] =
              counterparty &&
              baseDenom &&
              getIbcAssetPath(
                client.ibcData,
                REACT_APP__CHAIN_NAME,
                counterparty,
                assetLists,
                baseDenom
              );
            // if the denom has IBC trace information, then add it here
            if (baseDenom && ibcAssetPath) {
              // recreate IBC data into DenomTrace format
              acc.set(asset.base, {
                path: ibcAssetPath
                  .flatMap(({ port_id, channel_id }) => [port_id, channel_id])
                  .join('/'),
                base_denom: baseDenom,
              });
            }
          }
          return acc;
        }, map)
      : map;
  }, [client]);

  return { ...swr, data: denomTractByDenom } as SWRResponse;
}
