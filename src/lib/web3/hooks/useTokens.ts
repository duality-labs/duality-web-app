import BigNumber from 'bignumber.js';
import { useCallback, useMemo, useState } from 'react';
import {
  Token,
  getTokenId,
  getTokenValue,
  ibcDenomRegex,
} from '../utils/tokens';
import { useSimplePrice } from '../../tokenPrices';
import { chainFeeTokens } from './useChains';
import { useOneHopDenoms } from './useDenomsFromRegistry';
import {
  SWRCommon,
  TokenByDenom,
  useToken,
  useTokenByDenom,
} from './useDenomClients';

const { REACT_APP__CHAIN_ID = '' } = import.meta.env;

export function useChainFeeToken(): [
  Token | undefined,
  React.Dispatch<React.SetStateAction<string | undefined>>
] {
  const [feeDenom, setFeeDenom] = useState(() => chainFeeTokens.at(0)?.denom);
  const restrictedSetFeeDenom: React.Dispatch<
    React.SetStateAction<string | undefined>
  > = useCallback((feeDenomOrCallback) => {
    if (feeDenomOrCallback) {
      if (typeof feeDenomOrCallback === 'function') {
        setFeeDenom((prev) => getRestrictedFeeDenom(feeDenomOrCallback(prev)));
      } else {
        setFeeDenom(getRestrictedFeeDenom(feeDenomOrCallback));
      }
    }
    function getRestrictedFeeDenom(
      feeDenom: string | undefined
    ): string | undefined {
      return chainFeeTokens.find(({ denom }) => denom === feeDenom)?.denom;
    }
  }, []);
  const { data: feeToken } = useToken(feeDenom);
  return [feeToken, restrictedSetFeeDenom];
}

// allow matching by token symbol or IBC denom string (typically from a URL)
function matchTokenBySymbol(symbol: string | undefined) {
  // match nothing
  if (!symbol) {
    return () => false;
  }
  // match denom aliases for IBC tokens
  if (ibcDenomRegex.test(symbol)) {
    return (token: Token) => token.base === symbol;
  }
  // match regular symbols for "known" tokens
  return (token: Token) => token.symbol === symbol || token.base === symbol;
}

// find denoms within one-hop of native chain from URLs
export function useDenomFromPathParam(
  pathParam: string | undefined
): SWRCommon<string> {
  const { data: tokenByDenom, ...swr } = useTokenByDenom(useOneHopDenoms());
  const denom = useMemo(() => {
    const tokens = Array.from(tokenByDenom?.values() ?? []);
    // return denom of resolved token, or the passed param which may be a denom
    return tokens.find(matchTokenBySymbol(pathParam))?.base ?? pathParam;
  }, [tokenByDenom, pathParam]);
  return { ...swr, data: denom };
}

// return token identifier that can be used as a part of a URL
// (for later decoding by matchTokenBySymbol and useDenomFromPathParam)
function getTokenPathPart(
  // note: this token map should be consistent, and should be the one-hop map:
  //       `useTokenByDenom(useOneHopDenoms())`
  tokenByDenom: TokenByDenom | undefined,
  token: Token | undefined
) {
  return encodeURIComponent(
    (token && tokenByDenom?.get(token?.base)?.symbol) ?? token?.base ?? '-'
  );
}
export function useGetTokenPathPart() {
  const { data: tokenByDenom } = useTokenByDenom(useOneHopDenoms());
  return useCallback(
    (token: Token | undefined) => getTokenPathPart(tokenByDenom, token),
    [tokenByDenom]
  );
}
export function useTokenPathPart(token: Token | undefined) {
  const { data: tokenByDenom } = useTokenByDenom(useOneHopDenoms());
  return useMemo(
    () => getTokenPathPart(tokenByDenom, token),
    [tokenByDenom, token]
  );
}

export function matchToken(tokenSearch: Token) {
  const tokenId = getTokenId(tokenSearch);
  const tokenChainId = tokenSearch.chain.chain_id;
  if (tokenId && tokenChainId) {
    return (token: Token) => {
      return (
        // check for matching chain
        token.chain.chain_id === tokenChainId &&
        // match by identifying token symbols
        getTokenId(token) === tokenId
      );
    };
  }
  // match nothing
  return () => false;
}

export function matchTokens(tokenA: Token, tokenB: Token) {
  // check for matching chain
  if (tokenA.chain.chain_id === tokenB.chain.chain_id) {
    // match by ID / base (which should be native or IBC or other)
    const idA = getTokenId(tokenA);
    const idB = getTokenId(tokenB);
    return !!idA && !!idB && idA === idB;
  }
}
// utility functions to get a matching token from a list
export function matchTokenByDenom(denom: string) {
  if (denom) {
    // match IBC tokens
    if (denom.match(ibcDenomRegex)) {
      // the denom is an IBC token identifier, use available matching function
      return matchTokenBySymbol(denom);
    }
    // match native chain token denoms only
    else if (REACT_APP__CHAIN_ID) {
      return (token: Token) =>
        token.chain.chain_id === REACT_APP__CHAIN_ID &&
        !!token.denom_units.find((unit) => unit.denom === denom);
    }
  }
  // don't match empty string to anything
  return () => false;
}

// utility function to get value of token amount in USD
export function useTokenValue(
  token: Token,
  amount: BigNumber.Value
): number | null | undefined {
  return useTokenValueTotal([token, amount]);
}

// utility function to get value of token amounts in USD
export function useTokenValueTotal(
  ...tokenAmounts: Array<[token: Token, amount: BigNumber.Value]>
): number | null | undefined {
  const tokens = tokenAmounts.map(([token]) => token);
  const { data: prices, isValidating } = useSimplePrice(tokens);

  const values = tokenAmounts.map(([token, amount], index) => {
    const price = prices[index];
    return getTokenValue(token, amount, price);
  });

  // if any values are still resolving then return that we don't know the value
  if (isValidating && values.some((value) => value === undefined)) {
    return undefined;
  }

  // sum values if they are all found
  // (don't return a total value if only half the token amounts are present)
  if (values.every((value) => value !== undefined)) {
    return (values as number[]).reduce((acc, value) => acc + value, 0);
  }
  // else return an error state
  else {
    return null;
  }
}
