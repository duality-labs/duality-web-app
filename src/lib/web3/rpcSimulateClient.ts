import { dualitylabs } from '@duality-labs/dualityjs';
import { encodeSecp256k1Pubkey } from '@cosmjs/amino'; // this is an indirect dependency
import {
  Registry,
  EncodeObject,
  OfflineSigner,
  GeneratedType,
} from '@cosmjs/proto-signing';
import {
  QueryClient,
  StargateClient,
  setupTxExtension,
  TxExtension,
  HttpEndpoint,
} from '@cosmjs/stargate';

import { getTendermintClient } from './rpcQueryClient';

interface WrappedTxExtensionTx extends Omit<TxExtension['tx'], 'simulate'> {
  simulate: (
    signerAddress: string,
    messages: readonly EncodeObject[],
    memo?: string
  ) => ReturnType<TxExtension['tx']['simulate']>;
}
interface WrappedTxExtension extends Omit<TxExtension, 'tx'> {
  tx: WrappedTxExtensionTx;
}

export async function getSigningDualitylabsSimulationClient({
  rpcEndpoint,
  signer,
  defaultTypes = dualitylabs.duality.dex.registry,
}: {
  rpcEndpoint?: string | HttpEndpoint;
  signer: OfflineSigner;
  defaultTypes?: ReadonlyArray<[string, GeneratedType]>;
}): Promise<WrappedTxExtension> {
  const tmClient = await getTendermintClient(rpcEndpoint);
  const queryClient = new QueryClient(tmClient);
  const txExtension = setupTxExtension(queryClient);
  const stargateClient = await StargateClient.create(tmClient);
  const registry = new Registry(defaultTypes);
  // wrap txExtension in easier to use class
  return {
    tx: {
      getTx(txId) {
        return txExtension.tx.getTx(txId);
      },
      async simulate(signerAddress, messages, memo) {
        const anyMsgs = messages.map((m) => registry.encodeAsAny(m));
        const accountFromSigner = (await signer.getAccounts()).find(
          (account) => account.address === signerAddress
        );
        if (!accountFromSigner) {
          throw new Error('Failed to retrieve account from signer');
        }
        const pubkey = encodeSecp256k1Pubkey(accountFromSigner.pubkey);
        const { sequence } = await stargateClient.getSequence(signerAddress);
        return txExtension.tx.simulate(anyMsgs, memo, pubkey, sequence);
      },
    },
  };
}
