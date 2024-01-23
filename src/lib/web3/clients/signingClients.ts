import useSWRImmutable from 'swr/immutable';
import { SigningStargateClient } from '@cosmjs/stargate';
import { Tendermint34Client } from '@cosmjs/tendermint-rpc';
import { GeneratedType, OfflineSigner } from '@cosmjs/proto-signing';
import {
  getSigningIbcClient,
  getSigningDualityClientOptions,
} from '@duality-labs/dualityjs';

const { REACT_APP__RPC_API: defaultRpcEndpoint = '' } = import.meta.env;

// create single Tendermint37 connection for any signing client of this endpoint
// note: use this instead of the direct `getSigningDualityClient` method
//       because we already know that the native chain is at Tendermint37.
//       the base `getSigningDualityClient` will make a network request to check
function useTendermint37Client(rpcEndpoint: string) {
  return useSWRImmutable(['rpc', rpcEndpoint], async () => {
    return Tendermint34Client.connect(rpcEndpoint);
  }).data;
}

// hook for signing client without Tendermint34 lookup: we know its Tendermint37
export function useDexSigningClient(
  signer?: OfflineSigner,
  rpcEndpoint = defaultRpcEndpoint,
  defaultTypes?: ReadonlyArray<[string, GeneratedType]>
): SigningStargateClient | undefined {
  const tmClient = useTendermint37Client(rpcEndpoint);

  return useSWRImmutable(
    // tmClient is a dependency, but it depends only on rpcEndpoint,
    // so key the cache by rpcEndpoint instead of the more complex tmClient
    ['dex-signing-client', rpcEndpoint, signer, defaultTypes],
    tmClient && signer
      ? async () => {
          return SigningStargateClient.createWithSigner(
            tmClient,
            signer,
            getSigningDualityClientOptions({ defaultTypes })
          );
        }
      : null
  ).data;
}

// note: for IBC transfer: up-to-date info is more important that cached data
//       so just using the direct signing method at user action time may be best
export { getSigningIbcClient as getIbcSigningClient };

// hook for signing client where we don't know what version of Tendermint it is
export function useIbcSigningClient(
  rpcEndpoint: string,
  signer?: OfflineSigner,
  defaultTypes?: ReadonlyArray<[string, GeneratedType]>
) {
  return useSWRImmutable(
    ['ibc-signing-client', rpcEndpoint, signer, defaultTypes],
    signer
      ? async () => {
          return getSigningIbcClient({ rpcEndpoint, signer, defaultTypes });
        }
      : null
  ).data;
}
