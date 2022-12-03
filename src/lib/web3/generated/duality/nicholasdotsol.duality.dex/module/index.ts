/* eslint-disable */
/* tslint:disable */
// THIS FILE IS GENERATED AUTOMATICALLY. DO NOT MODIFY.

import { StdFee } from "@cosmjs/launchpad";
import { SigningStargateClient } from "@cosmjs/stargate";
import { Registry, OfflineSigner, EncodeObject, DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { Api } from "./rest";
import { MsgDeposit } from "./types/dex/tx";
import { MsgSwap } from "./types/dex/tx";
import { MsgWithdrawFilledLimitOrder } from "./types/dex/tx";
import { MsgPlaceLimitOrder } from "./types/dex/tx";
import { MsgWithdrawl } from "./types/dex/tx";
import { MsgCancelLimitOrder } from "./types/dex/tx";


const types = [
  ["/nicholasdotsol.duality.dex.MsgDeposit", MsgDeposit],
  ["/nicholasdotsol.duality.dex.MsgSwap", MsgSwap],
  ["/nicholasdotsol.duality.dex.MsgWithdrawFilledLimitOrder", MsgWithdrawFilledLimitOrder],
  ["/nicholasdotsol.duality.dex.MsgPlaceLimitOrder", MsgPlaceLimitOrder],
  ["/nicholasdotsol.duality.dex.MsgWithdrawl", MsgWithdrawl],
  ["/nicholasdotsol.duality.dex.MsgCancelLimitOrder", MsgCancelLimitOrder],
  
];
export const MissingWalletError = new Error("wallet is required");

export const registry = new Registry(<any>types);

const defaultFee = {
  amount: [],
  gas: "200000",
};

interface TxClientOptions {
  addr: string
}

interface SignAndBroadcastOptions {
  fee: StdFee,
  memo?: string
}

const txClient = async (wallet: OfflineSigner, { addr: addr }: TxClientOptions = { addr: process.env.REACT_APP__RPC_API || "" }) => {
  if (!wallet) throw MissingWalletError;
  const client = addr
    ? await SigningStargateClient.connectWithSigner(addr, wallet, { registry })
    : await SigningStargateClient.offline( wallet, { registry });
  const { address } = (await wallet.getAccounts())[0];

  return {
    signAndBroadcast: (msgs: EncodeObject[], { fee, memo }: SignAndBroadcastOptions = {fee: defaultFee, memo: ""}) => client.signAndBroadcast(address, msgs, fee,memo),
    msgDeposit: (data: MsgDeposit): EncodeObject => ({ typeUrl: "/nicholasdotsol.duality.dex.MsgDeposit", value: MsgDeposit.fromPartial( data ) }),
    msgSwap: (data: MsgSwap): EncodeObject => ({ typeUrl: "/nicholasdotsol.duality.dex.MsgSwap", value: MsgSwap.fromPartial( data ) }),
    msgWithdrawFilledLimitOrder: (data: MsgWithdrawFilledLimitOrder): EncodeObject => ({ typeUrl: "/nicholasdotsol.duality.dex.MsgWithdrawFilledLimitOrder", value: MsgWithdrawFilledLimitOrder.fromPartial( data ) }),
    msgPlaceLimitOrder: (data: MsgPlaceLimitOrder): EncodeObject => ({ typeUrl: "/nicholasdotsol.duality.dex.MsgPlaceLimitOrder", value: MsgPlaceLimitOrder.fromPartial( data ) }),
    msgWithdrawl: (data: MsgWithdrawl): EncodeObject => ({ typeUrl: "/nicholasdotsol.duality.dex.MsgWithdrawl", value: MsgWithdrawl.fromPartial( data ) }),
    msgCancelLimitOrder: (data: MsgCancelLimitOrder): EncodeObject => ({ typeUrl: "/nicholasdotsol.duality.dex.MsgCancelLimitOrder", value: MsgCancelLimitOrder.fromPartial( data ) }),
    
  };
};

interface QueryClientOptions {
  addr: string
}

const queryClient = async ({ addr: addr }: QueryClientOptions = { addr: process.env.REACT_APP__REST_API || "" }) => {
  return new Api({ baseUrl: addr });
};

export {
  txClient,
  queryClient,
};
