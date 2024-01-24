import useSWRImmutable from 'swr/immutable';
import { SWRResponse } from 'swr';
import { useMemo } from 'react';
import {
  ChainRegistryClient,
  ChainRegistryClientOptions,
  ChainRegistryChainUtil,
} from '@chain-registry/client';
import { ibcDenom, getIbcAssetPath } from '@chain-registry/utils';
import { Asset, AssetList, Chain, IBCInfo } from '@chain-registry/types';
import { DenomTrace } from '@duality-labs/dualityjs/types/codegen/ibc/applications/transfer/v1/transfer';

const {
  REACT_APP__CHAIN_NAME = '',
  REACT_APP__CHAIN_IS_TESTNET = '',
  REACT_APP__CHAIN_REGISTRY_FILE_ENDPOINTS = '["https://registry.ping.pub"]',
  REACT_APP__CHAIN_REGISTRY_PATH_ENDPOINTS = '["https://registry.ping.pub"]',
  REACT_APP__CHAIN_REGISTRY_ASSET_LISTS = '',
  REACT_APP__CHAIN_REGISTRY_CHAINS = '',
  REACT_APP__CHAIN_REGISTRY_IBC_DATA = '',
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

// default chain-registry data can be used to supplement chain-registry data
const defaultAssetLists: AssetList[] = REACT_APP__CHAIN_REGISTRY_ASSET_LISTS
  ? JSON.parse(REACT_APP__CHAIN_REGISTRY_ASSET_LISTS)
  : undefined;
const defaultChains: Chain[] = REACT_APP__CHAIN_REGISTRY_CHAINS
  ? JSON.parse(REACT_APP__CHAIN_REGISTRY_CHAINS)
  : undefined;
const defaultIbcData: IBCInfo[] = REACT_APP__CHAIN_REGISTRY_IBC_DATA
  ? JSON.parse(REACT_APP__CHAIN_REGISTRY_IBC_DATA)
  : undefined;
const defaultClientOptions = {
  assetLists: defaultAssetLists,
  chains: defaultChains,
  ibcData: defaultIbcData,
};

type ChainNamePair = [chainName1: string, chainName2: string];

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

async function createChainRegistryClient(
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
          globalFetchCache(url).then((data) => {
            // find matching data to merge
            const assetListOrChain = data as AssetList | Chain;
            if (assetListOrChain.chain_name === REACT_APP__CHAIN_NAME) {
              // merge current chain asset data with default chain asset data
              const assetList = data as AssetList;
              if (
                defaultAssetLists &&
                assetList.$schema?.endsWith('/assetlist.schema.json')
              ) {
                const defaultAssetList = defaultAssetLists.find(
                  ({ chain_name }) => chain_name === assetList.chain_name
                )?.assets;
                return client.update({
                  ...assetList,
                  // add matched chain name assets over default assets by base
                  assets: assetList.assets.reduce<Asset[]>((acc, asset) => {
                    const found = acc.find(({ base }) => base === asset.base);
                    // merge asset
                    if (found) {
                      acc[acc.indexOf(found)] = { ...found, ...asset };
                    }
                    // or add asset
                    else {
                      acc.push(asset);
                    }
                    return acc;
                  }, defaultAssetList?.slice() ?? []),
                });
              }
              // merge current chain data with default chain data
              const chain = data as Chain;
              if (
                defaultChains &&
                chain.$schema?.endsWith('/chain.schema.json')
              ) {
                const defaultChain = defaultChains.find(
                  ({ chain_name }) => chain_name === chain.chain_name
                );
                return client.update({ ...defaultChain, ...chain });
              }
            }
            return client.update(data as Chain | AssetList | IBCInfo);
          })
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

// recursively fetch enough chain-registry data to return a chain-registry
// client that can identify the denom: eg. `chainUtil.getAssetByDenom(denom)`
export async function getAssetClient(
  denom: string | undefined,
  ibcTrace?: DenomTrace
): Promise<ChainRegistryClient | undefined> {
  const transferChannels: Array<[portId: string, channelId: string]> = (
    ibcTrace?.path ?? ''
  )
    .split('/')
    .flatMap((path, index, paths) =>
      index % 2 !== 0 ? [[paths[index - 1], path]] : []
    );

  async function _getAssetClient(
    opts: ChainRegistryClientOptions
  ): Promise<ChainRegistryClient | undefined> {
    const client = await createChainRegistryClient(opts);
    try {
      // return successfully if we found the asset
      const chainUtil = client.getChainUtil(REACT_APP__CHAIN_NAME);
      if (!denom || chainUtil.getAssetByDenom(denom)) {
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
              return _getNextChainNameClient(ibcDataRow.chain_2.chain_name);
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
              return _getNextChainNameClient(ibcDataRow.chain_1.chain_name);
            }
          }
        }
      }
    }

    async function _getNextChainNameClient(chainName: string) {
      // if this would be the last step then find the assetlist of this chain
      // otherwise we should keep searching IBC data

      if (opts.chainNames.length >= transferChannels.length) {
        return _getAssetClient({
          ...opts,
          assetListNames: [REACT_APP__CHAIN_NAME, chainName],
          // also fetch the chain data so we know the asset chain id and name
          chainNames: [...opts.chainNames, chainName],
        });
      } else {
        return _getAssetClient({
          ...opts,
          chainNames: [...opts.chainNames, chainName],
          ibcNamePairs: await getRelatedIbcNamePairs(chainName),
        });
      }
    }
  }

  // start recursive chain with just native assets and all related IBC info
  return _getAssetClient({
    ...defaultClientOptions,
    chainNames: [REACT_APP__CHAIN_NAME],
    ibcNamePairs: await getRelatedIbcNamePairs(REACT_APP__CHAIN_NAME),
    assetListNames: [REACT_APP__CHAIN_NAME],
  });
}

