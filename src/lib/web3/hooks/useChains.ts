import { Chain } from '@chain-registry/types';
import { useMemo, useState } from 'react';
import { ibc, router } from '@duality-labs/dualityjs';
import { QueryParamsResponse as QueryRouterParams } from '@duality-labs/dualityjs/types/codegen/router/v1/query';
import { QueryClientStatesResponse } from '@duality-labs/dualityjs/types/codegen/ibc/core/client/v1/query';
import { Params as QueryConnectionParams } from '@duality-labs/dualityjs/types/codegen/ibc/core/connection/v1/connection';
import { QueryConnectionsResponse } from '@duality-labs/dualityjs/types/codegen/ibc/core/connection/v1/query';
import { QueryChannelsResponse } from '@duality-labs/dualityjs/types/codegen/ibc/core/channel/v1/query';
import { QueryBalanceResponse } from '@duality-labs/dualityjs/types/codegen/cosmos/bank/v1beta1/query';
import { State as ChannelState } from '@duality-labs/dualityjs/types/codegen/ibc/core/channel/v1/channel';
import { State as ConnectionState } from '@duality-labs/dualityjs/types/codegen/ibc/core/connection/v1/connection';
import { useQuery } from '@tanstack/react-query';

import { getChainInfo } from '../wallets/keplr';
import dualityLogo from '../../../assets/logo/logo.svg';
import { Token } from '../utils/tokens';
import { minutes } from '../../utils/time';
import Long from 'long';

interface QueryConnectionParamsResponse {
  params?: QueryConnectionParams;
}

const {
  REACT_APP__CHAIN = '',
  REACT_APP__CHAIN_NAME = '[chain_name]',
  REACT_APP__CHAIN_ID = '[chain_id]',
  REACT_APP__CHAIN_FEE_TOKENS = '',
  REACT_APP__PROVIDER_CHAIN = '',
  REACT_APP__RPC_API = '',
  REACT_APP__REST_API = '',
} = process.env;

type ChainFeeTokens = NonNullable<Chain['fees']>['fee_tokens'];
export const dualityChain: Chain = {
  chain_id: REACT_APP__CHAIN_ID,
  chain_name: REACT_APP__CHAIN_ID,
  pretty_name: REACT_APP__CHAIN_NAME,
  status: 'upcoming',
  network_type: 'testnet',
  bech32_prefix: 'cosmos',
  slip44: 118,
  logo_URIs: {
    svg: dualityLogo,
  },
  apis: {
    rpc: [{ address: REACT_APP__RPC_API }],
    rest: [{ address: REACT_APP__REST_API }],
  },
  fees: {
    // if not specified the fee tokens will default to the stake token in Keplr
    // see: https://github.com/cosmology-tech/chain-registry/blob/%40chain-registry/keplr%401.22.1/packages/keplr/src/index.ts#L103-L131
    fee_tokens: REACT_APP__CHAIN_FEE_TOKENS
      ? (JSON.parse(REACT_APP__CHAIN_FEE_TOKENS) as ChainFeeTokens)
      : [],
  },
  // override default settings with an env variable for the whole chain config
  ...(REACT_APP__CHAIN ? (JSON.parse(REACT_APP__CHAIN) as Chain) : {}),
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
  restEndpoint?: string | null
): Promise<ReturnType<typeof ibc.ClientFactory.createLCDClient> | undefined> {
  // get IBC LCD client
  if (restEndpoint) {
    return ibc.ClientFactory.createLCDClient({ restEndpoint });
  }
}

function useIbcClientStates(chain: Chain) {
  const { data: restEndpoint } = useRemoteChainRestEndpoint(chain);
  return useQuery({
    queryKey: ['ibc-client-states', restEndpoint],
    queryFn: async (): Promise<QueryClientStatesResponse> => {
      // get IBC LCD client
      const lcd = await getIbcLcdClient(restEndpoint);
      // note: it appears that clients may appear in this list if they are of:
      // - state: "STATE_OPEN", but with
      // - status: "Expired" (this property must be queried individually:
      //           using GET/ibc/core/client/v1/client_status/07-tendermint-0)
      // we ignore the status of the light clients here, but their status should
      // be checked at the moment they are required for a transfer
      return (
        lcd?.ibc.core.client.v1.clientStates() ?? {
          client_states: [],
          pagination: { total: Long.ZERO },
        }
      );
    },
    refetchInterval: 5 * minutes,
  });
}

function useIbcConnections(chain: Chain) {
  const { data: restEndpoint } = useRemoteChainRestEndpoint(chain);
  return useQuery({
    queryKey: ['ibc-connections', restEndpoint],
    queryFn: async (): Promise<QueryConnectionsResponse> => {
      // get IBC LCD client
      const lcd = await getIbcLcdClient(restEndpoint);
      return (
        lcd?.ibc.core.connection.v1.connections() ?? {
          connections: [],
          pagination: { total: Long.ZERO },
          height: { revision_height: Long.ZERO, revision_number: Long.ZERO },
        }
      );
    },
    refetchInterval: 5 * minutes,
  });
}

