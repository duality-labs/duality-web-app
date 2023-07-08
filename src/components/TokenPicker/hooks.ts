import { useMemo } from 'react';
import { Chain } from '@chain-registry/types';
import { Token } from '../../lib/web3/utils/tokens';

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
