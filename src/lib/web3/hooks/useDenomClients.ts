import useSWRImmutable, { immutable } from 'swr/immutable';
import useSWRInfinite, { SWRInfiniteKeyLoader } from 'swr/infinite';
import { useEffect, useMemo } from 'react';
import { useDeepCompareMemoize } from 'use-deep-compare-effect';
import {
  ChainRegistryClient,
  ChainRegistryClientOptions,
  ChainRegistryChainUtil,
} from '@chain-registry/client';

import { Asset, AssetList, Chain, IBCInfo } from '@chain-registry/types';
import { DenomTrace } from '@duality-labs/dualityjs/types/codegen/ibc/applications/transfer/v1/transfer';

import { useDenomTrace, useDenomTraceByDenom } from './useDenomsFromChain';

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

// export hook for getting a basic chain-registry client for a denom
// note: the client can do more than chainUtil which uses native chain context
export function useAssetClient(denom: string | undefined) {
  const { data: trace } = useDenomTrace(denom);

  return useSWRImmutable(
    ['asset-client', denom, trace],
    async (): Promise<ChainRegistryClient | undefined> => {
      // get asset client if available
      return (
        (denom &&
          getAssetClient(denom, trace || { path: '', base_denom: denom })) ||
        undefined
      );
    }
  );
}

type SWRCommon<Data = unknown, Error = unknown> = {
  isValidating: boolean;
  isLoading: boolean;
  error: Error;
  data: Data | undefined;
};

type AssetByDenom = Map<string, Asset>;
type AssetChainUtilByDenom = Map<string, ChainRegistryChainUtil>;

const concurrentItemCount = 3;

// export hook for getting ChainUtil instances for each denom
export function useAssetChainUtilByDenom(
  denoms: string[] = []
): SWRCommon<AssetChainUtilByDenom> {
  const uniqueDenoms = useDeepCompareMemoize(Array.from(new Set(denoms)));
  const swr1 = useDenomTraceByDenom(uniqueDenoms);
  const { data: denomTraceByDenom } = swr1;

  // fetch a client for each denom and trace
  const { data: pages, ...swr2 } = useSWRInfinite<
    [denom: string, client?: ChainRegistryClient],
    Error,
    SWRInfiniteKeyLoader<
      [denom: string, client?: ChainRegistryClient],
      [denom: string, trace: DenomTrace | undefined, key: string] | null
    >
  >(
    (index: number) => {
      const denom = uniqueDenoms.at(index);
      const trace = denom ? denomTraceByDenom?.get(denom) : undefined;
      // note: you might expect that because the page size is 3
      //       that 3 keys will be evaluated to see if they have changed,
      //       but only 1 key will be evaluated. if the first key has no change
      //       then no other keys will be evaluated and fetch will not be called.
      // todo: refactoring with a dynamic list of useQueries may solve this.
      //       for now, ensure the key is different if more traces are available.
      const traceKeys = Array.from(denomTraceByDenom?.keys() ?? []);
      return denom ? [denom, trace, `asset-client-${traceKeys}`] : null;
    },
    async ([denom, trace]) => {
      return [
        denom,
        denom
          ? await getAssetClient(
              denom,
              trace || { path: '', base_denom: denom }
            )
          : undefined,
      ];
    },
    {
      parallel: true,
      use: [immutable],
      initialSize: concurrentItemCount,
    }
  );

  // get all pages, concurrentItemCount at a time
  const { size, setSize } = swr2;
  useEffect(() => {
    if (size < uniqueDenoms.length) {
      setSize((s) => Math.min(uniqueDenoms.length, s + concurrentItemCount));
    }
  }, [size, setSize, uniqueDenoms]);

  // combine pages into one
  const chainUtilByDenom = useMemo<AssetChainUtilByDenom>(() => {
    return (pages || []).reduce<AssetChainUtilByDenom>(
      (map, [denom, client] = ['']) => {
        // change from asset client to chain utility which should be more useful
        const chainUtil = client?.getChainUtil(REACT_APP__CHAIN_NAME);
        const asset = chainUtil?.getAssetByDenom(denom);
        if (denom && chainUtil && asset) {
          return map.set(denom, chainUtil);
        }
        return map;
      },
      new Map()
    );
  }, [pages]);

  return {
    isValidating: swr1.isValidating || swr2.isValidating,
    isLoading: swr1.isLoading || swr2.isLoading,
    error: swr1.error || swr2.error,
    data: chainUtilByDenom,
  };
}

