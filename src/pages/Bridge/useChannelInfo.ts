import { useMemo } from 'react';
import { SWRResponse } from 'swr';
import { useQuery } from '@tanstack/react-query';
import { Asset, Chain, IBCInfo, IBCTrace } from '@chain-registry/types';
import { QueryClientStatusResponse } from '@duality-labs/neutronjs/types/codegen/ibc/core/client/v1/query';

import { useRelatedChainsClient } from '../../lib/web3/hooks/useDenomsFromRegistry';
import { useRemoteChainRestEndpoint } from '../../lib/web3/hooks/useChains';
import { getIbcRestClient } from '../../lib/web3/clients/restClients';

type ChannelInfo = {
  chain_name: string;
  client_id: string;
  connection_id: string;
  channel_id: string;
  port_id: string;
  ordering: string;
  version: string;
  tags: object | undefined;
};

function getChannelSideInfo(
  ibcInfo: IBCInfo,
  channelId: string
): ChannelInfo | undefined {
  const channel = ibcInfo.channels.find((channel) => {
    return (
      channel.chain_1.channel_id === channelId ||
      channel.chain_2.channel_id === channelId
    );
  });
  if (channel) {
    // return the channel and connection props of the IBC chain side
    const chainSide =
      channel.chain_1.channel_id === channelId ? 'chain_1' : 'chain_2';
    return {
      // take channel props
      ordering: channel.ordering,
      version: channel.version,
      tags: channel.tags,
      // take channel side props
      ...channel[chainSide],
      // take connection side props
      ...ibcInfo[chainSide],
    };
  }
}

function getSingleHopIbcTrace(asset: Asset): IBCTrace | undefined {
  if (asset.traces?.length === 1) {
    const trace = asset.traces?.at(0);
    if (trace && trace?.type === 'ibc') {
      return trace as IBCTrace;
    }
  }
}

function useConnectionInfo(
  chain?: Chain,
  counterChain?: Chain
): SWRResponse<IBCInfo> {
  // find the channel information on the from side for the bridge request
  const { data: relatedChainsClient, ...swr } = useRelatedChainsClient();
  const data = useMemo<IBCInfo | undefined>(() => {
    // find matching ibcInfo from relatedChainsClient ibcData
    const chainA = chain;
    const chainB = counterChain;
    return chainA?.chain_name && chainB?.chain_name
      ? relatedChainsClient?.ibcData.find((connection) => {
          return (
            (connection.chain_1.chain_name === chainA.chain_name &&
              connection.chain_2.chain_name === chainB.chain_name) ||
            (connection.chain_1.chain_name === chainB.chain_name &&
              connection.chain_2.chain_name === chainA.chain_name)
          );
        })
      : undefined;
  }, [chain, counterChain, relatedChainsClient]);
  return { ...swr, data } as SWRResponse;
}

export function useSingleHopChannelInfo(
  chain?: Chain,
  counterChain?: Chain,
  token?: Asset
): SWRResponse<ChannelInfo> {
  // find the channel information on the from side for the bridge request
  const { data: ibcInfo, ...swr } = useConnectionInfo(chain, counterChain);
  const channelInfo = useMemo<ChannelInfo | undefined>(() => {
    const ibcTrace = token && getSingleHopIbcTrace(token);
    if (ibcTrace) {
      // return just the chain (not counterChain) channel info
      if (ibcInfo && chain) {
        return [
          getChannelSideInfo(ibcInfo, ibcTrace.chain.channel_id),
          getChannelSideInfo(ibcInfo, ibcTrace.counterparty.channel_id),
        ]
          .filter((info) => info?.chain_name === chain.chain_name)
          .at(0);
      }
    }
  }, [chain, ibcInfo, token]);

  return { ...swr, data: channelInfo } as SWRResponse;
}

export function useSingleHopChannelStatus(chain?: Chain, clientId?: string) {
  const { data: restEndpoint, ...swr } = useRemoteChainRestEndpoint(chain);
  const query = useQuery({
    queryKey: ['core.client.v1.clientStatus', restEndpoint, clientId],
    queryFn: async (): Promise<QueryClientStatusResponse | null> => {
      const restClient = restEndpoint && (await getIbcRestClient(restEndpoint));
      return restClient && clientId
        ? restClient.core.client.v1.clientStatus({ client_id: clientId })
        : null;
    },
    refetchInterval: false,
    refetchOnMount: false,
  });

  return restEndpoint === undefined ? { ...swr, data: undefined } : query;
}
