import useSWR from 'swr';
import { useEffect, useMemo, useState } from 'react';

import { Token } from '../components/TokenPicker/hooks';

const { REACT_APP__DEV_TOKEN_DENOMS } = process.env;

const baseAPI = 'https://api.coingecko.com/api/v3';

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

class ObservableArray<T> {
  private _array: Array<T> = [];
  private _listeners: Array<(array: Array<T>) => void> = [];
  get() {
    return this._array;
  }
  add(item: T) {
    this._array.push(item);
    this._listeners.forEach((listener) => listener(this.get()));
  }
  remove(item: T) {
    const itemIndex = this._array.indexOf(item);
    if (itemIndex >= 0) {
      this._array.splice(itemIndex, 1);
      this._listeners.forEach((listener) => listener(this.get()));
    }
  }
  subscribe(onChangeCallback: (array: Array<T>) => void) {
    this._listeners.push(onChangeCallback);
  }
  unsubscribe(onChangeCallback: (array: Array<T>) => void) {
    const onChangeCallbackIndex = this._listeners.indexOf(onChangeCallback);
    if (onChangeCallbackIndex >= 0) {
      this._listeners.splice(onChangeCallbackIndex, 1);
    }
  }
}

const currentRequests = new ObservableArray<TokenRequests>();

// single request, eg: ATOM/USD
type TokenRequest = [tokenID: string, currencyID: string];

// component requests, eg: [ATOM/USD, ETH/USD]
type TokenRequests = Array<TokenRequest>; // eg. [ATOM/USD, ETH/USD]

function useCombinedSimplePrices(
  tokenIDs: (string | undefined)[],
  currencyID: string
) {
  const tokenIDsString = tokenIDs.filter(Boolean).join(',');
  const [allTokenRequests, setAllTokenRequests] = useState(() =>
    currentRequests.get()
  );

  // synchronize hook with global state
  useEffect(() => {
    // set callback to update local state
    const updateRequests = (requests: Array<TokenRequests>) =>
      setAllTokenRequests(requests);
    if (tokenIDsString && currencyID) {
      // define this components requests
      const requests: TokenRequests = tokenIDsString
        .split(',')
        .map((tokenID) => {
          return [tokenID, currencyID];
        });
      // add requests
      currentRequests.subscribe(updateRequests);
      currentRequests.add(requests);
      return () => {
        // remove old requests
        currentRequests.remove(requests);
        currentRequests.unsubscribe(updateRequests);
      };
    }
  }, [tokenIDsString, currencyID]);

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
      refreshInterval: 10000,
      dedupingInterval: 10000,
      focusThrottleInterval: 10000,
      errorRetryInterval: 10000,
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
      if (!warned.has(tokenID)) {
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
    return tokens.map(
      (token) => data?.[token?.coingecko_id ?? '']?.[currencyID]
    );
  }, [tokens, data, currencyID]);

  return {
    // return array of results or singular result depending on how it was asked
    data:
      useDevTokenPrices(tokenOrTokens) ||
      (Array.isArray(tokenOrTokens) ? cachedResults : cachedResults[0]),
    error,
    isValidating,
  };
}

// add dev logic for assuming dev tokens TKN and STK are worth ~USD1
function useDevTokenPrices(
  tokenOrTokens: (Token | undefined) | (Token | undefined)[]
) {
  const tokens = Array.isArray(tokenOrTokens) ? tokenOrTokens : [tokenOrTokens];
  // declare dev tokens for each environment
  try {
    const devTokens = JSON.parse(
      REACT_APP__DEV_TOKEN_DENOMS || '[]'
    ) as string[];
    if (tokens.every((token) => token && devTokens.includes(token.base))) {
      return Array.isArray(tokenOrTokens) ? tokens.map(() => 1) : 1;
    }
  } catch {
    return Array.isArray(tokenOrTokens) ? tokens.map(() => 1) : 1;
  }
}

export function useHasPriceData(
  tokens: (Token | undefined)[],
  currencyID = 'usd'
) {
  const { data, isValidating } = useSimplePrice(tokens, currencyID);
  return isValidating || data.some(Boolean);
}
