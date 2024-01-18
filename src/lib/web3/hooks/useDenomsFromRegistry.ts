import useSWRImmutable from 'swr/immutable';
import { SWRResponse } from 'swr';
import { useEffect, useMemo, useState } from 'react';
import {
  ChainRegistryClient,
  ChainRegistryClientOptions,
  ChainRegistryChainUtil,
} from '@chain-registry/client';
import { Asset, AssetList, Chain } from '@chain-registry/types';
import { useDeepCompareMemoize } from 'use-deep-compare-effect';
import { useDenomTrace } from './useDenomsFromChain';

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

export function useChain(chainName: string | undefined): SWRResponse<Chain> {
  const swr = useChainUtil(chainName ? [chainName] : [], [], {
    fetchRelatedAssets: false,
    fetchRelatedPairs: false,
  });
  return {
    ...swr,
    data: swr.data?.chainInfo.fetcher.getChain(chainName || ''),
  } as SWRResponse;
}

// get chain, defaulting to all related one-hop assets
export function useChainUtil(
  selectedChainNames: string[] = [REACT_APP__CHAIN_NAME],
  selectedAssestListNames?: string[],
  {
    fetchRelatedPairs = true,
    fetchRelatedAssets = true,
  }: { fetchRelatedPairs?: boolean; fetchRelatedAssets?: boolean } = {}
): SWRResponse<ChainRegistryChainUtil> {
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
    return chainRegistryClient.getChainUtil(REACT_APP__CHAIN_NAME);
  }

  return useSWRImmutable(
    ['chain-util', chainNames, ibcNamePairs, assetListNames],
    async (): Promise<ChainRegistryChainUtil> => {
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

// define default options to start exploring without fetching too much data
const defaultChainUtilOptions = {
  chainNames: ['neutrontestnet'],
  selectedAssestListNames: ['neutrontestnet'],
};

// this hook follows denom trace information along chain-registry IBC pair data
// until a matching Asset is found or not
export function useTracedAsset(
  denom?: string
): SWRResponse<{ asset?: Asset; chain?: Chain }> {
  const { path = '' } = useDenomTrace(denom) || {};

  const transferChannels: Array<[portId: string, channelId: string]> =
    useDeepCompareMemoize(
      path
        .split('/')
        .flatMap((path, index, paths) =>
          index % 2 !== 0 ? [[paths[index - 1], path]] : []
        )
    );

  const [{ chainNames, selectedAssestListNames }, setChainUtilOpts] = useState<{
    chainNames: string[];
    selectedAssestListNames: string[];
  }>(defaultChainUtilOptions);

  // get chain util that hopefully has the asset of the denom in question
  const swr = useChainUtil(chainNames, selectedAssestListNames);
  const chainUtil = swr.data;

  // derive the found asset with current IBC data if it can be found
  const asset = useMemo(() => {
    try {
      return denom ? chainUtil?.getAssetByDenom(denom) : undefined;
    } catch {
      // ignore error that asset cannot be found in current IBC data
    }
  }, [chainUtil, denom]);

  // when switching denoms, start path exploration again
  useEffect(() => {
    // reset the chain names
    setChainUtilOpts(defaultChainUtilOptions);
  }, [path]);

  // make chain util fetch deeper into the trace if needed
  useEffect(() => {
    const lastChainName = chainNames.at(-1) || '';
    const ibcData = chainUtil?.chainInfo.fetcher.getChainIbcData(lastChainName);
    const nextTransferChannelIndex = chainNames.length - 1;
    const nextTransferChannel = transferChannels.at(nextTransferChannelIndex);

    // if we don't have all the transfer channel hops covered then fetch more IBC data
    if (!asset && ibcData && lastChainName && nextTransferChannel) {
      const [portId, channelId] = nextTransferChannel;
      for (const ibcDataRow of ibcData) {
        // look up chain 1
        if (ibcDataRow.chain_1.chain_name === lastChainName) {
          const foundChannel = ibcDataRow.channels.find((channel) => {
            return (
              channel.chain_1.channel_id === channelId &&
              channel.chain_1.port_id === portId
            );
          });
          if (foundChannel) {
            setNextChainName(ibcDataRow.chain_2.chain_name);
            break;
          }
        }
        // look up chain 2
        else if (ibcDataRow.chain_2.chain_name === lastChainName) {
          const foundChannel = ibcDataRow.channels.find((channel) => {
            return (
              channel.chain_2.channel_id === channelId &&
              channel.chain_2.port_id === portId
            );
          });
          if (foundChannel) {
            setNextChainName(ibcDataRow.chain_1.chain_name);
            break;
          }
        }
      }
    }

    function setNextChainName(chainName: string) {
      setChainUtilOpts(({ chainNames }) => {
        // if this would be the last step then find the assetlist of this chain
        // otherwise we should keep searching IBC data
        if (chainNames.length >= transferChannels.length) {
          return {
            chainNames,
            selectedAssestListNames: [chainName],
          };
        } else {
          return {
            chainNames: [...chainNames, chainName],
            selectedAssestListNames: [],
          };
        }
      });
    }
  }, [asset, chainNames, chainUtil, transferChannels]);

  // get chain of the asset
  const { data: chain } = useChain(asset && selectedAssestListNames.at(-1));

  return { ...swr, data: { asset, chain } } as SWRResponse;
}
