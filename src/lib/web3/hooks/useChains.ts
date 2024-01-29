import { Chain } from '@chain-registry/types';
import { useMemo } from 'react';
import { ibc } from '@duality-labs/neutronjs';
import { QueryBalanceResponse } from '@duality-labs/neutronjs/types/codegen/cosmos/bank/v1beta1/query';
import { useQuery } from '@tanstack/react-query';

import { getChainInfo } from '../wallets/keplr';
import { minutes } from '../../utils/time';
import { useNativeChainClient } from './useDenomsFromRegistry';
import { SWRResponse } from 'swr';

const {
  REACT_APP__CHAIN = '',
  REACT_APP__CHAIN_NAME = '[chain_name]',
  REACT_APP__CHAIN_PRETTY_NAME = REACT_APP__CHAIN_NAME || '[chain_pretty_name]',
  REACT_APP__CHAIN_ID = '[chain_id]',
  REACT_APP__CHAIN_FEE_TOKENS = '',
  REACT_APP__RPC_API = '',
  REACT_APP__REST_API = '',
} = import.meta.env;

type ChainFeeTokens = NonNullable<Chain['fees']>['fee_tokens'];
export function useNativeChain(): SWRResponse<Chain> {
  const { data: chainListClient, ...swr } = useNativeChainClient();
  const nativeChain = useMemo<Chain | undefined>(() => {
    const chainList = chainListClient?.chains;
    const baseChain = chainList?.find(
      (chain) => chain.chain_name === REACT_APP__CHAIN_NAME
    );
    const nativeChain: Chain | undefined = baseChain && {
      // add base chain-registry chain
      ...baseChain,
      // override with other provided env vars
      chain_id: REACT_APP__CHAIN_ID || baseChain?.chain_id,
      chain_name: REACT_APP__CHAIN_NAME || baseChain?.chain_name,
      pretty_name: REACT_APP__CHAIN_PRETTY_NAME || baseChain?.pretty_name,
      apis:
        REACT_APP__RPC_API && REACT_APP__REST_API
          ? {
              rpc: [{ address: REACT_APP__RPC_API }],
              rest: [{ address: REACT_APP__REST_API }],
            }
          : baseChain?.apis,
      fees: {
        ...baseChain?.fees,
        // if not specified the fee tokens will default to the stake token in Keplr
        // see: https://github.com/cosmology-tech/chain-registry/blob/%40chain-registry/keplr%401.22.1/packages/keplr/src/index.ts#L103-L131
        fee_tokens: REACT_APP__CHAIN_FEE_TOKENS
          ? (JSON.parse(REACT_APP__CHAIN_FEE_TOKENS) as ChainFeeTokens)
          : (baseChain?.fees?.fee_tokens as ChainFeeTokens),
      },
      // override default settings with an env variable for the whole chain config
      ...(REACT_APP__CHAIN ? (JSON.parse(REACT_APP__CHAIN) as Chain) : {}),
    };

    return nativeChain;
  }, [chainListClient]);

  return { ...swr, data: nativeChain } as SWRResponse;
}

export function useChainAddress(chain?: Chain): {
  data?: string;
  isValidating: boolean;
  error?: Error;
} {
  const chainId = chain?.chain_id ?? '';
  const { data, isFetching, error } = useQuery({
    enabled: !!chain,
    queryKey: ['useChainAddress', chainId],
    queryFn: chain
      ? async (): Promise<string> => {
          return getChainInfo(chain).then(
            (chainInfo) => chainInfo.bech32Address
          );
        }
      : undefined,
    // if the request was declined, don't keep re-requesting it
    retry: false,
  });
  return { data, isValidating: isFetching, error: error || undefined };
}

export function useRemoteChainRpcEndpoint(chain?: Chain) {
  return useQuery({
    queryKey: ['cosmos-chain-rpc-endpoints', chain?.chain_id],
    queryFn: async (): Promise<string | null> => {
      const rpcEndpoints = (chain?.apis?.rpc ?? []).map((rest) => rest.address);
      if (rpcEndpoints.length > 0) {
        try {
          const rpcEndpoint = await Promise.race([
            Promise.any(
              rpcEndpoints.map(async (rpcEndpoint) => {
                const client = await ibc.ClientFactory.createRPCQueryClient({
                  rpcEndpoint,
                });
                await client.cosmos.base.tendermint.v1beta1.getNodeInfo();
                return rpcEndpoint;
              })
            ),
            new Promise<string>((_resolve, reject) =>
              setTimeout(reject, 10000)
            ),
          ]);
          return rpcEndpoint ?? null;
        } catch (e) {
          // all requests failed or the requests timed out
          return null;
        }
      }
      // return the native chain REST API if this is the native chain
      else if (chain?.chain_id === REACT_APP__CHAIN_ID) {
        return REACT_APP__RPC_API;
      }
      // return nothing if the request is invalid
      else {
        return null;
      }
    },
    refetchInterval: false,
    refetchOnMount: false,
  });
}

export function useRemoteChainRestEndpoint(chain?: Chain) {
  return useQuery({
    queryKey: ['cosmos-chain-rest-endpoints', chain?.chain_id],
    queryFn: async (): Promise<string | null> => {
      const restEndpoints = (chain?.apis?.rest ?? []).map(
        (rest) => rest.address
      );
      if (restEndpoints.length > 0) {
        try {
          const restEndpoint = await Promise.race([
            Promise.any(
              restEndpoints.map(async (restEndpoint) => {
                const client = await ibc.ClientFactory.createLCDClient({
                  restEndpoint,
                });
                await client.cosmos.base.tendermint.v1beta1.getNodeInfo();
                return restEndpoint;
              })
            ),
            new Promise<string>((_resolve, reject) =>
              setTimeout(reject, 10000)
            ),
          ]);
          return restEndpoint ?? null;
        } catch (e) {
          // all requests failed or the requests timed out
          return null;
        }
      }
      // return the native chain REST API if this is the native chain
      else if (chain?.chain_id === REACT_APP__CHAIN_ID) {
        return REACT_APP__REST_API;
      }
      // return nothing if the request is invalid
      else {
        return null;
      }
    },
    refetchInterval: false,
    refetchOnMount: false,
  });
}

export function useRemoteChainBankBalance(
  chain: Chain | undefined,
  denom?: string, // the denom on the queried chain
  address?: string // the address on the queried chain
) {
  const { data: restEndpoint } = useRemoteChainRestEndpoint(chain);
  return useQuery({
    enabled: !!denom,
    queryKey: ['cosmos-chain-endpoints', restEndpoint, address],
    queryFn: async (): Promise<QueryBalanceResponse | null> => {
      if (restEndpoint && address && denom) {
        const client = await ibc.ClientFactory.createLCDClient({
          restEndpoint,
        });
        return client.cosmos.bank.v1beta1.balance({ address, denom });
      } else {
        return null;
      }
    },
    refetchInterval: 5 * minutes,
  });
}
