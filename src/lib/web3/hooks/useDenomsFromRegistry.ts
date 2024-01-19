import useSWRImmutable from 'swr/immutable';
import { SWRResponse } from 'swr';
import { useMemo } from 'react';
import {
  ChainRegistryClient,
  ChainRegistryClientOptions,
  ChainRegistryChainUtil,
} from '@chain-registry/client';
import { Asset, AssetList, Chain } from '@chain-registry/types';

import { useDenomTrace } from './useDenomsFromChain';
import { useAssetClient } from './useDenomClients';

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
  const { data: chainUtil } = useChainUtil();
  return useMemo(() => {
    // todo: use chainUtil?.chainInfo.nativeAssetList when types are fixed
    return chainUtil?.chainInfo.nativeAssetLists;
  }, [chainUtil]);
}

export function useChainIbcAssetList(): AssetList | undefined {
  const { data: chainUtil } = useChainUtil();
  return useMemo(() => {
    // todo: use chainUtil?.chainInfo.assetLists when types are fixed
    return chainUtil?.chainInfo.fetcher.getChainAssetList(chainUtil.chainName);
  }, [chainUtil]);
}

export function useChainAssetLists() {
  const { data: chainUtil } = useChainUtil();
  return useMemo(() => chainUtil?.chainInfo.fetcher.assetLists, [chainUtil]);
}

// this hook follows denom trace information along chain-registry IBC pair data
// until a matching Asset is found or not
export function useTracedAsset(
  denom: string | undefined
): SWRResponse<{ asset?: Asset; chain?: Chain }> {
  const { data: client, ...swr } = useAssetClient(denom);
  const trace = useDenomTrace(denom);
  const asset = useMemo(() => {
    try {
      return (
        denom &&
        client?.getChainUtil(REACT_APP__CHAIN_NAME).getAssetByDenom(denom)
      );
    } catch {
      // ignore
    }
  }, [client, denom]);
  const chain = useMemo(() => {
    try {
      // if there is a trace, generate the asset lists to find the asset chain
      if (trace) {
        const chainName =
          asset &&
          client
            ?.getGeneratedAssetLists(REACT_APP__CHAIN_NAME)
            .find((assetList) => {
              return assetList.assets.find(({ base }) => base === asset.base);
            })?.chain_name;
        return chainName && client?.getChain(chainName);
      }
      // if there is no trace then the asset is probably of the native chain
      else {
        return client?.getChain(REACT_APP__CHAIN_NAME);
      }
    } catch {
      // ignore
    }
  }, [trace, asset, client]);

  return { ...swr, data: { asset, chain } } as SWRResponse;
}
