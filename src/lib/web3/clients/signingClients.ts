import useSWRImmutable from 'swr/immutable';
import { Tendermint34Client } from '@cosmjs/tendermint-rpc';
import { GeneratedType, OfflineSigner, Registry } from '@cosmjs/proto-signing';
import { encodeSecp256k1Pubkey } from '@cosmjs/amino';
import {
  StargateClient,
  SigningStargateClient,
  QueryClient,
  setupTxExtension,
  TxExtension,
} from '@cosmjs/stargate';
import {
  getSigningIbcClient,
  getSigningNeutronClient,
  getSigningNeutronClientOptions,
  neutronProtoRegistry,
} from '@duality-labs/neutronjs';

const { REACT_APP__RPC_API: defaultRpcEndpoint = '' } = import.meta.env;

// create single Tendermint37 connection for any signing client of this endpoint
// note: use this instead of the direct `getSigningNeutronClient` method
//       because we already know that the native chain is at Tendermint37.
//       the base `getSigningNeutronClient` will make a network request to check
function useTendermint37Client(rpcEndpoint: string) {
  return useSWRImmutable(['tmClient', rpcEndpoint], async () => {
    return Tendermint34Client.connect(rpcEndpoint);
  }).data;
}

type TxSimulationClient = {
  // use StargateClient simulate parameters but return full message not just gas
  simulate: (
    ...args: Parameters<SigningStargateClient['simulate']>
  ) => ReturnType<TxExtension['tx']['simulate']>;
};
export class TxSimulationError extends Error {
  constructor(error: unknown) {
    // parse messages to handle any possible library excpetions
    const message = (error as Error)?.message || `${error}`;
    super(message);
    this.name = 'TxSimulationError';
  }
}

export function useTxSimulationClient(
  signer: OfflineSigner | null,
  rpcEndpoint = defaultRpcEndpoint,
  defaultTypes: ReadonlyArray<[string, GeneratedType]> = neutronProtoRegistry
) {
  const tmClient = useTendermint37Client(rpcEndpoint);
  return useSWRImmutable<TxSimulationClient | undefined, TxSimulationError>(
    tmClient && signer ? ['queryClient', rpcEndpoint] : null,
    async (): Promise<TxSimulationClient | undefined> => {
      // early return null condition keys to assist types in this function
      if (!(tmClient && signer)) return;
      try {
        const stargateClient = await StargateClient.create(tmClient);
        const stargateQueryClient = new QueryClient(tmClient);
        const stargateQueryTxClient = setupTxExtension(stargateQueryClient);
        const registry = new Registry(defaultTypes);
        return {
          simulate: async function simulate(signerAddress, messages, memo) {
            const anyMsgs = messages.map((m) => registry.encodeAsAny(m));
            const accountFromSigner = (await signer.getAccounts()).find(
              (account) => account.address === signerAddress
            );
            if (!accountFromSigner) {
              throw new Error('Failed to retrieve account from signer');
            }

            const pubkey = encodeSecp256k1Pubkey(accountFromSigner.pubkey);
            const { sequence } = await stargateClient.getSequence(
              signerAddress
            );
            return await stargateQueryTxClient.tx.simulate(
              anyMsgs,
              memo,
              pubkey,
              sequence
            );
          },
        };
      } catch (error) {
        throw new TxSimulationError(error);
      }
    }
  ).data;
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
            getSigningNeutronClientOptions({ defaultTypes })
          );
        }
      : null
  ).data;
}

// hook for signing client where we don't know what version of Tendermint it is
export function useIbcSigningClient(
  signer: OfflineSigner,
  rpcEndpoint: string,
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

// note: for IBC transfer: up-to-date info is more important that cached data
//       so just using the direct signing method at user action time may be best
export async function getDexSigningClient(
  signer: OfflineSigner,
  rpcEndpoint = defaultRpcEndpoint,
  defaultTypes?: ReadonlyArray<[string, GeneratedType]>
) {
  return getSigningNeutronClient({ rpcEndpoint, signer, defaultTypes });
}
export function getIbcSigningClient(
  signer: OfflineSigner,
  rpcEndpoint: string,
  defaultTypes?: ReadonlyArray<[string, GeneratedType]>
) {
  return getSigningIbcClient({ rpcEndpoint, signer, defaultTypes });
}
