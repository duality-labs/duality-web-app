import useSWRImmutable from 'swr/immutable';
import { SigningStargateClient } from '@cosmjs/stargate';
import { Tendermint34Client } from '@cosmjs/tendermint-rpc';
import { GeneratedType, OfflineSigner } from '@cosmjs/proto-signing';
import { useEffect, useState } from 'react';
import {
  getSigningIbcClient,
  getSigningNeutronClientOptions,
} from '@duality-labs/dualityjs';

const { REACT_APP__RPC_API: defaultRpcEndpoint = '' } = import.meta.env;

// create single Tendermint37 connection for any signing client of this endpoint
export function useTendermintClient(rpcEndpoint: string) {
  return useSWRImmutable(['rpc', rpcEndpoint], async () => {
    return Tendermint34Client.connect(rpcEndpoint);
  }).data;
}

// create RPC tx signing clients from a cached base client

export function useNeutronSigningClient(
  wallet?: OfflineSigner,
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
        getSigningNeutronClientOptions({ defaultTypes })
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

// don't use IBC signing client in a hook:
// - its complicated to create a wallet cache key (useSWR or tanstack cache key)
// - for IBC transfer: up-to-date information is more important that cached data
export { getSigningIbcClient as getIbcSigningClient };

// // example of maybe working extrnal chain IBC signing client hook
// export function useIbcSigningClient(
//   wallet?: OfflineSigner,
//   rpcEndpoint = defaultRpcEndpoint,
//   defaultTypes?: ReadonlyArray<[string, GeneratedType]>
// ) {
//   const tmClient = useTendermintClient(rpcEndpoint);

//   return useSWRImmutable(
//     ['ibc-signing-client', rpcEndpoint, wallet],
//     async () => {
//       if (tmClient && wallet) {
//         return (
//           tmClient &&
//           SigningStargateClient.createWithSigner(
//             tmClient,
//             wallet,
//             getSigningNeutronClientOptions({ defaultTypes })
//           )
//         );
//       }
//     }
//   ).data;
// }
