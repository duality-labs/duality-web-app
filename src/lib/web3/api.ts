// This file is modified from an original generated/duality/duality.duality/module/index.ts file

import { StdFee } from '@cosmjs/launchpad';
import { defaultRegistryTypes, SigningStargateClient } from '@cosmjs/stargate';
import { Registry, OfflineSigner, EncodeObject } from '@cosmjs/proto-signing';
import { Api } from './generated/duality/duality.duality/module/rest';
import * as msgs from './generated/duality/duality.duality/module/types/duality/tx';

const { REACT_APP__RPC_URL = '', REACT_APP__REST_URL = '' } = process.env;

export const MissingWalletError = new Error('wallet is required');

export const registry = new Registry(defaultRegistryTypes);

Object.entries(msgs).forEach(([key, value]) => {
  // register additional Msgs here
  if (typeof value === 'object') {
    registry.register(`/duality.duality.${key}`, value);
  }
});

interface TxClientOptions {
  addr?: string;
}

interface SignAndBroadcastOptions {
  fee?: StdFee | 'auto' | number;
  memo?: string;
}

const txClient = async (
  wallet: OfflineSigner,
  { addr = REACT_APP__RPC_URL }: TxClientOptions = {}
) => {
  if (!wallet) throw MissingWalletError;
  const client = addr
    ? await SigningStargateClient.connectWithSigner(addr, wallet, { registry })
    : await SigningStargateClient.offline(wallet, { registry });
  const { address } = (await wallet.getAccounts())[0];

  return {
    signAndBroadcast: (
      msgs: EncodeObject[],
      { fee = 'auto', memo }: SignAndBroadcastOptions = {}
    ) => client.signAndBroadcast(address, msgs, fee, memo),
    ...Object.entries(msgs).reduce<{ [key: string]: object }>(
      (acc, [key, value]) => {
        // register additional Msgs here
        if (typeof value === 'object') {
          acc[key] = (data: typeof value): EncodeObject => ({
            typeUrl: `/duality.duality.${key}`,
            value: value.fromPartial(data as object),
          });
          registry.register(`/duality.duality.${key}`, value);
        }
        return acc;
      },
      {}
    ),
  };
};

interface QueryClientOptions {
  addr?: string;
}

const queryClient = async ({
  addr = REACT_APP__REST_URL,
}: QueryClientOptions = {}) => {
  return new Api({ baseUrl: addr });
};

export { txClient, queryClient };
