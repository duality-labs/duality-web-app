import { useState, useEffect, useCallback, useRef } from 'react';

export default function useOnContinualPress(
  onTimeout: () => void,
  disabled = false,
  delay = 0,
  interval = 50
) {
  // set active state and handlers
  const [active, setActive] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const intervalRef = useRef<NodeJS.Timeout>();

  const stop = useCallback(() => {
    timeoutRef.current && clearTimeout(timeoutRef.current);
    intervalRef.current && clearInterval(intervalRef.current);
    setActive(false);
  }, []);

  const start = useCallback(() => {
    if (delay < Infinity && delay) {
      const timeout = setTimeout(() => setActive(true), delay);
      timeoutRef.current = timeout;
      return () => clearTimeout(timeout);
    }
  }, [delay]);

  useEffect(() => {
    if (disabled) stop();
  }, [disabled, stop]);

  useEffect(() => {
    if (active) {
      const timeout = setInterval(() => onTimeout(), interval);
      intervalRef.current = timeout;
      return () => clearInterval(timeout);
    }
  }, [active, interval, onTimeout]);

  return [start, stop];
}
