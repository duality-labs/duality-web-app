import { useState, useEffect, useCallback } from 'react';

export default function useOnContinualPress(
  onTimeout: () => void,
  delay = 0,
  interval = 50
) {
  // set active state and handlers
  const [active, setActive] = useState(false);
  const stop = useCallback(() => setActive(false), []);
  const start = useCallback(() => {
    if (delay < Infinity && delay) {
      const timeout = setTimeout(() => setActive(true), delay);
      return () => clearTimeout(timeout);
    }
  }, [delay]);

  useEffect(() => {
    if (active) {
      const timeout = setInterval(() => onTimeout(), interval);
      return () => clearInterval(timeout);
    }
  }, [active, interval, onTimeout]);

  return [start, stop];
}
