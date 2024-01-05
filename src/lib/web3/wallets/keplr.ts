import invariant from 'invariant';

import { useEffect } from 'react';
import { AccountData, OfflineSigner } from '@cosmjs/proto-signing';
import { ChainInfo, Keplr, Window as KeplrWindow } from '@keplr-wallet/types';
import { chainRegistryChainToKeplr } from '@chain-registry/keplr';
import { dualityChain, providerChain } from '../hooks/useChains';
import { devAssets, dualityAssets, providerAssets } from '../hooks/useTokens';
import { AssetList } from '@chain-registry/types';

const { REACT_APP__CHAIN_ID: chainId = '' } = import.meta.env;

const chainInfo: ChainInfo = chainRegistryChainToKeplr(
  dualityChain,
  [devAssets, dualityAssets].filter((list): list is AssetList => !!list)
);

declare global {
  interface Window extends KeplrWindow {
    keplr: Keplr;
  }
}

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
type KeplrWallet = OfflineSigner;
type KeplrWalletAccount = AccountData;

export async function getKeplrDualityWallet(): Promise<
  KeplrWallet | undefined
> {
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

export async function getKeplrWallet(
  chainId: string
): Promise<KeplrWallet | undefined> {
  try {
    invariant(chainId, `Invalid chain id: ${chainId}`);
    const keplr = await getKeplr();
    invariant(keplr, 'Keplr extension is not installed or enabled');
    const offlineSigner = keplr.getOfflineSigner(chainId);
    invariant(offlineSigner, 'Keplr wallet is not set');
    return offlineSigner;
  } catch {
    // silently ignore errors
    // invocations should handle the possibly undefined result
  }
}

export async function getKeplrWalletAccount(
  wallet: KeplrWallet | undefined
): Promise<KeplrWalletAccount | undefined> {
  const [account] = (await wallet?.getAccounts()) || [];
  return account;
}

export function useSyncKeplrState(
  connectWallet: (walletType: string) => void,
  syncActive: boolean
) {
  // sync Keplr wallet on state changes
  useEffect(() => {
    if (syncActive) {
      const syncKeplrWallet = () => connectWallet('keplr');
      window.addEventListener('keplr_keystorechange', syncKeplrWallet);
      return () => {
        window.removeEventListener('keplr_keystorechange', syncKeplrWallet);
      };
    }
  }, [connectWallet, syncActive]);
}

export async function getChainInfo(chainId: string) {
  invariant(chainId, `Invalid chain id: ${chainId}`);
  const keplr = await getKeplr();
  invariant(keplr, 'Keplr extension is not installed or enabled');
  if (providerAssets && providerChain && providerChain.chain_id === chainId) {
    // add auth popup for potentially not registered provider chain
    await keplr.experimentalSuggestChain(
      chainRegistryChainToKeplr(providerChain, [providerAssets])
    );
  }
  // this action causes an auth window to popup to the user if they have not yet
  // given permission for this app to read this chain
  return await keplr.getKey(chainId);
}
