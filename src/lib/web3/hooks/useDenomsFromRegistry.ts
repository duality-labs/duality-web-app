import useSWRImmutable from 'swr/immutable';
import { useMemo } from 'react';
import {
  ChainRegistryClient,
  ChainRegistryChainUtil,
} from '@chain-registry/client';
import { IBCInfo } from '@chain-registry/types';

const {
  // REACT_APP__CHAIN_NAME = '',
  REACT_APP__CHAIN_IS_TESTNET = '',
  REACT_APP__CHAIN_REGISTRY_CHAIN_NAMES = '',
  REACT_APP__CHAIN_REGISTRY_ENDPOINTS = '["https://registry.ping.pub"]',
} = process.env;

const REACT_APP__CHAIN_NAME = 'neutron';

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
      chainNames,
      ibcNamePairs,
    });

    // // remove irrelevant IBC data from initial fetch
    // chainRegistryClient.urls = chainRegistryClient.urls.filter((url) => {
    //   const ibcPair = url.split('/_IBC/').at(1)?.split('.').at(0)?.split('-');
    //   // filter to non-IBC URLs and IBC URLs related to the current chain
    //   return !ibcPair || ibcPair.includes(chainName);
    // });

    // fetch all the URLs
    try {
      await chainRegistryClient.fetchUrls();
    } catch {
      // ignore if some resources throw errors
    }

    // return just the chain utility instance
    // it is possible to get the original fetcher at chainUtil.chainInfo.fetcher
    return chainRegistryClient.getChainUtil(chainName);
  }

  return useSWRImmutable(
    ['chain-registry-client', chainName],
    async (): Promise<ChainRegistryChainUtil> => {
      for (const chainRegistryEndpoint of chainRegistryEndpoints) {
        try {
          console.log('for test');
          return await createChainRegistryClient(chainRegistryEndpoint);
        } catch (e) {
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

interface ChainRegistryIBCPath {
  port_id: string;
  channel_id: string;
}

function createChainRegistryPath(ibcPath: string): Array<ChainRegistryIBCPath> {
  return ibcPath.split('/').reduce<ChainRegistryIBCPath[]>((path, pathPart, index) => {
    // for even indexes take the port ID
    if ( index % 2 === 0) {
      path.push({ port_id: pathPart, channel_id: '' })
    }
    // for odd indexes edit the channel ID
    else {
      const lastPath = path.at(-1);
      if (lastPath) {
        lastPath.channel_id = pathPart;
      }
    }
    return path;
  }, []);
}


interface ChainTrace {
  path: string;
  base_denom: string;
}

interface IBCTrace {
  paths: ChainRegistryIBCPath[],
  coinMinimalDenom: string
}

function createChainRegistryTrace({ path, base_denom }: ChainTrace): IBCTrace {
  return {
    'paths': createChainRegistryPath(path),
    'coinMinimalDenom': base_denom,
  }
}

interface TraceDetail {
  chain_id: string;
  chain_name: string;
  port: string;
  channel: string;
}

export function useChainDenomTraceDetail(chainTrace: {
  path: string;
  base_denom: string;
}): Array<{
  from: TraceDetail;
  to: TraceDetail;
}> {
  return [];
}

const chainNames = [
  '8ball',
  'osmosis',
  'acrechain',
  'axelar',
  'cosmoshub',
  'evmos',
  'gravitybridge',
  'kujira',
  'oraichain',
  'stargaze',
  'stride',
  'terra',
  'terra2',
  'agoric',
  'archway',
  'composable',
  'crescent',
  'noble',
  'secretnetwork',
  'aioz',
  'akash',
  'cryptoorgchain',
  'irisnet',
  'juno',
  'persistence',
  'regen',
  'sentinel',
  'sifchain',
  'starname',
  'andromeda',
  'bitcanna',
  'decentr',
  'jackal',
  'neutron',
  'nois',
  'omniflixhub',
  'quicksilver',
  'qwoyn',
  'umee',
  'arkh',
  'assetmantle',
  'okexchain',
  'aura',
  'kava',
  'celestia',
  'coreum',
  'empowerchain',
  'fxcore',
  'haqq',
  'impacthub',
  'injective',
  'kyve',
  'migaloo',
  'odin',
  'sommelier',
  'bandchain',
  'comdex',
  'beezee',
  'bitsong',
  'bluzelle',
  'bostrom',
  'canto',
  'carbon',
  'cerberus',
  'cheqd',
  'chihuahua',
  'stafihub',
  'doravota',
  'dydx',
  'sei',
  'emoney',
  'kichain',
  'likecoin',
  'lumnetwork',
  'planq',
  'point',
  'realio',
  'teritori',
  'uptick',
  'mars',
  'cronos',
  'cudos',
  'desmos',
  'dig',
  'nolus',
  'dyson',
  'echelon',
  'tgrade',
  'fetchhub',
  'furya',
  'pundix',
  'galaxy',
  'gateway',
  'genesisl1',
  'gitopia',
  'unification',
  'imversed',
  'xpla',
  'konstellation',
  'nomic',
  'lambda',
  'lumenx',
  'medasdigital',
  'meme',
  'microtick',
  'vidulum',
  'onomy',
  'panacea',
  'passage',
  'provenance',
  'quasar',
  'rebus',
  'rizon',
  'sge',
  'shareledger',
  'shentu',
  'source',
];

const ibcNamePairs = [
  ['8ball', 'osmosis'],
  ['acrechain', 'axelar'],
  ['acrechain', 'cosmoshub'],
  ['acrechain', 'evmos'],
  ['acrechain', 'gravitybridge'],
  ['acrechain', 'kujira'],
  ['acrechain', 'oraichain'],
  ['acrechain', 'osmosis'],
  ['acrechain', 'stargaze'],
  ['acrechain', 'stride'],
  ['acrechain', 'terra'],
  ['acrechain', 'terra2'],
  ['agoric', 'archway'],
  ['agoric', 'axelar'],
  ['agoric', 'composable'],
  ['agoric', 'cosmoshub'],
  ['agoric', 'crescent'],
  ['agoric', 'evmos'],
  ['agoric', 'gravitybridge'],
  ['agoric', 'kujira'],
  ['agoric', 'noble'],
  ['agoric', 'osmosis'],
  ['agoric', 'secretnetwork'],
  ['agoric', 'stride'],
  ['aioz', 'cosmoshub'],
  ['aioz', 'osmosis'],
  ['akash', 'archway'],
  ['akash', 'cosmoshub'],
  ['akash', 'crescent'],
  ['akash', 'cryptoorgchain'],
  ['akash', 'irisnet'],
  ['akash', 'juno'],
  ['akash', 'kujira'],
  ['akash', 'osmosis'],
  ['akash', 'persistence'],
  ['akash', 'regen'],
  ['akash', 'secretnetwork'],
  ['akash', 'sentinel'],
  ['akash', 'sifchain'],
  ['akash', 'starname'],
  ['akash', 'terra2'],
  ['andromeda', 'kujira'],
  ['andromeda', 'secretnetwork'],
  ['andromeda', 'terra2'],
  ['archway', 'axelar'],
  ['archway', 'bitcanna'],
  ['archway', 'cosmoshub'],
  ['archway', 'decentr'],
  ['archway', 'gravitybridge'],
  ['archway', 'jackal'],
  ['archway', 'juno'],
  ['archway', 'kujira'],
  ['archway', 'neutron'],
  ['archway', 'noble'],
  ['archway', 'nois'],
  ['archway', 'omniflixhub'],
  ['archway', 'osmosis'],
  ['archway', 'quicksilver'],
  ['archway', 'qwoyn'],
  ['archway', 'secretnetwork'],
  ['archway', 'terra2'],
  ['archway', 'umee'],
  ['arkh', 'osmosis'],
  ['assetmantle', 'juno'],
  ['assetmantle', 'kujira'],
  ['assetmantle', 'okexchain'],
  ['assetmantle', 'osmosis'],
  ['aura', 'axelar'],
  ['aura', 'cosmoshub'],
  ['aura', 'kava'],
  ['aura', 'noble'],
  ['aura', 'nois'],
  ['aura', 'osmosis'],
  ['axelar', 'celestia'],
  ['axelar', 'composable'],
  ['axelar', 'coreum'],
  ['axelar', 'cosmoshub'],
  ['axelar', 'crescent'],
  ['axelar', 'empowerchain'],
  ['axelar', 'evmos'],
  ['axelar', 'fxcore'],
  ['axelar', 'haqq'],
  ['axelar', 'impacthub'],
  ['axelar', 'injective'],
  ['axelar', 'jackal'],
  ['axelar', 'juno'],
  ['axelar', 'kujira'],
  ['axelar', 'kyve'],
  ['axelar', 'migaloo'],
  ['axelar', 'neutron'],
  ['axelar', 'odin'],
  ['axelar', 'osmosis'],
  ['axelar', 'secretnetwork'],
  ['axelar', 'sommelier'],
  ['axelar', 'stride'],
  ['axelar', 'terra2'],
  ['axelar', 'umee'],
  ['bandchain', 'comdex'],
  ['bandchain', 'coreum'],
  ['bandchain', 'osmosis'],
  ['beezee', 'osmosis'],
  ['bitcanna', 'bitsong'],
  ['bitcanna', 'cosmoshub'],
  ['bitcanna', 'juno'],
  ['bitcanna', 'osmosis'],
  ['bitsong', 'cosmoshub'],
  ['bitsong', 'juno'],
  ['bitsong', 'osmosis'],
  ['bluzelle', 'osmosis'],
  ['bostrom', 'osmosis'],
  ['canto', 'carbon'],
  ['canto', 'composable'],
  ['canto', 'osmosis'],
  ['carbon', 'cosmoshub'],
  ['carbon', 'evmos'],
  ['carbon', 'irisnet'],
  ['carbon', 'kujira'],
  ['carbon', 'osmosis'],
  ['carbon', 'stargaze'],
  ['carbon', 'stride'],
  ['carbon', 'terra2'],
  ['celestia', 'composable'],
  ['celestia', 'injective'],
  ['celestia', 'neutron'],
  ['celestia', 'osmosis'],
  ['celestia', 'secretnetwork'],
  ['celestia', 'stride'],
  ['celestia', 'terra2'],
  ['cerberus', 'osmosis'],
  ['cheqd', 'gravitybridge'],
  ['cheqd', 'osmosis'],
  ['cheqd', 'terra2'],
  ['chihuahua', 'juno'],
  ['chihuahua', 'migaloo'],
  ['chihuahua', 'neutron'],
  ['chihuahua', 'okexchain'],
  ['chihuahua', 'osmosis'],
  ['chihuahua', 'secretnetwork'],
  ['chihuahua', 'stafihub'],
  ['comdex', 'crescent'],
  ['comdex', 'juno'],
  ['comdex', 'kujira'],
  ['comdex', 'migaloo'],
  ['comdex', 'osmosis'],
  ['comdex', 'persistence'],
  ['comdex', 'secretnetwork'],
  ['comdex', 'stride'],
  ['comdex', 'terra2'],
  ['composable', 'cosmoshub'],
  ['composable', 'crescent'],
  ['composable', 'evmos'],
  ['composable', 'injective'],
  ['composable', 'juno'],
  ['composable', 'kujira'],
  ['composable', 'neutron'],
  ['composable', 'osmosis'],
  // ['composable', 'picasso'],
  ['composable', 'quicksilver'],
  ['composable', 'secretnetwork'],
  ['composable', 'stargaze'],
  ['composable', 'stride'],
  // ['composablepolkadot', 'picasso'],
  ['coreum', 'cosmoshub'],
  ['coreum', 'doravota'],
  ['coreum', 'dydx'],
  ['coreum', 'evmos'],
  ['coreum', 'gravitybridge'],
  ['coreum', 'kava'],
  ['coreum', 'kujira'],
  ['coreum', 'noble'],
  ['coreum', 'osmosis'],
  ['coreum', 'secretnetwork'],
  ['coreum', 'sei'],
  ['cosmoshub', 'crescent'],
  ['cosmoshub', 'cryptoorgchain'],
  ['cosmoshub', 'doravota'],
  ['cosmoshub', 'emoney'],
  ['cosmoshub', 'empowerchain'],
  ['cosmoshub', 'evmos'],
  ['cosmoshub', 'fxcore'],
  ['cosmoshub', 'haqq'],
  ['cosmoshub', 'impacthub'],
  ['cosmoshub', 'injective'],
  ['cosmoshub', 'irisnet'],
  ['cosmoshub', 'juno'],
  ['cosmoshub', 'kava'],
  ['cosmoshub', 'kichain'],
  ['cosmoshub', 'kujira'],
  ['cosmoshub', 'likecoin'],
  ['cosmoshub', 'lumnetwork'],
  ['cosmoshub', 'neutron'],
  ['cosmoshub', 'noble'],
  ['cosmoshub', 'omniflixhub'],
  ['cosmoshub', 'osmosis'],
  ['cosmoshub', 'persistence'],
  ['cosmoshub', 'planq'],
  ['cosmoshub', 'point'],
  ['cosmoshub', 'quicksilver'],
  ['cosmoshub', 'realio'],
  ['cosmoshub', 'regen'],
  ['cosmoshub', 'secretnetwork'],
  ['cosmoshub', 'sei'],
  ['cosmoshub', 'sentinel'],
  ['cosmoshub', 'sifchain'],
  ['cosmoshub', 'stafihub'],
  ['cosmoshub', 'starname'],
  ['cosmoshub', 'stride'],
  ['cosmoshub', 'teritori'],
  ['cosmoshub', 'terra2'],
  ['cosmoshub', 'umee'],
  ['cosmoshub', 'uptick'],
  ['crescent', 'cryptoorgchain'],
  ['crescent', 'evmos'],
  ['crescent', 'gravitybridge'],
  ['crescent', 'injective'],
  ['crescent', 'irisnet'],
  ['crescent', 'jackal'],
  ['crescent', 'juno'],
  ['crescent', 'kujira'],
  // ['crescent', 'mars'],
  ['crescent', 'noble'],
  // ['crescent', 'okexchain'],
  ['crescent', 'osmosis'],
  ['crescent', 'persistence'],
  ['crescent', 'secretnetwork'],
  ['crescent', 'stargaze'],
  ['crescent', 'stride'],
  ['crescent', 'terra'],
  ['crescent', 'terra2'],
  ['crescent', 'umee'],
  ['cronos', 'kava'],
  ['cryptoorgchain', 'evmos'],
  ['cryptoorgchain', 'irisnet'],
  ['cryptoorgchain', 'osmosis'],
  ['cryptoorgchain', 'persistence'],
  ['cryptoorgchain', 'regen'],
  ['cryptoorgchain', 'sentinel'],
  ['cryptoorgchain', 'sifchain'],
  ['cryptoorgchain', 'starname'],
  ['cudos', 'osmosis'],
  ['decentr', 'osmosis'],
  ['decentr', 'terra2'],
  ['desmos', 'osmosis'],
  ['dig', 'juno'],
  ['dig', 'osmosis'],
  ['doravota', 'nolus'],
  ['doravota', 'osmosis'],
  ['dydx', 'kujira'],
  ['dydx', 'neutron'],
  ['dydx', 'noble'],
  ['dydx', 'osmosis'],
  ['dydx', 'persistence'],
  ['dydx', 'stride'],
  ['dydx', 'terra2'],
  ['dyson', 'osmosis'],
  ['echelon', 'osmosis'],
  ['emoney', 'irisnet'],
  ['emoney', 'juno'],
  ['emoney', 'osmosis'],
  ['empowerchain', 'osmosis'],
  ['evmos', 'gravitybridge'],
  ['evmos', 'injective'],
  ['evmos', 'kava'],
  ['evmos', 'kujira'],
  ['evmos', 'noble'],
  ['evmos', 'osmosis'],
  ['evmos', 'secretnetwork'],
  ['evmos', 'stargaze'],
  ['evmos', 'stride'],
  ['evmos', 'tgrade'],
  ['fetchhub', 'osmosis'],
  ['furya', 'juno'],
  ['furya', 'kujira'],
  ['furya', 'osmosis'],
  ['furya', 'terra2'],
  ['fxcore', 'osmosis'],
  ['fxcore', 'pundix'],
  ['galaxy', 'osmosis'],
  ['gateway', 'kujira'],
  ['gateway', 'osmosis'],
  ['genesisl1', 'osmosis'],
  ['gitopia', 'osmosis'],
  ['gravitybridge', 'haqq'],
  ['gravitybridge', 'kujira'],
  ['gravitybridge', 'osmosis'],
  ['gravitybridge', 'persistence'],
  ['gravitybridge', 'planq'],
  ['gravitybridge', 'secretnetwork'],
  ['gravitybridge', 'unification'],
  ['haqq', 'kava'],
  ['haqq', 'noble'],
  ['haqq', 'osmosis'],
  ['impacthub', 'noble'],
  ['impacthub', 'osmosis'],
  ['impacthub', 'sifchain'],
  ['imversed', 'osmosis'],
  ['injective', 'kava'],
  ['injective', 'kujira'],
  ['injective', 'migaloo'],
  ['injective', 'neutron'],
  ['injective', 'noble'],
  ['injective', 'nois'],
  ['injective', 'osmosis'],
  ['injective', 'persistence'],
  ['injective', 'secretnetwork'],
  ['injective', 'sommelier'],
  ['injective', 'stride'],
  ['injective', 'terra2'],
  ['injective', 'xpla'],
  ['irisnet', 'osmosis'],
  ['irisnet', 'persistence'],
  ['irisnet', 'regen'],
  ['irisnet', 'sentinel'],
  ['irisnet', 'sifchain'],
  ['irisnet', 'stafihub'],
  ['irisnet', 'starname'],
  ['irisnet', 'uptick'],
  ['jackal', 'kujira'],
  ['jackal', 'osmosis'],
  ['jackal', 'secretnetwork'],
  ['juno', 'kujira'],
  ['juno', 'mars'],
  ['juno', 'migaloo'],
  ['juno', 'noble'],
  ['juno', 'nois'],
  ['juno', 'okexchain'],
  ['juno', 'osmosis'],
  ['juno', 'persistence'],
  ['juno', 'quicksilver'],
  ['juno', 'secretnetwork'],
  ['juno', 'sifchain'],
  ['juno', 'stargaze'],
  ['juno', 'stride'],
  ['juno', 'terra'],
  ['juno', 'terra2'],
  ['kava', 'kujira'],
  ['kava', 'neutron'],
  ['kava', 'osmosis'],
  ['kava', 'persistence'],
  ['kava', 'sei'],
  ['kava', 'terra2'],
  ['kava', 'umee'],
  ['kichain', 'osmosis'],
  ['konstellation', 'osmosis'],
  ['kujira', 'mars'],
  ['kujira', 'migaloo'],
  ['kujira', 'neutron'],
  ['kujira', 'noble'],
  ['kujira', 'nomic'],
  ['kujira', 'omniflixhub'],
  ['kujira', 'osmosis'],
  ['kujira', 'realio'],
  ['kujira', 'regen'],
  ['kujira', 'secretnetwork'],
  ['kujira', 'sommelier'],
  ['kujira', 'stafihub'],
  ['kujira', 'stargaze'],
  ['kujira', 'stride'],
  ['kujira', 'teritori'],
  ['kujira', 'terra2'],
  ['kyve', 'osmosis'],
  ['lambda', 'osmosis'],
  ['likecoin', 'osmosis'],
  ['lumenx', 'osmosis'],
  ['lumnetwork', 'osmosis'],
  ['mars', 'neutron'],
  ['mars', 'osmosis'],
  ['mars', 'terra2'],
  ['medasdigital', 'osmosis'],
  ['medasdigital', 'sentinel'],
  ['meme', 'osmosis'],
  ['microtick', 'osmosis'],
  ['migaloo', 'noble'],
  ['migaloo', 'osmosis'],
  ['migaloo', 'secretnetwork'],
  ['migaloo', 'stargaze'],
  ['migaloo', 'terra2'],
  ['neutron', 'noble'],
  ['neutron', 'nolus'],
  ['neutron', 'nomic'],
  ['neutron', 'osmosis'],
  ['neutron', 'persistence'],
  ['neutron', 'secretnetwork'],
  ['neutron', 'sei'],
  ['neutron', 'stargaze'],
  ['neutron', 'stride'],
  ['neutron', 'terra2'],
  ['noble', 'omniflixhub'],
  ['noble', 'osmosis'],
  ['noble', 'persistence'],
  ['noble', 'secretnetwork'],
  ['noble', 'sei'],
  ['noble', 'stargaze'],
  ['noble', 'terra2'],
  ['nois', 'osmosis'],
  ['nois', 'stargaze'],
  ['nolus', 'osmosis'],
  ['nomic', 'osmosis'],
  ['odin', 'osmosis'],
  ['okexchain', 'vidulum'],
  ['omniflixhub', 'osmosis'],
  ['onomy', 'osmosis'],
  ['oraichain', 'osmosis'],
  ['osmosis', 'panacea'],
  ['osmosis', 'passage'],
  ['osmosis', 'persistence'],
  ['osmosis', 'planq'],
  ['osmosis', 'provenance'],
  ['osmosis', 'pundix'],
  ['osmosis', 'quasar'],
  ['osmosis', 'quicksilver'],
  ['osmosis', 'qwoyn'],
  ['osmosis', 'realio'],
  ['osmosis', 'rebus'],
  ['osmosis', 'regen'],
  ['osmosis', 'rizon'],
  ['osmosis', 'secretnetwork'],
  ['osmosis', 'sei'],
  ['osmosis', 'sentinel'],
  ['osmosis', 'sge'],
  ['osmosis', 'shareledger'],
  ['osmosis', 'shentu'],
  ['osmosis', 'sifchain'],
  ['osmosis', 'sommelier'],
  ['osmosis', 'source'],
  ['osmosis', 'stafihub'],
  ['osmosis', 'stargaze'],
  ['osmosis', 'starname'],
  ['osmosis', 'stride'],
  ['osmosis', 'teritori'],
  ['osmosis', 'terra'],
  ['osmosis', 'terra2'],
  ['osmosis', 'tgrade'],
  ['osmosis', 'umee'],
  ['osmosis', 'unification'],
  ['osmosis', 'vidulum'],
  ['osmosis', 'xpla'],
  ['persistence', 'quicksilver'],
  ['persistence', 'regen'],
  ['persistence', 'secretnetwork'],
  ['persistence', 'sentinel'],
  ['persistence', 'sifchain'],
  ['persistence', 'starname'],
  ['persistence', 'stride'],
  ['persistence', 'umee'],
  ['planq', 'sei'],
  ['quicksilver', 'regen'],
  ['quicksilver', 'secretnetwork'],
  ['quicksilver', 'stargaze'],
  ['quicksilver', 'umee'],
  ['regen', 'sentinel'],
  ['regen', 'sifchain'],
  ['regen', 'starname'],
  ['secretnetwork', 'sentinel'],
  ['secretnetwork', 'sifchain'],
  ['secretnetwork', 'stargaze'],
  ['secretnetwork', 'stride'],
  ['secretnetwork', 'terra'],
  ['secretnetwork', 'terra2'],
  ['sei', 'stride'],
  ['sentinel', 'sifchain'],
  ['sentinel', 'starname'],
  ['sommelier', 'stride'],
  ['stafihub', 'terra2'],
  ['stargaze', 'stride'],
  ['stargaze', 'terra2'],
  ['stride', 'terra2'],
  ['stride', 'umee'],
  ['terra', 'terra2'],
];
