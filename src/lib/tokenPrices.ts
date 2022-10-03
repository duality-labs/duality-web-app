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
  tokens: (Token | undefined)[],
  currencyID = 'USD'
) {
  const tokenIDs = tokens.map((token) => {
    // note Coin Gecko ID warning for developers
    if (token && !token.coingecko_id) {
      // eslint-disable-next-line no-console
      console.warn(`Token ${token.name} (${token.symbol}) has no CoinGecko ID`);
    }
    return token?.coingecko_id;
  });

  const validTokenIDs = tokenIDs.filter(Boolean) as string[];

  const { data, error, isValidating } = useSWR<
    CoinGeckoSimplePrice,
    FetchError
  >(
    validTokenIDs.length > 0
      ? `/simple/price?ids=${validTokenIDs.join(
          ','
        )}&vs_currencies=${currencyID}`
      : null,
    fetcher
  );

  // return found results as numbers
  const results = tokenIDs.map((tokenID = '') => data?.[tokenID]?.[currencyID]);
  return {
    data: results,
    error,
    isValidating,
  };
}
