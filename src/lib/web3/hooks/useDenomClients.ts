import useSWRImmutable from 'swr/immutable';
import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useDeepCompareMemoize } from 'use-deep-compare-effect';
import {
  ChainRegistryClient,
  ChainRegistryChainUtil,
} from '@chain-registry/client';

import { AdditionalMintageTrace, Asset, Chain } from '@chain-registry/types';

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

// export hook for getting ChainRegistryClient instances for each denom
export function useAssetClientByDenom(
  denoms: string[] = []
): SWRCommon<AssetClientByDenom> {
  const uniqueDenoms = useDeepCompareMemoize(Array.from(new Set(denoms)));
  const swr1 = useDenomTraceByDenom(uniqueDenoms);
  const { data: denomTraceByDenom } = swr1;

  const { data: clientByDenom, ...swr2 } = useQueries({
    queries: uniqueDenoms.flatMap((denom) => {
      const trace = denomTraceByDenom?.get(denom);
      return {
        queryKey: ['useAssetClientByDenom', denom, trace],
        queryFn: async (): Promise<[string, ChainRegistryClient?]> => {
          return [denom, await getAssetClient(denom, trace)];
        },
        // never refetch these values, they will never change
        staleTime: Infinity,
        refetchInterval: Infinity,
        refetchOnMount: false,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
      };
    }),
    combine: (results) => {
      return {
        isLoading: results.every((result) => result.isPending),
        isValidating: results.some((result) => result.isFetching),
        data: results.reduce<AssetClientByDenom>(
          (map, { isPending, data: [denom, client] = [] }) => {
            // if resolved then add data
            if (!isPending && denom) {
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
        ),
        error: results.find((result) => result.error)?.error,
      };
    },
  });

  return {
    isValidating: swr1.isValidating || swr2.isValidating,
    isLoading: swr1.isLoading || swr2.isLoading,
    error: swr1.error || swr2.error,
    data: clientByDenom,
  };
}

export function useAssetChainUtilByDenom(
  denoms: string[] = []
): SWRCommon<AssetChainUtilByDenom> {
  const { data: clientByDenom, ...swr } = useAssetClientByDenom(denoms);

  // substitute chain utils for assets
  const data = useMemo(() => {
    const denoms = Array.from(clientByDenom?.keys() || []);
    return denoms.reduce<AssetChainUtilByDenom>((map, denom) => {
      const client = clientByDenom?.get(denom);
      const chainUtil = client?.getChainUtil(REACT_APP__CHAIN_NAME);
      if (denom && chainUtil) {
        return map.set(denom, chainUtil);
      }
      return map;
    }, new Map());
  }, [clientByDenom]);

  return { ...swr, data };
}

// export convenience hook for getting just Assets for each denom
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

// for possible types of assets in base denom
// see: https://github.com/cosmos/chain-registry/blob/3e16e0d/assetlist.schema.json#L56
const bridgedWasmAddressRegex = /^(\w+):([a-z]+)(\w{8,})$/;
const factoryAddressRegex = /^factory\/(\w+)\/(\w+)$/;

function shortenAddress(address: string) {
  return address.length >= 9
    ? `${address.slice(0, 3)}...${address.slice(-3)}`
    : address;
}

// create asset from available denom information
function createAssetFromDenom(denom: string): Asset {
  const [match, address, name = denom] = denom.match(factoryAddressRegex) || [];
  return {
    base: denom,
    display: denom,
    denom_units: [{ denom: denom, exponent: 0 }],
    name: denom,
    description: match ? `factory token on ${address} for ${name}` : undefined,
    symbol: match
      ? // use pretty factory address
        `${name} (factory) ${shortenAddress(address)}`
      : // default to what we know
        denom,
  };
}
// create asset from available IBC trace information
function createAssetFromIbcTrace(denom: string, trace: DenomTrace): Asset {
  const [match, type, chain, address] =
    trace.base_denom.match(bridgedWasmAddressRegex) || [];

  return {
    base: denom,
    display: denom,
    denom_units: [{ denom: denom, exponent: 0 }],
    name: trace.base_denom,
    description: match ? `factory token on ${address} for ${name}` : undefined,
    symbol: match
      ? // use pretty trace address
        `${chain}(${type.toUpperCase()}) ${shortenAddress(address)}`
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
  denoms: string[] = []
): SWRCommon<TokenByDenom> {
  const uniqueDenoms = useDeepCompareMemoize(Array.from(new Set(denoms)));
  const { data: traceByDenom, ...swr1 } = useDenomTraceByDenom(uniqueDenoms);
  const { data: clientByDenom, ...swr2 } = useAssetClientByDenom(denoms);

  // return found tokens and a generic Unknown tokens
  const data = useMemo(() => {
    const denoms = Array.from(clientByDenom?.keys() || []);
    return denoms.reduce<TokenByDenom>((map, denom) => {
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
              (asset?.traces?.at(0) as AdditionalMintageTrace)?.provider ||
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
  }, [clientByDenom, traceByDenom]);

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
export function useTokens(denoms: string[] = []): SWRCommon<Token[]> {
  const { data: tokenByDenom, ...swr } = useTokenByDenom(denoms);

  // list tokens
  const data = useMemo(
    () => Array.from((tokenByDenom || [])?.values()),
    [tokenByDenom]
  );

  return { ...swr, data };
}
