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

const chainId = REACT_APP__CHAIN_ID || '';
const chainName = REACT_APP__CHAIN_NAME || '';
const rpcEndpoint = REACT_APP__RPC_API || '';
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
export async function getKeplrWallet(): Promise<KeplrWallet | undefined> {
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
export async function getKeplrWalletAccount(
  wallet: KeplrWallet
): Promise<KeplrWalletAccount | undefined> {
  const [account] = (await wallet?.getAccounts()) || [];
  return account;
}
