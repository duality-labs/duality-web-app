import useSWRImmutable from 'swr/immutable';
import { useMemo } from 'react';
import {
  ChainRegistryClient,
  ChainRegistryChainUtil,
} from '@chain-registry/client';

const {
  REACT_APP__CHAIN_NAME = '',
  REACT_APP__CHAIN_IS_TESTNET = '',
  REACT_APP__CHAIN_REGISTRY_CHAIN_NAMES = '',
  REACT_APP__CHAIN_REGISTRY_ENDPOINTS = '["https://registry.ping.pub"]',
} = process.env;

const isTestnet = REACT_APP__CHAIN_IS_TESTNET
  ? REACT_APP__CHAIN_IS_TESTNET === 'true'
  : REACT_APP__CHAIN_NAME.endsWith('testnet');

// chain names are the other chains that we will get IBC connection data for
// in the chain-registry, eg. "celestia" for "_IBC/celestia-neutron.json" in:
// https://github.com/cosmos/chain-registry/pull/3100/files
const chainRegistryChainNames: string[] = JSON.parse(
  REACT_APP__CHAIN_REGISTRY_CHAIN_NAMES || '[]'
);

// chain registry endpoints are endpoints where we can get ~up-to-date (cached)
// asset and IBC data. it is expected that this data will change infrequently
const chainRegistryEndpoints: string[] = JSON.parse(
  REACT_APP__CHAIN_REGISTRY_ENDPOINTS
).map((endpoint: string) => (isTestnet ? `${endpoint}/testnets` : endpoint));

export function useChainUtil(chainName = REACT_APP__CHAIN_NAME) {
  // abstract out chain client creation for any chain-registry data endpoint
  async function createChainRegistryClient(chainRegistryEndpoint: string) {
    const chainRegistryClient = new ChainRegistryClient({
      baseUrl: chainRegistryEndpoint,
      chainNames: Array.from(new Set([chainName, ...chainRegistryChainNames])),
    });

    // remove irrelevant IBC data from initial fetch
    chainRegistryClient.urls = chainRegistryClient.urls.filter((url) => {
      const ibcPair = url.split('/_IBC/').at(1)?.split('.').at(0)?.split('-');
      // filter to non-IBC URLs and IBC URLs related to the current chain
      return !ibcPair || ibcPair.includes(chainName);
    });

    // fetch all the URLs
    await chainRegistryClient.fetchUrls();

    // return just the chain utility instance
    // it is possible to get the original fetcher at chainUtil.chainInfo.fetcher
    return chainRegistryClient.getChainUtil(chainName);
  }

  return useSWRImmutable(
    ['chain-registry-client', chainName],
    async (): Promise<ChainRegistryChainUtil> => {
      for (const chainRegistryEndpoint of chainRegistryEndpoints) {
        try {
          return await createChainRegistryClient(chainRegistryEndpoint);
        } catch {
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

export function useNativeChainAssetList(chainName?: string) {
  const chainUtil = useChainUtil(chainName);
  return useMemo(() => {
    // todo: use chainUtil?.chainInfo.nativeAssetList when types are fixed
    return chainUtil?.chainInfo.fetcher.getChainAssetList(chainUtil.chainName);
  }, [chainUtil]);
}

export function useIBCChainAssetLists(chainName?: string) {
  const chainUtil = useChainUtil(chainName);
  return useMemo(() => {
    // todo: use chainUtil?.chainInfo.assetLists when types are fixed
    return chainUtil?.chainInfo.fetcher.getChainAssetList(chainUtil.chainName);
  }, [chainUtil]);
}

export function useChainAssetLists(chainName?: string) {
  const chainUtil = useChainUtil(chainName);
  return useMemo(() => chainUtil?.chainInfo.fetcher.assetLists, [chainUtil]);
}
