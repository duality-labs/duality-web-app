/* eslint-disable */
/* tslint:disable */
// THIS FILE IS GENERATED AUTOMATICALLY. DO NOT MODIFY.

import { StdFee } from "@cosmjs/launchpad";
import { SigningStargateClient } from "@cosmjs/stargate";
import { Registry, OfflineSigner, EncodeObject, DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { Api } from "./rest";
import { MsgSwap } from "./types/router/tx";


const types = [
  ["/nicholasdotsol.duality.router.MsgSwap", MsgSwap],
  
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
    msgSwap: (data: MsgSwap): EncodeObject => ({ typeUrl: "/nicholasdotsol.duality.router.MsgSwap", value: MsgSwap.fromPartial( data ) }),
    
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
