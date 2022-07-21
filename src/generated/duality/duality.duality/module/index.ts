// THIS FILE IS GENERATED AUTOMATICALLY. DO NOT MODIFY.

import { StdFee } from "@cosmjs/launchpad";
import { SigningStargateClient } from "@cosmjs/stargate";
import { Registry, OfflineSigner, EncodeObject, DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { Api } from "./rest";
import { MsgWithdrawShares } from "./types/duality/tx";
import { MsgDepositShares } from "./types/duality/tx";


const types = [
  ["/duality.duality.MsgWithdrawShares", MsgWithdrawShares],
  ["/duality.duality.MsgDepositShares", MsgDepositShares],
  
];
export const MissingWalletError = new Error("wallet is required");

export const registry = new Registry(<any>types);

interface TxClientOptions {
  addr: string
}

interface SignAndBroadcastOptions {
  fee?: StdFee | "auto" | number,
  memo?: string
}

const txClient = async (wallet: OfflineSigner, { addr: addr }: TxClientOptions = { addr: "http://localhost:26657" }) => {
  if (!wallet) throw MissingWalletError;
  const client = addr
    ? await SigningStargateClient.connectWithSigner(addr, wallet, { registry })
    : await SigningStargateClient.offline( wallet, { registry });
  const { address } = (await wallet.getAccounts())[0];

  return {
    signAndBroadcast: (msgs: EncodeObject[], { fee='auto', memo }: SignAndBroadcastOptions = {}) => client.signAndBroadcast(address, msgs, fee, memo),
    msgWithdrawShares: (data: MsgWithdrawShares): EncodeObject => ({ typeUrl: "/duality.duality.MsgWithdrawShares", value: MsgWithdrawShares.fromPartial( data ) }),
    msgDepositShares: (data: MsgDepositShares): EncodeObject => ({ typeUrl: "/duality.duality.MsgDepositShares", value: MsgDepositShares.fromPartial( data ) }),
    
  };
};

interface QueryClientOptions {
  addr: string
}

const queryClient = async ({ addr: addr }: QueryClientOptions = { addr: "http://localhost:1317" }) => {
  return new Api({ baseUrl: addr });
};

export {
  txClient,
  queryClient,
};
