import * as React from 'react';
import invariant from 'invariant';

import { SigningStargateClient } from '@cosmjs/stargate';
import { Window as KeplrWindow } from '@keplr-wallet/types';

const { REACT_APP__RPC_URL, REACT_APP__CHAIN_ID } = process.env;

const chainId = REACT_APP__CHAIN_ID || '';
const rpcEndpoint = REACT_APP__RPC_URL || '';

declare global {
  interface Window extends KeplrWindow {
    keplr: KeplrWindow['keplr'];
  }
}

interface Web3ContextValue {
  provider: KeplrWindow['keplr'] | null;
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
  const [provider, setProvider] = React.useState<KeplrWindow['keplr'] | null>(
    null
  );
  const [address, setAddress] = React.useState<string | null>(null);

  const connectWallet = async (keplr: KeplrWindow['keplr'] | null) => {
    invariant(chainId, `Invalid chain id: ${chainId}`);
    invariant(keplr, 'Keplr extension is not installed or enabled');
    await keplr.experimentalSuggestChain({});
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
              offlineSigner
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
