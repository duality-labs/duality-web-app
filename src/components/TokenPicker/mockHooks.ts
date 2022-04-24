import { useState, useEffect } from 'react';

const seconds = 1000;
const requestTime = 2 * seconds;
const tokens = ['ETH', 'USDC', 'BAT', 'DAI'];

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

export function useTokens() {
  return usePoll(tokens);
}
