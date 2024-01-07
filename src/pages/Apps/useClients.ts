import { SigningStargateClient } from '@cosmjs/stargate';
import { GeneratedType, OfflineSigner } from '@cosmjs/proto-signing';
import { Tendermint37Client } from '@cosmjs/tendermint-rpc';
import useSWRImmutable from 'swr/immutable';

import { getSigningDualityClientOptions } from '@duality-labs/dualityjs';
import { useEffect, useState } from 'react';

const { REACT_APP__RPC_API: defaultRpcEndpoint = '' } = import.meta.env;

// create single Tendermint37 connection for any signing client of this endpoint
export function useTendermintClient(rpcEndpoint: string) {
  return useSWRImmutable(['rpc', rpcEndpoint], async () => {
    return Tendermint37Client.connect(rpcEndpoint);
  }).data;
}

// create RPC tx signing clients from a cached base client
export function useDualitySigningClient(
  wallet: OfflineSigner | null,
  rpcEndpoint = defaultRpcEndpoint,
  defaultTypes?: ReadonlyArray<[string, GeneratedType]>
): SigningStargateClient | undefined {
  const tmClient = useTendermintClient(rpcEndpoint);

  const [signingClient, setSigningClient] = useState<SigningStargateClient>();
  useEffect(() => {
    // remove previous client
    setSigningClient(undefined);

    // create a new signing client for each wallet
    // start promise, but doesn't set the state if cleanup has triggered
    let cancel = false;
    if (tmClient && wallet) {
      SigningStargateClient.createWithSigner(
        tmClient,
        wallet,
        getSigningDualityClientOptions({ defaultTypes })
      ).then((client) => {
        if (!cancel) {
          setSigningClient(client);
        }
      });
    }

    return () => {
      cancel = true;
    };
  }, [tmClient, wallet, defaultTypes]);
  return signingClient;
}
