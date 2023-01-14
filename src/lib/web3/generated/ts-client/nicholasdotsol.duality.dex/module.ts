/* eslint-disable */
/* tslint:disable */
// Generated by Ignite ignite.com/cli

import { StdFee } from "@cosmjs/launchpad";
import { EncodeObject, GeneratedType, OfflineSigner, Registry } from "@cosmjs/proto-signing";
import { DeliverTxResponse, SigningStargateClient } from "@cosmjs/stargate";
import { IgniteClient } from "../client";
import { msgTypes } from './registry';
import { Api } from "./rest";
import { MsgCancelLimitOrder, MsgDeposit, MsgPlaceLimitOrder, MsgSwap, MsgWithdrawFilledLimitOrder, MsgWithdrawl } from "./types/dex/tx";
type msgCancelLimitOrderParams = {
  value: MsgCancelLimitOrder,
};
type msgDepositParams = {
  value: MsgDeposit,
};
type msgPlaceLimitOrderParams = {
  value: MsgPlaceLimitOrder,
};
type msgSwapParams = {
  value: MsgSwap,
};
type msgWithdrawFilledLimitOrderParams = {
  value: MsgWithdrawFilledLimitOrder,
};
type msgWithdrawlParams = {
  value: MsgWithdrawl,
};
type sendMsgCancelLimitOrderParams = {
  value: MsgCancelLimitOrder,
  fee?: StdFee,
  memo?: string
};
type sendMsgDepositParams = {
  value: MsgDeposit,
  fee?: StdFee,
  memo?: string
};
type sendMsgPlaceLimitOrderParams = {
  value: MsgPlaceLimitOrder,
  fee?: StdFee,
  memo?: string
};
type sendMsgSwapParams = {
  value: MsgSwap,
  fee?: StdFee,
  memo?: string
};
type sendMsgWithdrawFilledLimitOrderParams = {
  value: MsgWithdrawFilledLimitOrder,
  fee?: StdFee,
  memo?: string
};
type sendMsgWithdrawlParams = {
  value: MsgWithdrawl,
  fee?: StdFee,
  memo?: string
};

interface QueryClientOptions {
  addr: string
}

interface TxClientOptions {
  addr: string
	prefix: string
	signer?: OfflineSigner
}

