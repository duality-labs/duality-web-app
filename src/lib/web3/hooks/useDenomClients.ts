import useSWRImmutable, { immutable } from 'swr/immutable';
import useSWRInfinite, { SWRInfiniteKeyLoader } from 'swr/infinite';
import { useEffect, useMemo } from 'react';
import { useDeepCompareMemoize } from 'use-deep-compare-effect';
import {
  ChainRegistryClient,
  ChainRegistryChainUtil,
} from '@chain-registry/client';

import { AdditionalMintageTrace, Asset, Chain } from '@chain-registry/types';
import { DenomTrace } from '@duality-labs/neutronjs/types/codegen/ibc/applications/transfer/v1/transfer';

import { useDenomTrace, useDenomTraceByDenom } from './useDenomsFromChain';
import { Token } from '../utils/tokens';
import { getAssetClient } from './useDenomsFromRegistry';

const { REACT_APP__CHAIN_NAME = '' } = import.meta.env;

// export hook for getting a basic chain-registry client for a denom
// note: the client can do more than chainUtil which uses native chain context
export function useAssetClient(denom: string | undefined) {
  const { data: trace } = useDenomTrace(denom);

  return useSWRImmutable(
    ['asset-client', denom, trace],
    async (): Promise<ChainRegistryClient | null | undefined> => {
      // get asset client if available
      return (denom && getAssetClient(denom, trace)) || undefined;
    }
  );
}

export type SWRCommon<Data = unknown, Error = unknown> = {
  isValidating: boolean;
  isLoading: boolean;
  error: Error;
  data: Data | undefined;
};

type AssetByDenom = Map<string, Asset>;
type AssetClientByDenom = Map<string, ChainRegistryClient | null | undefined>;
type AssetChainUtilByDenom = Map<string, ChainRegistryChainUtil>;

function useUniqueDenoms(denoms: string[] = []): string[] {
  return useDeepCompareMemoize(Array.from(new Set(denoms)).sort());
}

