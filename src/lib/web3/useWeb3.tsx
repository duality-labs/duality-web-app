import * as React from 'react';
import invariant from 'invariant';

import { Registry } from '@cosmjs/proto-signing';
import {
  defaultRegistryTypes,
  GasPrice,
  SigningStargateClient,
} from '@cosmjs/stargate';
import { ChainInfo, Keplr, Window as KeplrWindow } from '@keplr-wallet/types';
import { MsgDepositShares } from './generated/duality/duality.duality/module/types/duality/tx';

export type Provider = Keplr;

const {
  REACT_APP__CHAIN_ID,
  REACT_APP__CHAIN_NAME,
  REACT_APP__RPC_API,
  REACT_APP__REST_API,
  REACT_APP__COIN_DENOM,
  REACT_APP__COIN_MIN_DENOM,
  REACT_APP__BECH_PREFIX,
} = process.env;

export const chainId = REACT_APP__CHAIN_ID || '';
const chainName = REACT_APP__CHAIN_NAME || '';
export const rpcEndpoint = REACT_APP__RPC_API || '';
const restEndpoint = REACT_APP__REST_API || '';
const coinDenom = REACT_APP__COIN_DENOM || '';
const coinMinimalDenom =
  REACT_APP__COIN_MIN_DENOM || `u${coinDenom.toLowerCase()}`;
const bech32Prefix = REACT_APP__BECH_PREFIX || coinDenom.toLowerCase();

export const currency = {
  coinDenom,
  coinMinimalDenom,
  coinDecimals: 6,
};

const chainInfo: ChainInfo = {
  chainId,
  chainName,
  rpc: rpcEndpoint,
  rest: restEndpoint,
  currencies: [currency],
  stakeCurrency: currency,
  feeCurrencies: [currency],
  bip44: {
    coinType: 118,
  },
  bech32Config: {
    bech32PrefixAccAddr: `${bech32Prefix}`,
    bech32PrefixAccPub: `${bech32Prefix}pub`,
    bech32PrefixValAddr: `${bech32Prefix}valoper`,
    bech32PrefixValPub: `${bech32Prefix}valoperpub`,
    bech32PrefixConsAddr: `${bech32Prefix}valcons`,
    bech32PrefixConsPub: `${bech32Prefix}valconspub`,
  },
};

const registry = new Registry(defaultRegistryTypes);

// add additional Msgs here
registry.register('/duality.duality.MsgDepositShares', MsgDepositShares);

declare global {
  interface Window extends KeplrWindow {
    keplr: Provider;
  }
}

export interface Web3ContextValue {
  provider: Provider | null;
  connectWallet: (() => void) | null;
  getSigningClient: (() => Promise<SigningStargateClient | null>) | null;
  address: string | null;
}

const Web3Context = React.createContext<Web3ContextValue>({
  provider: null,
  connectWallet: null,
  getSigningClient: null,
  address: null,
});

interface Web3ContextProps {
  children: React.ReactNode;
}

const LOCAL_STORAGE_WALLET_CONNECTED_KEY = 'duality.web3.walletConnected';

export function Web3Provider({ children }: Web3ContextProps) {
  const [provider, setProvider] = React.useState<Provider | null>(null);
  const [address, setAddress] = React.useState<string | null>(null);

  const connectWallet = async (keplr: Provider | null) => {
    invariant(chainId, `Invalid chain id: ${chainId}`);
    invariant(keplr, 'Keplr extension is not installed or enabled');
    await keplr.experimentalSuggestChain(chainInfo);
    await keplr.enable(chainId);
    const offlineSigner = keplr.getOfflineSigner(chainId);
    const accounts = await offlineSigner.getAccounts();
    const address = accounts[0].address;
    setAddress(address);

    localStorage.setItem(LOCAL_STORAGE_WALLET_CONNECTED_KEY, 'true');
  };

  React.useEffect(() => {
    async function run() {
      if (window.keplr && window.getOfflineSigner) {
        const provider = window.keplr;
        if (localStorage.getItem(LOCAL_STORAGE_WALLET_CONNECTED_KEY)) {
          try {
            await connectWallet(provider);
          } catch {
            // can happen when the user manually disconnected the app and then rejects the connect dialog
            // silently ignore
          }
        }
        setProvider(provider);
      }
    }
    run();
  }, []);

  return (
    <Web3Context.Provider
      value={{
        provider,
        connectWallet: () => connectWallet(provider),
        address,
        getSigningClient: async () => {
          const keplr = provider;
          if (keplr && chainId) {
            await keplr.enable(chainId);
            const offlineSigner = keplr.getOfflineSigner(chainId);
            return await SigningStargateClient.connectWithSigner(
              rpcEndpoint,
              offlineSigner,
              { registry, gasPrice: GasPrice.fromString('10token') }
            );
          }
          return null;
        },
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  return React.useContext(Web3Context);
}
