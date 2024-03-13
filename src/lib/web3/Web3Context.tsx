import {
  ReactNode,
  createContext,
  useCallback,
  useEffect,
  useState,
} from 'react';

import { OfflineSigner } from '@cosmjs/proto-signing';
import {
  getKeplrDualityWallet,
  getKeplrWalletAccount,
  useSyncKeplrState,
} from './wallets/keplr';
import useAccountAddress from './hooks/useAccountAddress';
import { useNativeChain } from './hooks/useChains';

export interface Web3ContextValue {
  connectWallet?: () => void;
  wallet: OfflineSigner | null;
  address: string | null;
}

export const Web3Context = createContext<Web3ContextValue>({
  wallet: null,
  address: null,
});

interface Web3ContextProps {
  children: ReactNode;
}

const LOCAL_STORAGE_WALLET_CONNECTED_KEY = 'duality.web3.walletConnected';

type SupportedWallet = 'keplr';

export function Web3Provider({ children }: Web3ContextProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [wallet, setWallet] = useState<OfflineSigner | null>(null);

  const { data: nativeChain } = useNativeChain();

  // set callback to run when user opts in to connecting their wallet
  const connectWallet = useCallback(
    async (walletType: SupportedWallet | string = '') => {
      // skip if nativeChain isn't yet available
      if (!nativeChain) return;
      // get wallet and address of native chain
      const [wallet, address] = await (async function (): Promise<
        [OfflineSigner?, string?]
      > {
        switch (walletType) {
          case 'keplr': {
            const wallet = await getKeplrDualityWallet(nativeChain);
            const account = wallet && (await getKeplrWalletAccount(wallet));
            return [wallet, account?.address];
          }
          // if wallet type was not found then mark them as not found
          default: {
            return [];
          }
        }
      })();
      // set or unset wallet and address
      setWallet(wallet ?? null);
      setAddress(wallet ? address ?? null : null);
      // save new state
      if (walletType) {
        localStorage.setItem(LOCAL_STORAGE_WALLET_CONNECTED_KEY, walletType);
      } else {
        localStorage.removeItem(LOCAL_STORAGE_WALLET_CONNECTED_KEY);
      }
    },
    [nativeChain]
  );

  // sync wallet to saved wallet type on load
  useEffect(() => {
    const walletType = localStorage.getItem(LOCAL_STORAGE_WALLET_CONNECTED_KEY);
    connectWallet(walletType || undefined);
  }, [connectWallet]);

  // listen across tabs for wallet connection events through local storage
  useEffect(() => {
    function syncWallet(e: StorageEvent) {
      if (e.key === LOCAL_STORAGE_WALLET_CONNECTED_KEY) {
        connectWallet(e.newValue || undefined);
      }
    }
    window.addEventListener('storage', syncWallet);
    return () => window.removeEventListener('storage', syncWallet);
  }, [connectWallet]);

  // sync Keplr wallet on Keplr state changes
  useSyncKeplrState(
    connectWallet,
    localStorage.getItem(LOCAL_STORAGE_WALLET_CONNECTED_KEY) === 'keplr'
  );

  // add any other environment specific third-party hooks that use the address
  useAccountAddress(address);

  const connectKeplr = useCallback(
    async () => await connectWallet('keplr'),
    [connectWallet]
  );

  return (
    <Web3Context.Provider
      value={{
        // only connect to Keplr wallets for now
        connectWallet: nativeChain && connectKeplr,
        wallet,
        address,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}
