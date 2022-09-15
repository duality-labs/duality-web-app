import { useState, useEffect, useCallback } from 'react';

export default function useOnContinualPress(
  onTimeout: () => void,
  { delay = Infinity, interval = 50 } = {}
) {
  // set active state and handlers
  const [active, setActive] = useState(false);
  const stop = useCallback(() => setActive(false), []);
  const start = useCallback(() => {
    if (delay < Infinity && delay >= interval) {
      const timeout = setTimeout(() => setActive(true), delay - interval);
      return () => clearTimeout(timeout);
    }
  }, [delay, interval]);

  useEffect(() => {
    if (active) {
      const timeout = setInterval(() => onTimeout(), interval);
      return () => clearInterval(timeout);
    }
  }, [active, interval, onTimeout]);

  return [start, stop];
}
