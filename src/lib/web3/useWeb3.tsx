import * as React from 'react';
import invariant from 'invariant';

import { OfflineSigner } from '@cosmjs/proto-signing';
import { ChainInfo, Keplr, Window as KeplrWindow } from '@keplr-wallet/types';

export type Provider = Keplr;

const {
  REACT_APP__CHAIN_ID,
  REACT_APP__CHAIN_NAME,
  REACT_APP__RPC_API,
  REACT_APP__REST_API,
  REACT_APP__BECH_PREFIX,
} = process.env;

export const chainId = REACT_APP__CHAIN_ID || '';
const chainName = REACT_APP__CHAIN_NAME || '';
export const rpcEndpoint = REACT_APP__RPC_API || '';
const restEndpoint = REACT_APP__REST_API || '';
const bech32Prefix = REACT_APP__BECH_PREFIX || 'cosmos';

const token = {
  coinDenom: 'TOKEN',
  coinMinimalDenom: 'token',
  coinDecimals: 18,
};
const stake = {
  coinDenom: 'STAKE',
  coinMinimalDenom: 'stake',
  coinDecimals: 18,
};

const chainInfo: ChainInfo = {
  chainId,
  chainName,
  rpc: rpcEndpoint,
  rest: restEndpoint,
  currencies: [token, stake],
  stakeCurrency: stake,
  feeCurrencies: [token],
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

declare global {
  interface Window extends KeplrWindow {
    keplr: Provider;
  }
}

export interface Web3ContextValue {
  connectWallet?: () => void;
  wallet: OfflineSigner | null;
  address: string | null;
}

const Web3Context = React.createContext<Web3ContextValue>({
  wallet: null,
  address: null,
});

interface Web3ContextProps {
  children: React.ReactNode;
}

const LOCAL_STORAGE_WALLET_CONNECTED_KEY = 'duality.web3.walletConnected';

export function Web3Provider({ children }: Web3ContextProps) {
  const [address, setAddress] = React.useState<string | null>(null);
  const [wallet, setWallet] = React.useState<OfflineSigner | null>(null);

  async function connectWallet() {
    invariant(chainId, `Invalid chain id: ${chainId}`);
    const keplr = window.keplr;
    invariant(keplr, 'Keplr extension is not installed or enabled');
    await keplr.experimentalSuggestChain(chainInfo);
    await keplr.enable(chainId);
    const offlineSigner = keplr.getOfflineSigner(chainId);
    const accounts = await offlineSigner.getAccounts();
    const address = accounts[0].address;
    setAddress(address);
    // set wallet if address is knowable
    setWallet(address ? offlineSigner : null);

    localStorage.setItem(LOCAL_STORAGE_WALLET_CONNECTED_KEY, 'true');
  }

  React.useEffect(() => {
    async function run() {
      if (window.keplr && window.getOfflineSigner) {
        if (localStorage.getItem(LOCAL_STORAGE_WALLET_CONNECTED_KEY)) {
          try {
            await connectWallet();
          } catch {
            // can happen when the user manually disconnected the app and then rejects the connect dialog
            // silently ignore
          }
        }
        // add listener for Keplr state changes
        window.addEventListener('keplr_keystorechange', async () => {
          const offlineSigner = window.keplr.getOfflineSigner(chainId);
          const accounts = await offlineSigner?.getAccounts();
          setAddress((address) => {
            // switch address or remove if already connected
            if (address) {
              return accounts[0]?.address || null;
            }
            return null;
          });
        });
      }
    }
    run();
  }, []);

  return (
    <Web3Context.Provider
      value={{
        connectWallet,
        wallet,
        address,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  return React.useContext(Web3Context);
}
