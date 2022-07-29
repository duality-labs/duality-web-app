import { useState, useEffect } from 'react';

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
  logo: string | null;
  address: string;
  symbol: string;
  name: string;
}

export interface SwapRequest {
  otherToken: string;
  token: string;
  value: string;
}

const tokens: Array<Token> = [
  { logo: null, symbol: 'TKN', name: 'TokenCoin', address: 'token' },
  { logo: null, symbol: 'STK', name: 'StakeCoin', address: 'stake' },
  { logo: null, symbol: 'Eth', name: 'Ether', address: 'ETH' },
  {
    logo: null,
    symbol: 'Dai',
    name: 'Dai Stablecoin',
    address: 'Dai',
  },
  {
    logo: null,
    symbol: 'USDC',
    name: 'USDCoin',
    address: 'USDC',
  },
  { logo: null, symbol: 'USDT', name: 'Tether USD', address: '0x0004' },
  { logo: null, symbol: 'WBTC', name: 'Wrapped BTC', address: '0x0005' },
  { logo: null, symbol: 'WETH', name: 'Wrapped Ether', address: '0x0006' },
  {
    logo: null,
    symbol: 'BAT',
    name: 'Basic Attention Token',
    address: '0x0007',
  },
];

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

function usePoll<T>(mockData: T): {
  data: T | undefined;
  isValidating: boolean;
} {
  const [data, setData] = useState(undefined as T | undefined);
  const [validating, setValidating] = useState(true);

  // return mock data after requestTime has passed
  useEffect(() => {
    // mock a fetch request
    const fetch = async () => {
      setValidating(true);
      await new Promise((resolve) => setTimeout(resolve, requestTime));
      setData(mockData);
      setValidating(false);
    };
    // start poll
    fetch();
  }, [mockData]);

  return { data, isValidating: validating };
}

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

export function useTokens() {
  return usePoll(tokens);
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
