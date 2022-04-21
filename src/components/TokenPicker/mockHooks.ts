import { useState, useEffect } from 'react';

const seconds = 1000;
const pollTime = 5 * seconds;
const requestTime = 2 * seconds;
const tokens = ['ETH', 'USDC'];

export function useTokens() {
  const [data, setData] = useState(undefined as string[]|undefined);
  const [validating, setValidating] = useState(true);

  // return mock data after requestTime has passed
  useEffect(() => {
    // mock a fetch request
    const fetch = async () => {
      setValidating(true);
      await new Promise((resolve) => setTimeout(resolve, requestTime));
      setData(tokens);
      setValidating(false);
    };
    // start poll
    fetch();
    const interval = setInterval(fetch, pollTime);
    return () => {
      clearInterval(interval);
    }
  }, []);

  return { data, isValidating: validating };
}
