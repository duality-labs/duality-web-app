import useSWR from 'swr';
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

export function useSimplePrice(
  token: Token | undefined,
  currencyID?: string
): { data: number; error: FetchError | undefined; isValidating: boolean };
export function useSimplePrice(
  tokens: (Token | undefined)[],
  currencyID?: string
): { data: number[]; error: FetchError | undefined; isValidating: boolean };
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

  const tokenIDsString = tokenIDs.filter(Boolean).join(',');

  const { data, error, isValidating } = useSWR<
    CoinGeckoSimplePrice,
    FetchError
  >(
    tokenIDsString.length > 0
      ? `/simple/price?ids=${tokenIDsString}&vs_currencies=${currencyID}`
      : null,
    fetcher
  );

  // return found results as numbers
  const results = tokenIDs.map((tokenID = '') => data?.[tokenID]?.[currencyID]);
  return {
    // return array of results or singular result depending on how it was asked
    data: Array.isArray(tokenOrTokens) ? results : results[0],
    error,
    isValidating,
  };
}
