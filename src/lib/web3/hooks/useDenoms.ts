import { AssetList, IBCInfo } from '@chain-registry/types';
import { useCallback, useMemo } from 'react';
import useSWRImmutable, { immutable } from 'swr/immutable';
import useSWRInfinite, { SWRInfiniteKeyLoader } from 'swr/infinite';
import { ibcDenom } from '@chain-registry/utils';
import ms from 'ms';

import { ibc } from '@duality-labs/dualityjs';
import { DenomTrace } from '@duality-labs/dualityjs/types/codegen/ibc/applications/transfer/v1/transfer';
import { QueryDenomTracesResponse } from '@duality-labs/dualityjs/types/codegen/ibc/applications/transfer/v1/query';

import { IbcRestClient, useIbcRestClient } from '../clients/lcdClients';
import { SWRConfiguration } from 'swr';

const {
  REACT_APP__REST_API = '',
  REACT_APP__CHAIN_NAME = '',
  REACT_APP__CHAIN_IS_TESTNET = '',
  REACT_APP__CHAIN_REGISTRY_ENDPOINTS = '["https://registry.ping.pub"]',
} = process.env;

//   https://github.com/cosmos/chain-registry/tree/master/testnets?noancestors=1
// https://raw.githubusercontent.com/cosmos/chain-registry/master/testnets/neutrontestnet/chain.json
// https://proxy.atomscan.com/directory/testnets/_IBC/neutrontestnet-osmosistestnet.json

const isTestnet = REACT_APP__CHAIN_IS_TESTNET
  ? REACT_APP__CHAIN_IS_TESTNET === 'true'
  : REACT_APP__CHAIN_NAME.endsWith('testnet');

const chainRegistryEndpoints: string[] = JSON.parse(
  REACT_APP__CHAIN_REGISTRY_ENDPOINTS
).map((endpoint: string) => (isTestnet ? `${endpoint}/testnets` : endpoint));

const fetchAtMostOncePerHour: SWRConfiguration = {
  dedupingInterval: ms('1 hour'),
};

function useRegisteredNativeDenoms(): AssetList | undefined {
  return useSWRImmutable('registry-native-denoms', async () => {
    for (const api of chainRegistryEndpoints) {
      const res = await fetch(`${api}/${REACT_APP__CHAIN_NAME}/assetlist.json`);
      if (res.ok) {
        return await res.json();
      }
    }
    return;
  }).data;
}

const jsonHeaders = new Headers({
  Accept: 'application/json',
});
interface IBCFileInfo {
  name: string;
  mtime: string;
}
type IBCFileList = Array<IBCFileInfo>;
function useRegisteredIBCList(): IBCFileList | undefined {
  return useSWRImmutable('registry-ibc-files', async () => {
    for (const api of chainRegistryEndpoints) {
      const res = await fetch(`${api}/_IBC`, { headers: jsonHeaders });
      if (res.ok) {
        return await res.json();
      }
    }
  }).data;
}

function useRegisteredIBCChannels(
  chainName = REACT_APP__CHAIN_NAME
): Array<IBCInfo> | undefined {
  const allIBCFileList = useRegisteredIBCList();
  const relevantIBCFileList = useMemo(() => {
    return allIBCFileList?.filter(({ name }) =>
      name.split('.').at(0)?.split('-').includes(chainName)
    );
  }, [allIBCFileList, chainName]);
  const getKey = useCallback(
    (index: number): [string, IBCFileInfo?] => {
      return ['ibc-channel-file', relevantIBCFileList?.at(index)];
    },
    [relevantIBCFileList]
  );
  return useSWRInfinite(
    getKey,
    async ([, file]) => {
      if (file) {
        for (const api of chainRegistryEndpoints) {
          const res = await fetch(`${api}/_IBC/${file.name}`, {
            headers: jsonHeaders,
          });
          if (res.ok) {
            return await res.json();
          }
        }
      }
    },
    { ...fetchAtMostOncePerHour, parallel: true }
  ).data;
}

function useRegisteredIbcDenoms(chainName?: string) {
  const ibcChannels = useRegisteredIBCChannels(chainName);
}

function useChainIbcDenoms(
  endpoint = REACT_APP__REST_API
): Array<DenomTrace> | undefined {
  const restClient = useIbcRestClient(endpoint);
  const getKey = useCallback<
    SWRInfiniteKeyLoader<
      QueryDenomTracesResponse,
      [IbcRestClient, Uint8Array | undefined] | null
    >
  >(
    (pageIndex, previousPageData) => {
      // reached the end
      if (previousPageData && !previousPageData.pagination.next_key) {
        return null;
      }
      // fetch page by pageKey
      if (restClient) {
        const pageKey = previousPageData?.pagination.next_key;
        return [restClient, pageKey];
      } else {
        return null;
      }
    },
    [restClient]
  );
  const pages = useSWRInfinite(
    getKey,
    ([restClient, pageKey]) => {
      return restClient?.applications.transfer.v1.denomTraces({
        pagination: { key: pageKey },
      });
    },
    fetchAtMostOncePerHour
  ).data;

  return useMemo<DenomTrace[] | undefined>(() => {
    return pages?.flatMap((page) => page.denom_traces);
  }, [pages]);
}

function useChainIbcDenom(
  baseDenom: string,
  endpoint?: string
): string | undefined {
  const chainIbcDenoms = useChainIbcDenoms(endpoint);
  return useMemo(() => {
    const foundIbcDenom = chainIbcDenoms?.find(
      (chainIbcDenom) => chainIbcDenom.base_denom === baseDenom
    );
    const pathSteps =
      foundIbcDenom?.path.split('/').reduce(
        (
          paths: Array<{
            port_id: string;
            channel_id: string;
          }>,
          pathPart,
          index: number
        ) => {
          if (index % 2 === 0) {
            return paths.concat({ port_id: pathPart, channel_id: '' });
          } else {
            const lastPathPart = paths.pop();
            return paths.concat({
              port_id: lastPathPart?.port_id ?? '',
              channel_id: pathPart,
            });
          }
        },
        []
      ) ?? [];
    return foundIbcDenom && ibcDenom(pathSteps, foundIbcDenom.base_denom);
  }, [chainIbcDenoms, baseDenom]);
}

function useRecommendedNativeDenoms(): AssetList | undefined {
  return useSWRImmutable('registry-native-denoms', async () => {
    for (const chainRegistryEndpoint of chainRegistryEndpoints) {
      const res = await fetch(
        `${chainRegistryEndpoint}/neutrontestnet/assetlist.json`
      );
      if (res.ok) {
        return await res.json();
      }
    }
    return;
  }).data;
}

// function useTokensByDenomMap(): Map<string, Token> {
//   return useSWR(['all-denoms', REACT_APP__CHAIN_ID], () => {
//     return ;
//   }, revalidateNeverConfig).data
// }
