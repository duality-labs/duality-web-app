import { useMemo } from 'react';
import { assets, chains } from 'chain-registry';
import { Chain } from '@chain-registry/types';
import { Token } from '../utils/tokens';

import tknLogo from '../../../assets/tokens/TKN.svg';
import stkLogo from '../../../assets/tokens/STK.svg';

const {
  REACT_APP__CHAIN_NAME = '[chain_name]',
  REACT_APP__CHAIN_ID = '[chain_id]',
} = process.env;

interface AddressableToken extends Token {
  address: string; // only accept routeable tokens in lists
}

type TokenList = Array<Token>;

const dualityChain = {
  chain_name: REACT_APP__CHAIN_NAME,
  status: 'upcoming',
  network_type: 'testnet',
  pretty_name: 'Duality Chain',
  chain_id: REACT_APP__CHAIN_ID,
  bech32_prefix: 'cosmos',
  slip44: 330,
};

const dualityMainToken: Token = {
  description: 'SDK default token',
  address: 'token',
  denom_units: [
    {
      denom: 'token',
      exponent: 0,
      aliases: [],
    },
    {
      denom: 'tkn',
      exponent: 18,
      aliases: ['duality', 'TOKEN'],
    },
  ],
  base: 'sdk.coin:token',
  name: 'Duality',
  display: 'tkn',
  symbol: 'TKN',
  logo_URIs: {
    svg: tknLogo,
  },
  chain: dualityChain,
};

const dualityStakeToken: Token = {
  description: 'SDK default token',
  address: 'stake',
  denom_units: [
    {
      denom: 'stake',
      exponent: 0,
      aliases: [],
    },
    {
      denom: 'stk',
      exponent: 18,
      aliases: ['duality-stake', 'STAKE'],
    },
  ],
  base: 'sdk.coin:stake',
  name: 'Duality Stake',
  display: 'stk',
  symbol: 'STK',
  logo_URIs: {
    svg: stkLogo,
  },
  chain: dualityChain,
};

// transform AssetList into TokenList
// for easier filtering/ordering by token attributes
function getTokens(condition: (chain: Chain) => boolean) {
  // go through each chain
  return (
    assets
      .reduce<TokenList>((result, { chain_name, assets }) => {
        // add each asset with the parent chain details
        const chain = chains.find((chain) => chain.chain_name === chain_name);
        return chain && condition(chain)
          ? result.concat(assets.map((asset) => ({ ...asset, chain })))
          : result;
      }, [])
      // add Duality chain tokens
      .concat([dualityMainToken, dualityStakeToken])
  );
}

export const addressableTokenMap = getTokens(Boolean).reduce<{
  [tickAddress: string]: AddressableToken;
}>((result, asset) => {
  if (asset.address) {
    result[asset.address] = asset as AddressableToken;
  }
  return result;
}, {});

const tokenListCache: {
  [key: string]: TokenList;
} = {};

const allTokens = () => true;
export default function useTokens(sortFunction = defaultSort) {
  tokenListCache['allTokens'] =
    tokenListCache['allTokens'] || getTokens(allTokens);
  return useMemo(
    () => tokenListCache['allTokens'].slice().sort(sortFunction),
    [sortFunction]
  );
}

const mainnetTokens = (chain: Chain) => chain?.network_type === 'mainnet';
export function useMainnetTokens(sortFunction = defaultSort) {
  tokenListCache['mainnetTokens'] =
    tokenListCache['mainnetTokens'] || getTokens(mainnetTokens);
  return useMemo(
    () => tokenListCache['mainnetTokens'].slice().sort(sortFunction),
    [sortFunction]
  );
}

const dualityTokens = (chain: Chain) => chain?.chain_id === 'duality';
export function useDualityTokens(sortFunction = defaultSort) {
  tokenListCache['dualityTokens'] =
    tokenListCache['dualityTokens'] || getTokens(dualityTokens);
  return useMemo(
    () => tokenListCache['dualityTokens'].slice().sort(sortFunction).reverse(),
    [sortFunction]
  );
}

function defaultSort(a: Token, b: Token) {
  // compare by symbol name
  return a.symbol.localeCompare(b.symbol);
}
