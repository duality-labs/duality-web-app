import { useState, useEffect, useCallback } from 'react';

const seconds = 1000;
const requestTime = 2 * seconds;

export interface IExchangeRate {
  otherToken?: string;
  price?: string;
  value?: string;
  token?: string;
  rate: string;
  gas: string;
}

export interface Token {
  name: string;
  address: string;
  symbol: string;
  decimals: number;
  chainId: number;
  logoURI: string | null;
}

export interface SwapRequest {
  otherToken: string;
  token: string;
  value: string;
}

let cachedTokens: Array<Token>;
let validatingTokens = false;

const exchangeRates = [
  { token: '0x0001', otherToken: '0x0002', rate: 2809 },
  { token: '0x0002', otherToken: '0x0001', rate: 0.000356 },
  { token: '0x0001', otherToken: '0x0003', rate: 2814 },
  { token: '0x0003', otherToken: '0x0001', rate: 0.0003554 },
  { token: '0x0001', otherToken: '0x0004', rate: 2814 },
  { token: '0x0004', otherToken: '0x0001', rate: 0.0003554 },
  { token: '0x0001', otherToken: '0x0005', rate: 13.65 },
  { token: '0x0005', otherToken: '0x0001', rate: 0.07326 },
  { token: '0x0001', otherToken: '0x0006', rate: 1 },
  { token: '0x0006', otherToken: '0x0001', rate: 1 },
];

export function useExchangeRate(
  token: Token | undefined,
  otherToken: Token | undefined,
  value: string | undefined
) {
  const [data, setData] = useState(undefined as IExchangeRate | undefined);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    if (!token || !otherToken || !value) return setData(undefined);
    setData(undefined);
    setValidating(true);

    setTimeout(() => {
      const baseRate =
        exchangeRates.find(
          (rate) =>
            rate.token === token.address &&
            rate.otherToken === otherToken.address
        )?.rate || 1;
      const rate = baseRate * (0.99 + Math.random() / 50);
      const price = Math.round(rate * Number(value) * 1e6) / 1e6;
      setData({
        rate: `${rate}`,
        gas: '5',
        price: `${price}`,
        value,
        otherToken: otherToken.address,
        token: token.address,
      });
      setValidating(false);
    }, requestTime);
  }, [token, otherToken, value]);

  return { data, isValidating: validating };
}

/**
 * @param {number} interval gap between increments in ms
 * @returns {number}
 */
export function useDotCounter(interval: number) {
  const [dotCount, setDotCount] = useState(0);
  useEffect(() => {
    const timerId = setInterval(
      () => setDotCount((dotCount + 1) % 4),
      interval
    );
    return () => clearInterval(timerId);
  }, [interval, dotCount]);
  return dotCount;
}

export function useTokens(chainID = 1) {
  const [result, setResult] = useState<Array<Token>>();
  const [error, setError] = useState<string>();
  const [validating, setValidating] = useState(true);

  const resolve = useCallback(
    function () {
      const ethToken: Token = {
        name: 'ETH',
        address: '0x0',
        symbol: 'ETH',
        decimals: 2,
        chainId: chainID,
        logoURI: 'https://avatars.githubusercontent.com/u/6250754?s=200&v=4',
      };
      const tokens = [ethToken].concat(
        cachedTokens.filter((token) => token.chainId === chainID)
      );
      setResult(tokens);
    },
    [chainID]
  );

  useEffect(() => {
    if (cachedTokens) {
      resolve();
      // TODO handle !validatingTokens (run the useEffect again when cachedTokens gets updated)
    } else if (!validatingTokens) {
      setValidating(true);
      validatingTokens = true;
      fetch('https://tokens.uniswap.org/')
        .then((res) => res.json())
        .then(({ tokens }: { tokens: Array<Token> }) => {
          cachedTokens = tokens;
          resolve();
          setValidating(false);
          setError(undefined);
        })
        .catch((err) => {
          setResult(undefined);
          setError(err);
        });
    } else {
      setValidating(true);
      validatingTokens = true;
      fetch('https://tokens.uniswap.org/')
        .then((res) => res.json())
        .then(({ tokens }: { tokens: Array<Token> }) => {
          cachedTokens = tokens;
          resolve();
          setValidating(false);
          setError(undefined);
        })
        .catch((err) => {
          setResult(undefined);
          setError(err);
        });
    }
  }, [resolve]);

  return { result, isValidating: validating, error };
}

export function useSwap(request: SwapRequest | undefined) {
  const [data, setData] = useState(undefined as string | undefined);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    if (!request) {
      setValidating(false);
      setData(undefined);
      return;
    }
    setData(undefined);
    setValidating(true);

    setTimeout(() => {
      setData('Ok');
      setValidating(false);
    }, requestTime);
  }, [request]);

  return { data, isValidating: validating };
}
