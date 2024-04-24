import { useMemo } from 'react';
import { Token } from '../../lib/web3/utils/tokens';

export interface TokenSearchContext {
  chain: string[];
  symbol: string[];
  token: Token;
}
export function useTokenSearchContext(
  list: Token[],
  token: Token,
  regexQuery: RegExp | undefined
): TokenSearchContext {
  // update the filtered list whenever the query or the list changes
  return useMemo(
    function () {
      function getChainName(token: Token) {
        const uniqueChainName = !list.find((listToken) => {
          // check for matching name
          return (
            listToken.chain.pretty_name === token.chain.pretty_name &&
            // and check for not the same chain exactly
            listToken.chain.chain_id !== token.chain.chain_id
          );
        });
        return !uniqueChainName
          ? `${token.chain.pretty_name} (${token.chain.chain_name})`
          : token.chain.pretty_name;
      }

      const chainName = getChainName(token);
      return regexQuery
        ? // Split the symbol and name using the query (and include the query in the list)
          {
            chain: chainName?.split(regexQuery) || [''],
            symbol: token.symbol?.split(regexQuery) || [''],
            token,
          }
        : {
            chain: [chainName],
            symbol: [token.symbol],
            token,
          };
    },
    [list, regexQuery, token]
  );
}

export function useTokenSearchRegex(searchQuery?: string): RegExp | undefined {
  if (searchQuery) {
    // remove invalid characters + remove space limitations (but still match any found)
    const queryRegexText = searchQuery
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ') //condense spaces
      .replace(/^["']*(.*)["']*$/, '$1') // remove enclosing quotes
      .replace(/[^a-z0-9 ]/gi, (char) => `\\${char}`); // whitelist ok chars
    return new RegExp(`(${queryRegexText})`, 'i');
  }
}

export function useFilteredTokenList(
  list: Token[],
  searchQuery: string
): Token[] {
  const regexQuery = useTokenSearchRegex(searchQuery);

  // update the filtered list whenever the query or the list changes
  return useMemo(
    function () {
      // if the query is empty return the full list
      if (!regexQuery) {
        return list;
      }

      return list.filter((token) =>
        [
          token.symbol,
          token.name,
          token.base,
          token.display,
          token.chain.pretty_name,
          token.chain.chain_name,
        ].some((txt) => txt && regexQuery.test(txt))
      );
    },
    [list, regexQuery]
  );
}
