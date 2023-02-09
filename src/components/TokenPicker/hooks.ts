import { useMemo } from 'react';
import { assets, chains } from 'chain-registry';
import { Asset, Chain } from '@chain-registry/types';

import tknLogo from '../../assets/tokens/TKN.svg';
import stkLogo from '../../assets/tokens/STK.svg';

const {
  REACT_APP__CHAIN_NAME = '[chain_name]',
  REACT_APP__CHAIN_ID = '[chain_id]',
} = process.env;

// filter to only those with real address and chain
export interface Token extends Asset {
  chain: Chain;
}

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
export function useTokens(sortFunction = defaultSort) {
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

export function useFilteredTokenList(list: Token[], searchQuery: string) {
  // update the filtered list whenever the query or the list changes
  return useMemo(
    function () {
      const chainsByPrettyName = list.reduce((result, token) => {
        const name = token.chain.pretty_name;
        // use set to ensure unique chains
        const chains = result.get(name) || new Set<Chain>();
        if (!chains.has(token.chain)) {
          return result.set(token.chain.pretty_name, chains.add(token.chain));
        }
        return result;
      }, new Map<string, Set<Chain>>());

      function getChainName(token: Token) {
        const chains = chainsByPrettyName.get(token.chain.pretty_name);
        return (chains?.size || 0) > 1
          ? `${token.chain.pretty_name} (${token.chain.chain_name})`
          : token.chain.pretty_name;
      }

      // if the query is empty return the full list
      if (!searchQuery) {
        return list.map((token) => ({
          chain: [getChainName(token)],
          symbol: [token.symbol],
          token,
        }));
      }

      // remove invalid characters + remove space limitations (but still match any found)
      const queryRegexText = searchQuery
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ') //condense spaces
        .replace(/^["']*(.*)["']*$/, '$1') // remove enclosing quotes
        .replace(/[^a-z0-9 ]/gi, (char) => `\\${char}`); // whitelist ok chars
      const regexQuery = new RegExp(`(${queryRegexText})`, 'i');

      return list
        .filter((token) =>
          [
            token.symbol,
            token.name,
            token.address,
            token.chain.pretty_name,
            token.chain.chain_name,
          ].some((txt) => txt && regexQuery.test(txt))
        )
        .map(function (token) {
          // Split the symbol and name using the query (and include the query in the list)
          const symbolResult = token.symbol?.split(regexQuery) || [''];
          const chainName = getChainName(token);
          const nameResult = chainName?.split(regexQuery) || [''];
          return { chain: nameResult, symbol: symbolResult, token };
        });
    },
    [list, searchQuery]
  );
}
