import { useState, useEffect } from 'react';

const seconds = 1000;
const requestTime = 2 * seconds;
const tokens = ['ETH', 'USDC', 'BAT', 'DAI'];
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
