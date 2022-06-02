import * as React from 'react';
import invariant from 'invariant';

import { ethers } from 'ethers';

declare global {
  interface Window {
    ethereum: ethers.providers.ExternalProvider | undefined;
  }
}

interface Web3ContextValue {
  provider: ethers.providers.Web3Provider | null;
  // eslint-disable-next-line
  connectWallet: (() => any) | null;
  address: string | null;
}

const Web3Context = React.createContext<Web3ContextValue>({
  provider: null,
  connectWallet: null,
  address: null,
});

interface Web3ContextProps {
  children: React.ReactNode;
}

const LOCAL_STORAGE_WALLET_CONNECTED_KEY = 'duality.web3.walletConnected';

export function Web3Provider({ children }: Web3ContextProps) {
  const [provider, setProvider] =
    React.useState<ethers.providers.Web3Provider | null>(null);
  const [address, setAddress] = React.useState<string | null>(null);

  const connectWallet = async (
    provider: ethers.providers.Web3Provider | null
  ) => {
    invariant(provider, 'provider not set');
    await provider.send('eth_requestAccounts', []);
    const signerAddress = await provider.getSigner().getAddress();
    const address = ethers.utils.getAddress(signerAddress);
    setAddress(address);

    localStorage.setItem(LOCAL_STORAGE_WALLET_CONNECTED_KEY, 'true');
  };

  React.useEffect(() => {
    async function run() {
      if (window.ethereum) {
        const provider = new ethers.providers.Web3Provider(
          window.ethereum,
          'any'
        );
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
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  return React.useContext(Web3Context);
}
