import { Chain } from '@chain-registry/types';
import { useMemo, useState } from 'react';
import { ibc } from '@duality-labs/dualityjs';
import { QueryClientStatesResponseSDKType } from '@duality-labs/dualityjs/types/codegen/ibc/core/client/v1/query';
import { QueryConnectionsResponseSDKType } from '@duality-labs/dualityjs/types/codegen/ibc/core/connection/v1/query';
import { QueryChannelsResponseSDKType } from '@duality-labs/dualityjs/types/codegen/ibc/core/channel/v1/query';
import { State as ChannelState } from '@duality-labs/dualityjs/types/codegen/ibc/core/channel/v1/channel';
import { State as ConnectionState } from '@duality-labs/dualityjs/types/codegen/ibc/core/connection/v1/connection';
import { useQuery } from '@tanstack/react-query';

import { getChainInfo } from '../wallets/keplr';
import dualityLogo from '../../../assets/logo/logo.svg';
import { minutes } from '../../utils/time';

const {
  REACT_APP__CHAIN_NAME = '[chain_name]',
  REACT_APP__CHAIN_ID = '[chain_id]',
  REACT_APP__PROVIDER_CHAIN = '',
  REACT_APP__RPC_API = '',
  REACT_APP__REST_API = '',
} = process.env;

export const dualityChain: Chain = {
  chain_name: REACT_APP__CHAIN_NAME,
  status: 'upcoming',
  network_type: 'testnet',
  pretty_name: 'Duality Chain',
  chain_id: REACT_APP__CHAIN_ID,
  bech32_prefix: 'cosmos',
  slip44: 118,
  logo_URIs: {
    svg: dualityLogo,
  },
  apis: {
    rpc: [{ address: REACT_APP__RPC_API }],
    rest: [{ address: REACT_APP__REST_API }],
  },
};

export const providerChain: Chain | undefined = REACT_APP__PROVIDER_CHAIN
  ? JSON.parse(REACT_APP__PROVIDER_CHAIN)
  : undefined;

export function useChainAddress(chain?: Chain): {
  data?: string;
  isValidating: boolean;
  error?: Error;
} {
  const chainId = chain?.chain_id;
  const [{ data, isValidating, error }, setChainState] = useState<{
    data?: string;
    isValidating: boolean;
    error?: Error;
  }>({
    isValidating: false,
  });
  useMemo(() => {
    if (chainId) {
      setChainState({ isValidating: true });
      getChainInfo(chainId)
        .then((chainInfo) => {
          setChainState({
            data: chainInfo.bech32Address,
            isValidating: false,
          });
        })
        .catch((error) => {
          setChainState({ isValidating: false, error });
        });
    }
  }, [chainId]);
  return { data, isValidating, error };
}

async function getIbcLcdClient(
  chain: Chain
): Promise<ReturnType<typeof ibc.ClientFactory.createLCDClient> | undefined> {
  // get IBC LCD client
  const restEndpoint = chain?.apis?.rest?.at(0)?.address;
  if (restEndpoint) {
    return ibc.ClientFactory.createLCDClient({ restEndpoint });
  }
}

function useIbcClientStates(chain: Chain) {
  return useQuery({
    queryKey: ['ibc-client-states', chain.chain_id],
    queryFn: async (): Promise<
      QueryClientStatesResponseSDKType | undefined
    > => {
      // get IBC LCD client
      const lcd = await getIbcLcdClient(chain);
      return lcd?.ibc.core.client.v1.clientStates();
    },
    refetchInterval: 5 * minutes,
  });
}

function useIbcConnections(chain: Chain) {
  return useQuery({
    queryKey: ['ibc-connections', chain.chain_id],
    queryFn: async (): Promise<QueryConnectionsResponseSDKType | undefined> => {
      // get IBC LCD client
      const lcd = await getIbcLcdClient(chain);
      return lcd?.ibc.core.connection.v1.connections();
    },
    refetchInterval: 5 * minutes,
  });
}

function useIbcChannels(chain: Chain) {
  return useQuery({
    queryKey: ['ibc-channels', chain.chain_id],
    queryFn: async (): Promise<QueryChannelsResponseSDKType | undefined> => {
      // get IBC LCD client
      const lcd = await getIbcLcdClient(chain);
      // note: it appears that channels only appear in this list if they are of:
      // - state: "STATE_OPEN" connections
      // - status: "Active" clients
      //   - maybe: confirm state with an Active client but not OPEN connection
      return lcd?.ibc.core.channel.v1.channels();
    },
    refetchInterval: 5 * minutes,
  });
}

function filterConnectionsOpen(
  connection: QueryConnectionsResponseSDKType['connections'][number]
): boolean {
  // convert state Type to returned string representation of the enum
  const state = connection.state as unknown as keyof typeof ConnectionState;
  return state === 'STATE_OPEN';
}

function filterChannelsOpen(
  channel: QueryChannelsResponseSDKType['channels'][number]
): boolean {
  // convert state Type to returned string representation of the enum
  const state = channel.state as unknown as keyof typeof ChannelState;
  return state === 'STATE_OPEN';
}

export function useIbcOpenTransfers(chain: Chain = dualityChain) {
  const { data: { client_states } = {} } = useIbcClientStates(chain);
  const { data: { connections } = {} } = useIbcConnections(chain);
  const { data: { channels } = {} } = useIbcChannels(chain);

  return useMemo(() => {
    // get openClients (all listed clients are assumed to be working)
    const openClients = client_states || [];
    // get open connections
    const openConnections = (connections || []).filter(filterConnectionsOpen);
    // get open channels
    const openChannels = (channels || []).filter(filterChannelsOpen);

    // note: we assume that if a client exists and its connections and channels
    //       are open, then the same open resources exist on the counterparty.
    //       this may not be true, but is good enough for some UI lists
    return openClients.flatMap((clientState) => {
      const chainID = (
        clientState.client_state as unknown as { chain_id: string }
      ).chain_id;
      return (
        openConnections
          // filter to connections of the current client
          .filter((c) => c.client_id === clientState.client_id)
          .flatMap((connection) => {
            return (
              openChannels
                // filter to transfer channels that end at the current connection
                .filter((ch) => ch.port_id === 'transfer')
                .filter((ch) => ch.connection_hops.at(-1) === connection.id)
                .map((channel) => {
                  return {
                    chainID,
                    client: clientState,
                    connection,
                    channel,
                  };
                })
            );
          })
      );
    });
  }, [client_states, connections, channels]);
}

export function useConnectedChainIDs(chain: Chain = dualityChain) {
  const openTransfers = useIbcOpenTransfers();
  // return only chain IDs for easy comparison to different lists
  return useMemo(() => {
    return openTransfers.map((openTransfer) => openTransfer.chainID);
  }, [openTransfers]);
}
