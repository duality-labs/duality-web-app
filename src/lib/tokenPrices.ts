import useSWR from 'swr';
import { useEffect, useMemo } from 'react';

import { ObservableList, useObservableList } from './utils/observableList';
import { Token } from './web3/utils/tokens';

const { REACT_APP__DEV_ASSET_PRICE_MAP } = import.meta.env;

const baseAPI = 'https://api.coingecko.com/api/v3';

// identify dev tokens using a specific dev chain id
function isDevToken(token?: Token): boolean {
  return !!(token && devTokenPriceMap[token.symbol]);
}

const devTokenPriceMap: Record<string, number> = (() => {
  try {
    return JSON.parse(REACT_APP__DEV_ASSET_PRICE_MAP || '{}');
  } catch {
    return {};
  }
})();

function getDevTokenPrice(token: Token | undefined): number | undefined {
  return token ? devTokenPriceMap[token.symbol] : undefined;
}

class FetchError extends Error {
  info?: object;
  status?: number;
}

async function fetcher(url: string) {
  const res = await fetch(`${baseAPI}${url}`, {
    headers: {
      accept: 'application/json',
    },
  });

  // If the status code is not in the range 200-299,
  // we still try to parse and throw it.
  if (!res.ok) {
    const error = new FetchError(
      `Price API error (${res.status || 0}): ${res.statusText || '(no text)'}`
    );
    // Attach extra info to the error object.
    error.info = await res.json().catch(() => undefined);
    error.status = res.status || 0;
    throw error;
  }

  return res.json();
}

interface CoinGeckoSimplePrice {
  [tokenID: string]: {
    [currencyID: string]: number;
  };
}

const currentRequests = new ObservableList<TokenRequests>();

// single request, eg: ATOM/USD
type TokenRequest = [tokenID: string, currencyID: string];

// component requests, eg: [ATOM/USD, ETH/USD]
type TokenRequests = Array<TokenRequest>; // eg. [ATOM/USD, ETH/USD]

function useCombinedSimplePrices(
  tokenIDs: (string | undefined)[],
  currencyID: string
) {
  const tokenIDsString = tokenIDs.filter(Boolean).join(',');
  const [
    allTokenRequests,
    { add: addTokenRequest, remove: removeTokenRequest },
  ] = useObservableList<TokenRequests>(currentRequests);

  // synchronize hook with global state
  useEffect(() => {
    // set callback to update local state
    if (tokenIDsString && currencyID) {
      // define this components requests
      const requests: TokenRequests = tokenIDsString
        .split(',')
        .map((tokenID) => {
          return [tokenID, currencyID];
        });
      // add requests
      addTokenRequest(requests);
      return () => {
        // remove old requests
        removeTokenRequest(requests);
      };
    }
  }, [tokenIDsString, currencyID, addTokenRequest, removeTokenRequest]);

  // get all current unique request IDs
  const allTokenIDs = allTokenRequests.reduce(
    (result, currentTokenRequest) => {
      currentTokenRequest.forEach(([tokenID, currencyID]) => {
        result.tokenIDs.add(tokenID);
        result.currencyIDs.add(currencyID);
      });
      return result;
    },
    { tokenIDs: new Set(), currencyIDs: new Set() }
  );
  // consdense out ID values into array strings
  const allTokenIDsString = Array.from(allTokenIDs.tokenIDs.values()).join(',');
  const allCurrencyIDsString = Array.from(
    allTokenIDs.currencyIDs.values()
  ).join(',');

  // create query with all current combinations
  return useSWR<CoinGeckoSimplePrice, FetchError>(
    allTokenIDsString.length && allCurrencyIDsString.length > 0
      ? `/simple/price?ids=${allTokenIDsString}&vs_currencies=${allCurrencyIDsString}`
      : null,
    fetcher,
    {
      // refresh and refetch infrequently to stay below API limits
      refreshInterval: 30000,
      dedupingInterval: 30000,
      focusThrottleInterval: 30000,
      errorRetryInterval: 30000,
    }
  );
}

const warned = new Set();
export function useSimplePrices(
  tokens: (Token | undefined)[],
  currencyID = 'usd'
) {
  const tokenIDs = tokens.map((token) => {
    // note Coin Gecko ID warning for developers
    if (token && !token.coingecko_id) {
      const tokenID = `${token?.base}:${token?.chain.chain_name}`;
      if (!warned.has(tokenID) && !isDevToken(token)) {
        // eslint-disable-next-line no-console
        console.warn(
          `Token ${token.name} (${token.symbol}) has no CoinGecko ID`
        );
        warned.add(tokenID);
      }
    }
    return token?.coingecko_id;
  });

  return useCombinedSimplePrices(tokenIDs, currencyID);
}

export function useSimplePrice(
  token: Token | undefined,
  currencyID?: string
): {
  data: number | undefined;
  error: FetchError | undefined;
  isValidating: boolean;
};
export function useSimplePrice(
  tokens: (Token | undefined)[],
  currencyID?: string
): {
  data: (number | undefined)[];
  error: FetchError | undefined;
  isValidating: boolean;
};
export function useSimplePrice(
  tokenOrTokens: (Token | undefined) | (Token | undefined)[],
  currencyID = 'usd'
) {
  const tokens = useMemo(() => {
    return Array.isArray(tokenOrTokens) ? tokenOrTokens : [tokenOrTokens];
  }, [tokenOrTokens]);

  const { data, error, isValidating } = useSimplePrices(tokens, currencyID);

  // cache the found result array so it doesn't generate updates if the values are equal
  const cachedResults = useMemo(() => {
    // return found results as numbers
    return tokens.map((token) =>
      token?.coingecko_id
        ? // if the information is fetchable, return fetched (number) or not yet fetched (undefined)
          (data?.[token.coingecko_id]?.[currencyID] as number | undefined)
        : // if the information is not fetchable, return a dev token price or 0 (unpriced)
          getDevTokenPrice(token) || 0
    );
  }, [tokens, data, currencyID]);

  return {
    // return array of results or singular result depending on how it was asked
    data: Array.isArray(tokenOrTokens) ? cachedResults : cachedResults[0],
    error,
    isValidating,
  };
}

export function usePairPrice(
  tokenA: Token | undefined,
  tokenB: Token | undefined,
  currencyID?: string
) {
  const tokenAResponse = useSimplePrice(tokenA, currencyID);
  const tokenBResponse = useSimplePrice(tokenB, currencyID);
  const { data: tokenAPrice } = tokenAResponse;
  const { data: tokenBPrice } = tokenBResponse;
  const price =
    tokenAPrice !== undefined && tokenBPrice !== undefined
      ? tokenBPrice / tokenAPrice
      : undefined;
  return {
    data: price,
    isValidating: tokenAResponse.isValidating || tokenBResponse.isValidating,
    error: tokenAResponse.error || tokenBResponse.error,
  };
}

export function useHasPriceData(
  tokens: (Token | undefined)[],
  currencyID = 'usd'
) {
  const { data, isValidating } = useSimplePrice(tokens, currencyID);
  // do not claim price data if tokens won't use any CoinGecko lookups
  if (tokens.every((token) => !!token?.coingecko_id)) {
    return false;
  }
  return isValidating || data.some(Boolean);
}
