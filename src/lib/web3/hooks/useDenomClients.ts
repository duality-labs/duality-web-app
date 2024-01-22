import useSWRImmutable, { immutable } from 'swr/immutable';
import useSWRInfinite, { SWRInfiniteKeyLoader } from 'swr/infinite';
import { useEffect, useMemo } from 'react';
import { useDeepCompareMemoize } from 'use-deep-compare-effect';
import {
  ChainRegistryClient,
  ChainRegistryChainUtil,
} from '@chain-registry/client';

import { Asset, Chain } from '@chain-registry/types';
import { DenomTrace } from '@duality-labs/dualityjs/types/codegen/ibc/applications/transfer/v1/transfer';

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
    async (): Promise<ChainRegistryClient | undefined> => {
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
type AssetClientByDenom = Map<string, ChainRegistryClient>;
type AssetChainUtilByDenom = Map<string, ChainRegistryChainUtil>;

const concurrentItemCount = 3;

// export hook for getting ChainRegistryClient instances for each denom
export function useAssetClientByDenom(
  denoms: string[] = []
): SWRCommon<AssetClientByDenom> {
  const uniqueDenoms = useDeepCompareMemoize(Array.from(new Set(denoms)));
  const swr1 = useDenomTraceByDenom(uniqueDenoms);
  const { data: denomTraceByDenom } = swr1;

  useEffect(
    () =>
      console.log('useAssetClientByDenom: uniqueDenoms', denoms, uniqueDenoms),
    [uniqueDenoms]
  );
  useEffect(
    () =>
      console.log(
        'useAssetClientByDenom: denomTraceByDenom',
        denoms,
        denomTraceByDenom
      ),
    [denomTraceByDenom]
  );

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
      return [denom, await getAssetClient(denom, trace)];
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
  const chainUtilByDenom = useMemo<AssetClientByDenom>(() => {
    return (pages || []).reduce<AssetClientByDenom>(
      (map, [denom, client] = ['']) => {
        const chainUtil = client?.getChainUtil(REACT_APP__CHAIN_NAME);
        const asset = chainUtil?.getAssetByDenom(denom);
        if (denom && client && asset) {
          return map.set(denom, client);
        }
        console.log('useAssetClientByDenom denom', denom, { asset, client });
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

// export convenience hook for getting just Token for each denom
export type TokenByDenom = Map<string, Asset & { chain: Chain }>;
export function useTokenByDenom(
  denoms: string[] = []
): SWRCommon<TokenByDenom> {
  const { data: clientByDenom, ...swr } = useAssetClientByDenom(denoms);

  // return only found tokens
  const data = useMemo(() => {
    const denoms = Array.from(clientByDenom?.keys() || []);
    return denoms.reduce<TokenByDenom>((map, denom) => {
      const client = clientByDenom?.get(denom);
      const chainUtil = client?.getChainUtil(REACT_APP__CHAIN_NAME);
      const asset = chainUtil?.getAssetByDenom(denom);
      const chainName = asset
        ? asset.traces?.at(0)?.counterparty.chain_name || REACT_APP__CHAIN_NAME
        : undefined;
      const chain = chainName && client?.getChain(chainName);
      if (denom && asset && chain) {
        return map.set(denom, { chain, ...asset });
      }
      return map;
    }, new Map());
  }, [clientByDenom]);

  return { ...swr, data };
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
