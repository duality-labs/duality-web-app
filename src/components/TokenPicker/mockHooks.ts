import { useState, useEffect } from 'react';

let idCounter = 0;
const seconds = 1000;
const requestTime = 2 * seconds;

export interface Token {
  logo: string | null;
  address: string;
  symbol: string;
  name: string;
}

const tokens: Array<Token> = [
  { logo: null, symbol: 'Eth', name: 'Ether', address: '0x0001' },
  { logo: null, symbol: 'Dai', name: 'Dai Stablecoin', address: '0x0002' },
  { logo: null, symbol: 'USDC', name: 'USDCoin', address: '0x0003' },
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

interface IExchangeRate {
  price?: string;
  index?: number;
  rate: string;
  gas: string;
}
const exchangeRate: IExchangeRate = { rate: '100', gas: '5' };

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

export function useExchangeRate(otherPrice: string, index: number) {
  const [data, setData] = useState(undefined as IExchangeRate | undefined);
  const [validating, setValidating] = useState(true);

  useEffect(() => {
    setValidating(true);
    setTimeout(() => {
      setData({
        ...exchangeRate,
        price: String(+exchangeRate.rate * +otherPrice),
        index: index,
      });
      setValidating(false);
    }, requestTime);
  }, [otherPrice, index]);

  return { data, isValidating: validating };
}

export function useDotCounter(
  interval: number /* gap between increments in ms */
) {
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

export function useNextID() {
  idCounter += 1;
  if (idCounter >= Number.MAX_SAFE_INTEGER) idCounter = 0;
  return idCounter;
}
