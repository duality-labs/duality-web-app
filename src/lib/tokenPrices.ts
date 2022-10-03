import useSWR from 'swr';
import { useEffect, useMemo } from 'react';

import { Token } from '../components/TokenPicker/hooks';

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

const currentTokenRequests: [tokenID: string, currencyID: string][][] = [];
function useCombinedSimplePrices(
  tokenIDs: (string | undefined)[],
  currencyID: string
) {
  const tokenIDsString = tokenIDs.filter(Boolean).join(',');

  // synchronize hook with global state
  useEffect(() => {
    if (tokenIDsString && currencyID) {
      const request = tokenIDsString.split(',').map((tokenID) => {
        return [tokenID, currencyID] as [tokenID: string, currencyID: string];
      });
      // add tokens
      currentTokenRequests.push(request);
      return () => {
        // remove old tokens
        const index = currentTokenRequests.findIndex(
          (thisRequest) => thisRequest === request
        );
        currentTokenRequests.splice(index, 1);
      };
    }
  }, [tokenIDsString, currencyID]);

  // get all current unique request IDs
  const currentIDs = currentTokenRequests.reduce(
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
  const allTokenIDsString = Array.from(currentIDs.tokenIDs.values()).join(',');
  const allCurrencyIDsString = Array.from(currentIDs.currencyIDs.values()).join(
    ','
  );

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
  const tokens = Array.isArray(tokenOrTokens) ? tokenOrTokens : [tokenOrTokens];
  const tokenIDs = tokens.map((token) => {
    // note Coin Gecko ID warning for developers
    if (token && !token.coingecko_id) {
      // eslint-disable-next-line no-console
      console.warn(`Token ${token.name} (${token.symbol}) has no CoinGecko ID`);
    }
    return token?.coingecko_id;
  });

  const { data, error, isValidating } = useCombinedSimplePrices(
    tokenIDs,
    currencyID
  );

  // return found results as numbers
  const results = tokenIDs.map((tokenID = '') => data?.[tokenID]?.[currencyID]);

  // cache the found result array so it doesn't generate updates if the values are equal
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cachedResults = useMemo(() => results, [...results]);

  return {
    // return array of results or singular result depending on how it was asked
    data: Array.isArray(tokenOrTokens) ? cachedResults : cachedResults[0],
    error,
    isValidating,
  };
}