function useIbcChannels(chain: Chain) {
  const { data: restEndpoint } = useRemoteChainRestEndpoint(chain);
  return useQuery({
    queryKey: ['ibc-channels', restEndpoint],
    queryFn: async (): Promise<QueryChannelsResponse> => {
      // get IBC LCD client
      const lcd = await getIbcLcdClient(restEndpoint);
      return (
        lcd?.ibc.core.channel.v1.channels() ?? {
          channels: [],
          pagination: { total: Long.ZERO },
          height: { revision_height: Long.ZERO, revision_number: Long.ZERO },
        }
      );
    },
    refetchInterval: 5 * minutes,
  });
}

function filterConnectionsOpen(
  connection: QueryConnectionsResponse['connections'][number]
): boolean {
  return connection.state === (3 as ConnectionState.STATE_OPEN);
}

function filterChannelsOpen(
  channel: QueryChannelsResponse['channels'][number]
): boolean {
  return channel.state === (3 as ChannelState.STATE_OPEN);
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
      const chainID = clientState.client_state?.chain_id;
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
            new Promise<string>((resolve, reject) => setTimeout(reject, 10000)),
          ]);
          return rpcEndpoint ?? null;
        } catch (e) {
          // all requests failed or the requests timed out
          return null;
        }
      }
      // return the Duality chain REST API if this is the Duality chain
      else if (chain?.chain_id === REACT_APP__CHAIN_ID) {
        return REACT_APP__RPC_API;
      }
      // return nothing if the request is invalid
      else {
        return null;
      }
    },
    refetchInterval: false,
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
            new Promise<string>((resolve, reject) => setTimeout(reject, 10000)),
          ]);
          return restEndpoint ?? null;
        } catch (e) {
          // all requests failed or the requests timed out
          return null;
        }
      }
      // return the Duality chain REST API if this is the Duality chain
      else if (chain?.chain_id === REACT_APP__CHAIN_ID) {
        return REACT_APP__REST_API;
      }
      // return nothing if the request is invalid
      else {
        return null;
      }
    },
    refetchInterval: false,
  });
}

export function useRemoteChainBankBalance(
  chain: Chain,
  token?: Token,
  address?: string
) {
  const { data: restEndpoint } = useRemoteChainRestEndpoint(chain);
  return useQuery({
    enabled: !!token,
    queryKey: ['cosmos-chain-endpoints', restEndpoint, address],
    queryFn: async (): Promise<QueryBalanceResponse | null> => {
      if (restEndpoint && address && token) {
        const client = await ibc.ClientFactory.createLCDClient({
          restEndpoint,
        });
        // optionally find the IBC denom when querying the Duality chain
        const denom =
          restEndpoint === REACT_APP__REST_API
            ? token.denom_units
                .find((unit) => unit.denom === token.base)
                ?.aliases?.find((alias) => alias.startsWith('ibc/')) ??
              token.base
            : token.base;
        return client.cosmos.bank.v1beta1.balance({
          address,
          denom,
        });
      } else {
        return null;
      }
    },
    refetchInterval: 5 * minutes,
  });
}

export function useRemoteChainBlockTime(chain: Chain) {
  const { data: restEndpoint } = useRemoteChainRestEndpoint(chain);
  return useQuery({
    enabled: !!restEndpoint,
    queryKey: ['cosmos-chain-block-time', restEndpoint],
    queryFn: async (): Promise<QueryConnectionParamsResponse | null> => {
      if (restEndpoint) {
        const client = await ibc.ClientFactory.createLCDClient({
          restEndpoint,
        });
        try {
          const params = await client.ibc.core.connection.v1.connectionParams();
          // fix return type to point to connection params and not client params
          return params as unknown as QueryConnectionParamsResponse;
        } catch (e) {
          // many chains do not return this route, in which case: state empty
          return {};
        }
      } else {
        return null;
      }
    },
    refetchInterval: 5 * minutes,
  });
}

export function useRemoteChainFees(chain: Chain) {
  const { data: restEndpoint } = useRemoteChainRestEndpoint(chain);
  return useQuery({
    enabled: !!restEndpoint,
    queryKey: ['cosmos-chain-fees', restEndpoint],
    queryFn: async (): Promise<QueryRouterParams | null> => {
      if (restEndpoint) {
        const client = await router.ClientFactory.createLCDClient({
          restEndpoint,
        });
        return client.router.v1.params();
      } else {
        return null;
      }
    },
    refetchInterval: 5 * minutes,
  });
}
