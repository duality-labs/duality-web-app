import { Chain } from '@chain-registry/types';
import { useMemo, useState } from 'react';
import { ibc } from '@duality-labs/dualityjs';
import { QueryClientStatesResponseSDKType } from '@duality-labs/dualityjs/types/codegen/ibc/core/client/v1/query';
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

export function useConnectedChainIDs(chain: Chain = dualityChain) {
  const { data: { client_states: ibcClientStates } = {} } =
    useIbcClientStates(chain);
  // list of connected chain IDs from IBC client list
  // todo: ensure the chain connections are status: Active (not Expired)
  return useMemo(() => {
    return (ibcClientStates || []).map((state) => {
      // give correct clientState type
      return (state.client_state as unknown as { chain_id: string }).chain_id;
    });
  }, [ibcClientStates]);
}