export const registry = new Registry(msgTypes);
const defaultFee = {

  amount: [],
  gas: "200000"
};
export const txClient = ({ signer, prefix, addr }: TxClientOptions = { addr: "http://localhost:26657", prefix: "cosmos" }) => {

  return {

  		msgCancelLimitOrder({ value }: msgCancelLimitOrderParams): EncodeObject {
  			try {
  				return { typeUrl: "/nicholasdotsol.duality.dex.MsgCancelLimitOrder", value: MsgCancelLimitOrder.fromPartial( value ) }
  			} catch (e: any) {
  				throw new Error('TxClient:MsgCancelLimitOrder: Could not create message: ' + e.message)
  			}
  		},

  		msgDeposit({ value }: msgDepositParams): EncodeObject {
  			try {
  				return { typeUrl: "/nicholasdotsol.duality.dex.MsgDeposit", value: MsgDeposit.fromPartial( value ) }
  			} catch (e: any) {
  				throw new Error('TxClient:MsgDeposit: Could not create message: ' + e.message)
  			}
  		},

  		msgPlaceLimitOrder({ value }: msgPlaceLimitOrderParams): EncodeObject {
  			try {
  				return { typeUrl: "/nicholasdotsol.duality.dex.MsgPlaceLimitOrder", value: MsgPlaceLimitOrder.fromPartial( value ) }
  			} catch (e: any) {
  				throw new Error('TxClient:MsgPlaceLimitOrder: Could not create message: ' + e.message)
  			}
  		},

  		msgSwap({ value }: msgSwapParams): EncodeObject {
  			try {
  				return { typeUrl: "/nicholasdotsol.duality.dex.MsgSwap", value: MsgSwap.fromPartial( value ) }
  			} catch (e: any) {
  				throw new Error('TxClient:MsgSwap: Could not create message: ' + e.message)
  			}
  		},

  		msgWithdrawFilledLimitOrder({ value }: msgWithdrawFilledLimitOrderParams): EncodeObject {
  			try {
  				return { typeUrl: "/nicholasdotsol.duality.dex.MsgWithdrawFilledLimitOrder", value: MsgWithdrawFilledLimitOrder.fromPartial( value ) }
  			} catch (e: any) {
  				throw new Error('TxClient:MsgWithdrawFilledLimitOrder: Could not create message: ' + e.message)
  			}
  		},

  		msgWithdrawl({ value }: msgWithdrawlParams): EncodeObject {
  			try {
  				return { typeUrl: "/nicholasdotsol.duality.dex.MsgWithdrawl", value: MsgWithdrawl.fromPartial( value ) }
  			} catch (e: any) {
  				throw new Error('TxClient:MsgWithdrawl: Could not create message: ' + e.message)
  			}
  		},

  		async sendMsgCancelLimitOrder({ value, fee, memo }: sendMsgCancelLimitOrderParams): Promise<DeliverTxResponse> {
  			if (!signer) {
  					throw new Error('TxClient:sendMsgCancelLimitOrder: Unable to sign Tx. Signer is not present.')
  			}
  			try {
  				const { address } = (await signer.getAccounts())[0];
  				const signingClient = await SigningStargateClient.connectWithSigner(addr,signer,{prefix, registry});
  				let msg = this.msgCancelLimitOrder({ value: MsgCancelLimitOrder.fromPartial(value) })
  				return await signingClient.signAndBroadcast(address, [msg], fee ? fee : defaultFee, memo)
  			} catch (e: any) {
  				throw new Error('TxClient:sendMsgCancelLimitOrder: Could not broadcast Tx: '+ e.message)
  			}
  		},

  		async sendMsgDeposit({ value, fee, memo }: sendMsgDepositParams): Promise<DeliverTxResponse> {
  			if (!signer) {
  					throw new Error('TxClient:sendMsgDeposit: Unable to sign Tx. Signer is not present.')
  			}
  			try {
  				const { address } = (await signer.getAccounts())[0];
  				const signingClient = await SigningStargateClient.connectWithSigner(addr,signer,{prefix, registry});
  				let msg = this.msgDeposit({ value: MsgDeposit.fromPartial(value) })
  				return await signingClient.signAndBroadcast(address, [msg], fee ? fee : defaultFee, memo)
  			} catch (e: any) {
  				throw new Error('TxClient:sendMsgDeposit: Could not broadcast Tx: '+ e.message)
  			}
  		},

  		async sendMsgPlaceLimitOrder({ value, fee, memo }: sendMsgPlaceLimitOrderParams): Promise<DeliverTxResponse> {
  			if (!signer) {
  					throw new Error('TxClient:sendMsgPlaceLimitOrder: Unable to sign Tx. Signer is not present.')
  			}
  			try {
  				const { address } = (await signer.getAccounts())[0];
  				const signingClient = await SigningStargateClient.connectWithSigner(addr,signer,{prefix, registry});
  				let msg = this.msgPlaceLimitOrder({ value: MsgPlaceLimitOrder.fromPartial(value) })
  				return await signingClient.signAndBroadcast(address, [msg], fee ? fee : defaultFee, memo)
  			} catch (e: any) {
  				throw new Error('TxClient:sendMsgPlaceLimitOrder: Could not broadcast Tx: '+ e.message)
  			}
  		},

  		async sendMsgSwap({ value, fee, memo }: sendMsgSwapParams): Promise<DeliverTxResponse> {
  			if (!signer) {
  					throw new Error('TxClient:sendMsgSwap: Unable to sign Tx. Signer is not present.')
  			}
  			try {
  				const { address } = (await signer.getAccounts())[0];
  				const signingClient = await SigningStargateClient.connectWithSigner(addr,signer,{prefix, registry});
  				let msg = this.msgSwap({ value: MsgSwap.fromPartial(value) })
  				return await signingClient.signAndBroadcast(address, [msg], fee ? fee : defaultFee, memo)
  			} catch (e: any) {
  				throw new Error('TxClient:sendMsgSwap: Could not broadcast Tx: '+ e.message)
  			}
  		},

  		async sendMsgWithdrawFilledLimitOrder({ value, fee, memo }: sendMsgWithdrawFilledLimitOrderParams): Promise<DeliverTxResponse> {
  			if (!signer) {
  					throw new Error('TxClient:sendMsgWithdrawFilledLimitOrder: Unable to sign Tx. Signer is not present.')
  			}
  			try {
  				const { address } = (await signer.getAccounts())[0];
  				const signingClient = await SigningStargateClient.connectWithSigner(addr,signer,{prefix, registry});
  				let msg = this.msgWithdrawFilledLimitOrder({ value: MsgWithdrawFilledLimitOrder.fromPartial(value) })
  				return await signingClient.signAndBroadcast(address, [msg], fee ? fee : defaultFee, memo)
  			} catch (e: any) {
  				throw new Error('TxClient:sendMsgWithdrawFilledLimitOrder: Could not broadcast Tx: '+ e.message)
  			}
  		},

  		async sendMsgWithdrawl({ value, fee, memo }: sendMsgWithdrawlParams): Promise<DeliverTxResponse> {
  			if (!signer) {
  					throw new Error('TxClient:sendMsgWithdrawl: Unable to sign Tx. Signer is not present.')
  			}
  			try {
  				const { address } = (await signer.getAccounts())[0];
  				const signingClient = await SigningStargateClient.connectWithSigner(addr,signer,{prefix, registry});
  				let msg = this.msgWithdrawl({ value: MsgWithdrawl.fromPartial(value) })
  				return await signingClient.signAndBroadcast(address, [msg], fee ? fee : defaultFee, memo)
  			} catch (e: any) {
  				throw new Error('TxClient:sendMsgWithdrawl: Could not broadcast Tx: '+ e.message)
  			}
  		}

  	}
};
export const queryClient = ({ addr: addr }: QueryClientOptions = { addr: "http://localhost:1317" }) => {
  return new Api({ baseURL: addr });
};

class SDKModule {
	public query: ReturnType<typeof queryClient>;
	public tx!: ReturnType<typeof txClient>;
	
	public registry: Array<[string, GeneratedType]> = [];

	constructor(client: IgniteClient) {		
	
		this.query = queryClient({ addr: client.env.apiURL });		
		this.updateTX(client);
		client.on('signer-changed',(signer: any) => {			
		 this.updateTX(client);
		})
	}
	updateTX(client: IgniteClient) {
    const methods = txClient({

            addr: client.env.rpcURL,
            prefix: client.env.prefix ?? "cosmos",
            signer: client.signer
        })
	
    this.tx = methods;
    for (let m in methods) {
        // @ts-ignore:next-line
        this.tx[m] = methods[m].bind(this.tx);
    }
	}
}

;
const Module = (test: IgniteClient) => {
	return {

    		module: {

            			NicholasdotsolDualityDex: new SDKModule(test)
            		},
    		registry: msgTypes
      }
}
export { MsgCancelLimitOrder, MsgDeposit, MsgPlaceLimitOrder, MsgSwap, MsgWithdrawFilledLimitOrder, MsgWithdrawl }
export default Module;