/* eslint-disable */
/* tslint:disable */
// Generated by Ignite ignite.com/cli

import { StdFee } from "@cosmjs/launchpad";
import { EncodeObject, GeneratedType, OfflineSigner, Registry } from "@cosmjs/proto-signing";
import { DeliverTxResponse, SigningStargateClient } from "@cosmjs/stargate";
import { IgniteClient } from "../client";
import { msgTypes } from './registry';
import { Api } from "./rest";
import { MsgMultiSend, MsgSend } from "./types/cosmos/bank/v1beta1/tx";
type msgMultiSendParams = {
  value: MsgMultiSend,
};
type msgSendParams = {
  value: MsgSend,
};
type sendMsgMultiSendParams = {
  value: MsgMultiSend,
  fee?: StdFee,
  memo?: string
};
type sendMsgSendParams = {
  value: MsgSend,
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

  		msgMultiSend({ value }: msgMultiSendParams): EncodeObject {
  			try {
  				return { typeUrl: "/cosmos.bank.v1beta1.MsgMultiSend", value: MsgMultiSend.fromPartial( value ) }
  			} catch (e: any) {
  				throw new Error('TxClient:MsgMultiSend: Could not create message: ' + e.message)
  			}
  		},

  		msgSend({ value }: msgSendParams): EncodeObject {
  			try {
  				return { typeUrl: "/cosmos.bank.v1beta1.MsgSend", value: MsgSend.fromPartial( value ) }
  			} catch (e: any) {
  				throw new Error('TxClient:MsgSend: Could not create message: ' + e.message)
  			}
  		},

  		async sendMsgMultiSend({ value, fee, memo }: sendMsgMultiSendParams): Promise<DeliverTxResponse> {
  			if (!signer) {
  					throw new Error('TxClient:sendMsgMultiSend: Unable to sign Tx. Signer is not present.')
  			}
  			try {
  				const { address } = (await signer.getAccounts())[0];
  				const signingClient = await SigningStargateClient.connectWithSigner(addr,signer,{prefix, registry});
  				let msg = this.msgMultiSend({ value: MsgMultiSend.fromPartial(value) })
  				return await signingClient.signAndBroadcast(address, [msg], fee ? fee : defaultFee, memo)
  			} catch (e: any) {
  				throw new Error('TxClient:sendMsgMultiSend: Could not broadcast Tx: '+ e.message)
  			}
  		},

  		async sendMsgSend({ value, fee, memo }: sendMsgSendParams): Promise<DeliverTxResponse> {
  			if (!signer) {
  					throw new Error('TxClient:sendMsgSend: Unable to sign Tx. Signer is not present.')
  			}
  			try {
  				const { address } = (await signer.getAccounts())[0];
  				const signingClient = await SigningStargateClient.connectWithSigner(addr,signer,{prefix, registry});
  				let msg = this.msgSend({ value: MsgSend.fromPartial(value) })
  				return await signingClient.signAndBroadcast(address, [msg], fee ? fee : defaultFee, memo)
  			} catch (e: any) {
  				throw new Error('TxClient:sendMsgSend: Could not broadcast Tx: '+ e.message)
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
        // @ts-expect-error:next-line
        this.tx[m] = methods[m].bind(this.tx);
    }
	}
}

;
const Module = (test: IgniteClient) => {
	return {

    		module: {

            			CosmosBankV1Beta1: new SDKModule(test)
            		},
    		registry: msgTypes
      }
}
export { MsgMultiSend, MsgSend }
export default Module;