// export hook for getting a basic chain-registry client for the native chain
export async function getChainClient(chainName: string) {
  return createChainRegistryClient({
    ...defaultClientOptions,
    chainNames: [chainName],
    assetListNames: [chainName],
  });
}

// export hook for getting a chain-registry client for one-hop related chains
export function useNativeChainClient() {
  return useSWRImmutable(
    ['native-chain-client'],
    async (): Promise<ChainRegistryClient | undefined> => {
      // get asset client for all assets within one-hop of the native chain
      return getChainClient(REACT_APP__CHAIN_NAME);
    }
  );
}

// export hook for getting a basic chain-registry client
// default to client for native chain assets
// note: the client can do more than chainUtil which uses native chain context
function useNativeAssetsClient() {
  return useSWRImmutable(
    ['asset-client-native'],
    async (): Promise<ChainRegistryClient | undefined> => {
      // get asset client for all assets within one-hop of the native chain
      return createChainRegistryClient({
        ...defaultClientOptions,
        chainNames: [REACT_APP__CHAIN_NAME],
        assetListNames: [REACT_APP__CHAIN_NAME],
      });
    }
  );
}

// export hook for getting a basic chain-registry client for a denom
// defaults to client for all related one-hop assets
// note: the client can do more than chainUtil which uses native chain context
function useDefaultAssetsClient() {
  return useSWRImmutable(
    ['asset-client'],
    async (): Promise<ChainRegistryClient | undefined> => {
      // get asset client for all assets within one-hop of the native chain
      const ibcNamePairs = await getRelatedIbcNamePairs(REACT_APP__CHAIN_NAME);
      const relatedChainNames = Array.from(new Set(ibcNamePairs?.flat()));
      return createChainRegistryClient({
        ...defaultClientOptions,
        chainNames: [REACT_APP__CHAIN_NAME],
        ibcNamePairs,
        assetListNames: relatedChainNames,
      });
    }
  );
}

export function useChainUtil(): SWRResponse<ChainRegistryChainUtil> {
  const swr = useDefaultAssetsClient();
  // return just the chain utility instance
  // it is possible to get the original fetcher at chainUtil.chainInfo.fetcher
  return {
    ...swr,
    data: swr.data?.getChainUtil(REACT_APP__CHAIN_NAME),
  } as SWRResponse;
}

export function useChainNativeAssetList(): AssetList | undefined {
  const { data: client } = useDefaultAssetsClient();
  return useMemo(() => {
    // todo: use chainUtil?.chainInfo.nativeAssetList when types are fixed
    return client?.getChainAssetList(REACT_APP__CHAIN_NAME);
  }, [client]);
}

export function useChainGeneratedAssetLists(): AssetList[] | undefined {
  const { data: client } = useDefaultAssetsClient();
  return useMemo(() => {
    // note: chainUtil.chainInfo.assetLists contains asset lists as they
    //       exist on each chain, generally we will want the ibc denoms of
    //       each asset, which are generated with client.getGeneratedAssetLists
    return client?.getGeneratedAssetLists(REACT_APP__CHAIN_NAME);
  }, [client]);
}

// return all native denoms of the native chain on chain-registry
export function useNativeDenoms(): string[] {
  const { data: client } = useNativeAssetsClient();
  return useMemo<string[]>(() => {
    if (client) {
      const assetList = client.getChainAssetList(REACT_APP__CHAIN_NAME);
      return assetList?.assets.map((asset) => asset.base) ?? [];
    }
    return [];
  }, [client]);
}

// return all denoms within one hop of the native chain on chain-registry
export function useOneHopDenoms(): string[] {
  const { data: client } = useDefaultAssetsClient();
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

function getDenomTraceFromAsset(
  client: ChainRegistryClient,
  asset: Asset,
  assetLists: AssetList[] = client.getGeneratedAssetLists(REACT_APP__CHAIN_NAME)
): DenomTrace | undefined {
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

  return baseDenom && ibcAssetPath
    ? {
        path: ibcAssetPath
          .flatMap(({ port_id, channel_id }) => [port_id, channel_id])
          .join('/'),
        base_denom: baseDenom,
      }
    : undefined;
}
// get denom traces from default IBC network (one-hop)
export function useDefaultDenomTraceByDenom(): SWRResponse<DenomTraceByDenom> {
  const { data: client, ...swr } = useDefaultAssetsClient();

  // find the IBC trace information of each known IBC asset
  const defaultDenomTraceByDenom = useMemo<DenomTraceByDenom>(() => {
    // there may be IBC assets on the assetList of the native chain
    const assetLists = client && [
      client.getChainAssetList(REACT_APP__CHAIN_NAME),
      ...(client.getGeneratedAssetLists(REACT_APP__CHAIN_NAME) ?? []),
    ];
    const map = new Map<string, DenomTrace>();
    return client && assetLists
      ? assetLists.reduce((acc, assetList) => {
          for (const asset of assetList.assets) {
            const trace = getDenomTraceFromAsset(client, asset, assetLists);
            // if the denom has IBC trace information, then add it here
            if (trace) {
              // recreate IBC data into DenomTrace format
              acc.set(asset.base, trace);
            }
          }
          return acc;
        }, map)
      : map;
  }, [client]);

  return { ...swr, data: defaultDenomTraceByDenom } as SWRResponse;
}
