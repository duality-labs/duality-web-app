import { useMemo } from 'react';
import { Token } from '../../lib/web3/utils/tokens';

export interface TokenSearchContext {
  chain: string[];
  symbol: string[];
  token: Token;
}
export function useUniqueChainName(tokens: Token[], token: Token): string {
  // update the filtered list whenever the query or the list changes
  return useMemo(() => {
    const uniqueChainName = !tokens.find((listToken) => {
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
  }, [tokens, token]);
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

interface TokenPair {
  token0: Token;
  token1: Token;
}

export function useFilteredPairsList<T extends TokenPair>(
  pairsList: T[] | undefined,
  searchQuery: string
): Array<T> | undefined {
  const tokenList = useMemo(() => {
    const tokenSet = pairsList?.reduce((acc, { token0, token1 }) => {
      acc.add(token0);
      acc.add(token1);
      return acc;
    }, new Set<Token>());
    return tokenSet ? Array.from(tokenSet) : [];
  }, [pairsList]);
  const filteredPairTokenList = useFilteredTokenList(tokenList, searchQuery);
  return useMemo<Array<T> | undefined>(() => {
    return pairsList?.filter(({ token0, token1 }) => {
      return (
        filteredPairTokenList.includes(token0) ||
        filteredPairTokenList.includes(token1)
      );
    });
  }, [pairsList, filteredPairTokenList]);
}