// export hook for getting ChainRegistryClient instances for each denom
function useAssetClientByDenom(
  denoms: string[] | undefined
): SWRCommon<AssetClientByDenom> {
  const uniqueDenoms = useUniqueDenoms(denoms);
  const swr1 = useDenomTraceByDenom(uniqueDenoms);
  const { data: denomTraceByDenom } = swr1;

  // fetch a client for each denom and trace
  const { data: pages, ...swr2 } = useSWRInfinite<
    [denom: string, client?: ChainRegistryClient | null],
    Error,
    SWRInfiniteKeyLoader<
      [denom: string, client?: ChainRegistryClient],
      [denom: string, trace: DenomTrace | undefined, key: string] | null
    >
  >(
    // allow hash to be an empty string
    (index: number) => {
      const denom = uniqueDenoms.at(index);
      const trace = denom ? denomTraceByDenom?.get(denom) : undefined;
      return [denom || '', trace, 'asset-client'];
    },
    // handle cases of empty hash string
    async ([denom, trace]) => {
      return denom
        ? // return denom key with possible asset client (if found)
          [denom, await getAssetClient(denom, trace)]
        : // return "empty" result that won't be mapped
          [''];
    },
    {
      parallel: true,
      initialSize: 1,
      use: [immutable],
      revalidateFirstPage: false,
      revalidateAll: false,
    }
  );

  // get all pages, resolving one key at a time
  const { size, setSize } = swr2;
  useEffect(() => {
    if (size < uniqueDenoms.length) {
      setSize((size) => Math.min(uniqueDenoms.length, size + 1));
    }
  }, [size, setSize, uniqueDenoms]);

  // combine pages into one
  const clientByDenom = useMemo<AssetClientByDenom>(() => {
    return (pages || []).reduce<AssetClientByDenom>(
      (map, [denom, client] = ['']) => {
        if (denom) {
          const chainUtil = client?.getChainUtil(REACT_APP__CHAIN_NAME);
          const asset = chainUtil?.getAssetByDenom(denom);
          // if the client if found, return that
          if (client && asset) {
            return map.set(denom, client);
          }
          // if the client is undefined (pending) or null (not found/correct)
          else {
            return map.set(denom, client ? null : client);
          }
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
    data: clientByDenom,
  };
}

export function useAssetChainUtilByDenom(
  denoms: string[] | undefined
): SWRCommon<AssetChainUtilByDenom> {
  const uniqueDenoms = useUniqueDenoms(denoms);
  const { data: clientByDenom, ...swr } = useAssetClientByDenom(uniqueDenoms);

  // substitute chain utils for assets
  const data = useMemo(() => {
    return uniqueDenoms.reduce<AssetChainUtilByDenom>((map, denom) => {
      const client = clientByDenom?.get(denom);
      const chainUtil = client?.getChainUtil(REACT_APP__CHAIN_NAME);
      if (denom && chainUtil) {
        return map.set(denom, chainUtil);
      }
      return map;
    }, new Map());
  }, [uniqueDenoms, clientByDenom]);

  return { ...swr, data };
}

// export convenience hook for getting just Assets for each denom
export function useAssetByDenom(
  denoms: string[] | undefined
): SWRCommon<AssetByDenom> {
  const uniqueDenoms = useUniqueDenoms(denoms);
  const { data: chainUtilByDenom, ...swr } =
    useAssetChainUtilByDenom(uniqueDenoms);

  // substitute chain utils for assets
  const data = useMemo(() => {
    return uniqueDenoms.reduce<AssetByDenom>((map, denom) => {
      const chainUtil = chainUtilByDenom?.get(denom);
      const asset = chainUtil?.getAssetByDenom(denom);
      if (denom && chainUtil && asset) {
        return map.set(denom, asset);
      }
      return map;
    }, new Map());
  }, [uniqueDenoms, chainUtilByDenom]);

  return { ...swr, data };
}

// for possible types of assets in base denom
// see: https://github.com/cosmos/chain-registry/blob/3e16e0d/assetlist.schema.json#L56
const bridgedWasmAddressRegex = /^(\w+):(\w+)$/;
const factoryAddressRegex = /^factory\/(\w+)\/(.+)$/;
const addressRegex = /^([a-z]+)([a-z0-9]+)$/;

function shortenHash(address: string) {
  return address.length >= 9
    ? `${address.slice(0, 3)}...${address.slice(-3)}`
    : address;
}

// somtimes token addresses can have differing lengths
// - neutron1rylsg4js5nrm4acaqez5v95mv279lpfrstfupwqykkg6mcyt6lsqxafdcf
// - neutron1tdn2c8u9war2x0gmr504scqzq26mle7yfjn728
// split these to the prefix and hash
function splitAddress(address: string = ''): [string, string] {
  const [_, prefix, hash] = address.match(addressRegex) || [];
  return [prefix || '', hash || ''];
}

// create asset from available denom information
function createAssetFromDenom(denom: string): Asset {
  const [match, address, name = denom] = denom.match(factoryAddressRegex) || [];
  const [prefix, hash] = splitAddress(address);
  return {
    base: denom,
    display: denom,
    denom_units: [{ denom: denom, exponent: 0 }],
    name: denom,
    description: match && `factory token "${name}" on ${address}`,
    symbol: match
      ? // use pretty factory address
        `${name} on ${prefix}${shortenHash(hash)}`
      : // default to what we know
        denom,
  };
}
// create asset from available IBC trace information
function createAssetFromIbcTrace(denom: string, trace: DenomTrace): Asset {
  const [match, type, address] =
    trace.base_denom.match(bridgedWasmAddressRegex) || [];
  const [prefix, hash] = splitAddress(address);

  return {
    base: denom,
    display: denom,
    denom_units: [{ denom: denom, exponent: 0 }],
    name: trace.base_denom,
    description: match && `${type} token from ${prefix}: ${address}`,
    symbol: match
      ? // use pretty trace address
        `${prefix}(${type.toUpperCase()}) ${shortenHash(hash)}`
      : // default to what we know
        trace.base_denom,
  };
}

// defined a default "unknown" chain
const undefinedChain: Chain = {
  $schema: '../chain.schema.json',
  chain_id: '',
  chain_name: 'undefined',
  network_type: '',
  pretty_name: '[unknown chain]',
  slip44: 1,
  status: '',
  bech32_prefix: '',
};

// export convenience hook for getting just Token for each denom
export type TokenByDenom = Map<string, Asset & { chain: Chain }>;
export function useTokenByDenom(
  denoms: string[] | undefined
): SWRCommon<TokenByDenom> {
  const uniqueDenoms = useUniqueDenoms(denoms);
  const { data: traceByDenom, ...swr1 } = useDenomTraceByDenom(uniqueDenoms);
  const { data: clientByDenom, ...swr2 } = useAssetClientByDenom(uniqueDenoms);

  // return found tokens and a generic Unknown tokens
  const data = useMemo(() => {
    return uniqueDenoms.reduce<TokenByDenom>((map, denom) => {
      const client = clientByDenom?.get(denom);
      const chainUtil = client?.getChainUtil(REACT_APP__CHAIN_NAME);
      const asset = chainUtil?.getAssetByDenom(denom);
      const chainName: string | undefined = asset
        ? asset.traces?.at(0)?.counterparty.chain_name || REACT_APP__CHAIN_NAME
        : undefined;
      // get asset's chain data
      const chain: Chain | undefined =
        // create altered nativeChain data for nativeChain factory tokens
        (denom.startsWith('factory/') &&
          chainUtil && {
            ...chainUtil.chainInfo.chain,
            pretty_name:
              (asset?.traces?.at(0) as AdditionalMintageTrace).provider ||
              asset?.traces?.at(0)?.counterparty.chain_name ||
              chainUtil.chainInfo.chain.pretty_name,
          }) ||
        // by default: add a found chain through the chain-registry client data
        (chainName ? client?.getChain(chainName) : undefined);
      // add asset to map if it contains enough data
      if (denom && asset && chain) {
        // todo: find a better way to pass data to the token picker
        //       so we don't need Cosmos chain context passed through,
        //       because some assets don't have Cosmos chain data: like Ethereum
        return map.set(denom, { chain, ...asset });
      } else if (denom) {
        // create
        const denomTrace = traceByDenom?.get(denom);
        if (denomTrace) {
          const asset = createAssetFromIbcTrace(denom, denomTrace);
          return map.set(denom, { ...asset, chain: undefinedChain });
        } else {
          const asset = createAssetFromDenom(denom);
          return map.set(denom, { ...asset, chain: undefinedChain });
        }
      }
      return map;
    }, new Map());
  }, [uniqueDenoms, clientByDenom, traceByDenom]);

  return {
    isValidating: swr1.isValidating || swr2.isValidating,
    isLoading: swr1.isLoading || swr2.isLoading,
    error: swr1.error || swr2.error,
    data,
  };
}

// export convenience hook for getting just one Token for one denom
export function useToken(denom: string | undefined): SWRCommon<Token> {
  const { data: tokenByDenom, ...swr } = useTokenByDenom(denom ? [denom] : []);

  // find token
  const data = useMemo(() => {
    return denom ? tokenByDenom?.get(denom) : undefined;
  }, [tokenByDenom, denom]);

  return { ...swr, data };
}

// export convenience hook for getting list of multiple Tokens
export function useTokens(denoms: string[] | undefined): SWRCommon<Token[]> {
  const { data: tokenByDenom, ...swr } = useTokenByDenom(denoms);

  // list tokens
  const data = useMemo(
    () => Array.from((tokenByDenom || [])?.values()),
    [tokenByDenom]
  );

  return { ...swr, data };
}