// export convenienve hook for getting just Assets for each denom
export function useAssetByDenom(
  denoms: string[] = []
): SWRCommon<AssetByDenom> {
  const { data: chainUtilByDenom, ...swr } = useAssetChainUtilByDenom(denoms);

  // substitute chain utils for assets
  const data = useMemo(() => {
    const denoms = Array.from(chainUtilByDenom?.keys() || []);
    return denoms.reduce<AssetByDenom>((map, denom) => {
      const chainUtil = chainUtilByDenom?.get(denom);
      const asset = chainUtil?.getAssetByDenom(denom);
      if (denom && chainUtil && asset) {
        return map.set(denom, asset);
      }
      return map;
    }, new Map());
  }, [chainUtilByDenom]);

  return { ...swr, data };
}

// add a global fetch cache for chain-registry data
// this will work like react-query and swr to prevent multiple fetch queries
// from being sent out when the request is initialized at the same time
// the cache should return any in-progress promises for duplicate URLs
// note: the data here cannot be invalidated and re-requested, which is ok here
const globalFetchPromises = new Map<string, Promise<unknown>>();
function globalFetchCache(url: string): Promise<unknown> {
  const oldPromise = globalFetchPromises.get(url);
  if (oldPromise) {
    return oldPromise;
  }
  const newPromise = fetch(url).then((res) => {
    if (res.status >= 400) {
      throw new Error('Bad response');
    }
    return res.json();
  });
  globalFetchPromises.set(url, newPromise);

  return newPromise;
}

// recursively fetch enough chain-registry data to return a chain-registry
// client that can identify the denom: eg. `chainUtil.getAssetByDenom(denom)`
async function getAssetClient(
  denom: string,
  ibcTrace: DenomTrace
): Promise<ChainRegistryClient | undefined> {
  const transferChannels: Array<[portId: string, channelId: string]> =
    ibcTrace.path
      .split('/')
      .flatMap((path, index, paths) =>
        index % 2 !== 0 ? [[paths[index - 1], path]] : []
      );

  async function getClient(
    opts: ChainRegistryClientOptions
  ): Promise<ChainRegistryClient> {
    for (const endpoint of chainRegistryFileEndpoints) {
      try {
        const client = new ChainRegistryClient({
          ...opts,
          baseUrl: endpoint,
        });
        // update client with cached or uncached fetch data
        await Promise.all(
          client.urls.map((url) =>
            globalFetchCache(url).then((data) =>
              client.update(data as Chain | AssetList | IBCInfo)
            )
          )
        );
        return client;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        // try next endpoint if there is one
      }
    }
    throw new Error('Could not get current chain-registry data');
  }

  async function getIbcNamePairs(): Promise<ChainNamePair[]> {
    for (const chainRegistryEndpoint of chainRegistryDirectoryEndpoints) {
      try {
        const data = await globalFetchCache(`${chainRegistryEndpoint}/_IBC`);
        const json = data as Array<{ name: string }>;
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
  }

  // get IBC name pairs related to a chain
  async function getRelatedIbcNamePairs(exploreChainName: string) {
    const allIbcNamePairs = await getIbcNamePairs();
    return exploreChainName
      ? allIbcNamePairs?.filter((ibcPairChainNames) =>
          ibcPairChainNames.includes(exploreChainName)
        )
      : undefined;
  }

  async function getAssetClient(
    opts: ChainRegistryClientOptions
  ): Promise<ChainRegistryClient | undefined> {
    const client = await getClient(opts);
    try {
      // return successfully if we found the asset
      const chainUtil = client.getChainUtil(REACT_APP__CHAIN_NAME);
      if (chainUtil.getAssetByDenom(denom)) {
        return client;
      }
    } catch {
      // if the asset was not found, then determine if we should fetch more data
      const lastChainName = opts.chainNames.at(-1) || '';
      const ibcData = client.getChainIbcData(lastChainName);
      const nextTransferChannelIndex = opts.chainNames.length - 1;
      const nextTransferChannel = transferChannels.at(nextTransferChannelIndex);

      // if we don't have all the channel hops covered then fetch more IBC data
      if (ibcData && lastChainName && nextTransferChannel) {
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
              return getNextChainNameClient(ibcDataRow.chain_2.chain_name);
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
              return getNextChainNameClient(ibcDataRow.chain_1.chain_name);
            }
          }
        }
      }
    }

    async function getNextChainNameClient(chainName: string) {
      // if this would be the last step then find the assetlist of this chain
      // otherwise we should keep searching IBC data

      if (opts.chainNames.length >= transferChannels.length) {
        return getAssetClient({
          ...opts,
          assetListNames: [REACT_APP__CHAIN_NAME, chainName],
        });
      } else {
        return getAssetClient({
          ...opts,
          chainNames: [...opts.chainNames, chainName],
          ibcNamePairs: await getRelatedIbcNamePairs(chainName),
        });
      }
    }
  }

  // start recursive chain with just native assets and all related IBC info
  return getAssetClient({
    chainNames: [REACT_APP__CHAIN_NAME],
    ibcNamePairs: await getRelatedIbcNamePairs(REACT_APP__CHAIN_NAME),
    assetListNames: [REACT_APP__CHAIN_NAME],
  });
}
