import BigNumber from 'bignumber.js';
import { useCallback, useMemo, useState } from 'react';
import { Coin } from '@cosmjs/proto-signing';

import {
  Token,
  getTokenId,
  getTokenValue,
  ibcDenomRegex,
} from '../utils/tokens';
import { useSimplePrice } from '../../tokenPrices';
import { useNativeChain } from './useChains';
import { useOneHopDenoms } from './useDenomsFromRegistry';
import {
  SWRCommon,
  TokenByDenom,
  useToken,
  useTokenByDenom,
} from './useDenomClients';
import { useUserBankValues } from './useUserBankValues';

const { REACT_APP__CHAIN_ID = '' } = import.meta.env;

export function useChainFeeToken(): [
  Token | undefined,
  React.Dispatch<React.SetStateAction<string | undefined>>
] {
  const { data: nativeChain } = useNativeChain();
  const [feeDenom, setFeeDenom] = useState<string>();
  const restrictedSetFeeDenom: React.Dispatch<
    React.SetStateAction<string | undefined>
  > = useCallback(
    (feeDenomOrCallback) => {
      if (feeDenomOrCallback) {
        if (typeof feeDenomOrCallback === 'function') {
          setFeeDenom((prev) =>
            getRestrictedFeeDenom(feeDenomOrCallback(prev))
          );
        } else {
          setFeeDenom(getRestrictedFeeDenom(feeDenomOrCallback));
        }
      }
      function getRestrictedFeeDenom(
        feeDenom: string | undefined
      ): string | undefined {
        const chainFeeTokens = nativeChain?.fees?.fee_tokens;
        return chainFeeTokens?.find(({ denom }) => denom === feeDenom)?.denom;
      }
    },
    [nativeChain]
  );
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
    // exclude specific "empty" token denom string for URL parts
    if (pathParam === '-') {
      return undefined;
    }
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

type TokenCoin = Coin & {
  token: Token;
  value: BigNumber | undefined;
};

export function useTokensSortedByValue(tokenList: Token[]) {
  const allUserBankAssets = useUserBankValues();
  const allUserBankAssetsByTokenId = useMemo(() => {
    return allUserBankAssets.reduce<{ [symbol: string]: TokenCoin }>(
      (acc, asset) => {
        const symbol = getTokenId(asset.token);
        if (symbol) {
          acc[symbol] = asset;
        }
        return acc;
      },
      {}
    );
  }, [allUserBankAssets]);

  const { data: nativeChain } = useNativeChain();

  // define sorting rows by token value
  const sortByValue = useCallback(
    (tokenA: Token, tokenB: Token) => {
      const a = getTokenId(tokenA) || '';
      const b = getTokenId(tokenB) || '';
      // sort first by value
      return (
        getTokenValue(b).minus(getTokenValue(a)).toNumber() ||
        // if value is equal, sort by local chain
        getTokenChain(tokenB) - getTokenChain(tokenA) ||
        // if local chain is equal, sort by known chain
        getKnownChain(tokenB) - getKnownChain(tokenA) ||
        // if known chain is equal, sort by amount
        getTokenAmount(b).minus(getTokenAmount(a)).toNumber() ||
        // lastly sort by symbol
        tokenA.symbol.localeCompare(tokenB.symbol)
      );
      function getTokenValue(id: string) {
        const foundUserAsset = allUserBankAssetsByTokenId[id];
        return foundUserAsset?.value || new BigNumber(0);
      }
      function getTokenAmount(id: string) {
        const foundUserAsset = allUserBankAssetsByTokenId[id];
        return new BigNumber(foundUserAsset?.amount || 0);
      }
      function getTokenChain(token: Token) {
        if (nativeChain && token.chain.chain_id === nativeChain.chain_id) {
          return 2;
        }
        if (token.ibc) {
          return 1;
        }
        return 0;
      }
      function getKnownChain(token: Token) {
        if (token.chain.chain_id) {
          return 1;
        }
        return 0;
      }
    },
    [allUserBankAssetsByTokenId, nativeChain]
  );

  // sort tokens
  return useMemo(() => {
    // sort by USD value
    // create new array to ensure re-rendering with new reference
    return [...tokenList].sort(sortByValue);
  }, [tokenList, sortByValue]);
}
