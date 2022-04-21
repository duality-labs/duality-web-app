import { useState, useEffect } from 'react';

const seconds = 1000;
const requestTime = 2 * seconds;
const tokens = ['ETH', 'USDC'];

export function useTokens() {
  const [data, setData] = useState(undefined as string[]|undefined);
  const [validating, setValidating] = useState(true);

  // return mock data after requestTime has passed
  useEffect(() => {
    const timeout = setTimeout(() => {
      setValidating(false);
      setData(tokens);
    }, requestTime);
    return () => {
      clearTimeout(timeout);
    }
  }, []);

  return { data, isValidating: validating };
}
