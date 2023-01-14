/* eslint-disable */
/* tslint:disable */
import { StdFee } from "@cosmjs/launchpad";
import {
    EncodeObject, GeneratedType,
    OfflineSigner, Registry
} from "@cosmjs/proto-signing";
import { SigningStargateClient } from "@cosmjs/stargate";
import { ChainInfo } from "@keplr-wallet/types";
import { EventEmitter } from "events";
import { Env } from "./env";
import { Constructor, Return, UnionToIntersection } from "./helpers";
import { Module } from "./modules";

const defaultFee = {

  amount: [],
  gas: "200000"
};

export class IgniteClient extends EventEmitter {
	static plugins: Module[] = [];
  env: Env;
  signer: OfflineSigner;
  registry: Array<[string, GeneratedType]> = [];
  static plugin<T extends Module | Module[]>(plugin: T) {
    const currentPlugins = this.plugins;

    class AugmentedClient extends this {
      static plugins = currentPlugins.concat(plugin);
    }

    if (Array.isArray(plugin)) {
      type Extension = UnionToIntersection<Return<T>['module']>
      return AugmentedClient as typeof AugmentedClient & Constructor<Extension>;  
    }

    type Extension = Return<T>['module']
    return AugmentedClient as typeof AugmentedClient & Constructor<Extension>;
  }

  async signAndBroadcast(msgs: EncodeObject[], fee: StdFee, memo: string) {
    if (this.signer) {
      const { address } = (await this.signer.getAccounts())[0];
      const signingClient = await SigningStargateClient.connectWithSigner(this.env.rpcURL, this.signer, { prefix: this.env.prefix, registry: new Registry(this.registry) });
      return await signingClient.signAndBroadcast(address, msgs, fee ? fee : defaultFee, memo)
    } else {
      throw new Error(" Signer is not present.");
    }
  }

  constructor(env: Env, signer: OfflineSigner) {
    super();
    this.env = env;
    this.setMaxListeners(0);
    this.signer = signer;
    const classConstructor = this.constructor as typeof IgniteClient;
    classConstructor.plugins.forEach(plugin => {
      const pluginInstance = plugin(this);
      Object.assign(this, pluginInstance.module)
      if (this.registry) {
        this.registry = this.registry.concat(pluginInstance.registry)
      }
		});		
  }
  async useSigner(signer: OfflineSigner) {    
      this.signer = signer;
      this.emit("signer-changed", this.signer);
  }
  }