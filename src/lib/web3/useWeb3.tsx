import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import invariant from 'invariant';

import { OfflineSigner } from '@cosmjs/proto-signing';
import { ChainInfo, Keplr, Window as KeplrWindow } from '@keplr-wallet/types';

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
    keplr: Keplr;
  }
}

export interface Web3ContextValue {
  connectWallet?: () => void;
  wallet: OfflineSigner | null;
  address: string | null;
}

const Web3Context = createContext<Web3ContextValue>({
  wallet: null,
  address: null,
});

interface Web3ContextProps {
  children: ReactNode;
}

const LOCAL_STORAGE_WALLET_CONNECTED_KEY = 'duality.web3.walletConnected';

type SupportedWallet = 'keplr';

// the get Keplr function as provided in Keplr docs: https://docs.keplr.app/api
// it will return the Kelpr global on JS load or on page ready
async function getKeplr(): Promise<Keplr | undefined> {
  if (window.keplr) {
    return window.keplr;
  }

  if (document.readyState === 'complete') {
    return window.keplr;
  }

  return new Promise((resolve) => {
    const documentStateChange = (event: Event) => {
      if (
        event.target &&
        (event.target as Document).readyState === 'complete'
      ) {
        resolve(window.keplr);
        document.removeEventListener('readystatechange', documentStateChange);
      }
    };

    document.addEventListener('readystatechange', documentStateChange);
  });
}

// get Keplr objects
type KeplrWallet = ReturnType<Keplr['getOfflineSigner']>;
type KeplrWalletAccount = Awaited<ReturnType<OfflineSigner['getAccounts']>>[0];
async function getKeplrWallet(): Promise<KeplrWallet | undefined> {
  try {
    invariant(chainId, `Invalid chain id: ${chainId}`);
    const keplr = await getKeplr();
    invariant(keplr, 'Keplr extension is not installed or enabled');
    await keplr.experimentalSuggestChain(chainInfo);
    await keplr.enable(chainId);
    const offlineSigner = keplr.getOfflineSigner(chainId);
    invariant(offlineSigner, 'Keplr wallet is not set');
    return offlineSigner;
  } catch {
    // silently ignore errors
    // invocations should handle the possibly undefined result
  }
}
async function getKeplrWalletAccount(
  wallet: KeplrWallet
): Promise<KeplrWalletAccount | undefined> {
  const [account] = (await wallet?.getAccounts()) || [];
  return account;
}

export function Web3Provider({ children }: Web3ContextProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [wallet, setWallet] = useState<OfflineSigner | null>(null);

  // set callback to run when user opts in to connecting their wallet
  const connectWallet = useCallback(
    async (walletType: SupportedWallet | string = '') => {
      const [wallet, address] = await (async function (): Promise<
        [OfflineSigner?, string?]
      > {
        switch (walletType) {
          case 'keplr': {
            const wallet = await getKeplrWallet();
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
    []
  );

  // sync wallet to saved wallet type on load
  useEffect(() => {
    const walletType = localStorage.getItem(LOCAL_STORAGE_WALLET_CONNECTED_KEY);
    connectWallet(walletType || undefined);
  }, [connectWallet]);

  // sync Keplr wallet on state changes
  useEffect(() => {
    const syncKeplrWallet = () => connectWallet('keplr');
    const walletType = localStorage.getItem(LOCAL_STORAGE_WALLET_CONNECTED_KEY);
    if (walletType === 'keplr') {
      window.addEventListener('keplr_keystorechange', syncKeplrWallet);
      return () => {
        window.removeEventListener('keplr_keystorechange', syncKeplrWallet);
      };
    }
  }, [connectWallet]);

  return (
    <Web3Context.Provider
      value={{
        // only connect to Keplr wallets for now
        connectWallet: useCallback(
          async () => await connectWallet('keplr'),
          [connectWallet]
        ),
        wallet,
        address,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  return useContext(Web3Context);
}
