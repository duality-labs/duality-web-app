import { useEffect, useRef, useState } from 'react';
import { Token } from '../TokenPicker/hooks';

import './TokenPairLogos.scss';

function TokenLogo({
  className,
  token: { symbol, logo_URIs },
}: {
  className?: string;
  token: Token;
}) {
  return (
    <img
      className={['token-pair-logo', className].filter(Boolean).join(' ')}
      alt={`${symbol} logo`}
      src={logo_URIs?.svg ?? logo_URIs?.png}
    />
  );
}

export default function TokenPairLogos({
  className,
  tokenA,
  tokenB,
}: {
  className?: string;
  tokenA: Token;
  tokenB: Token;
}) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [previousTokenA, setPreviousTokenA] = useState(tokenA);
  const [previousTokenB, setPreviousTokenB] = useState(tokenB);
  const tokenAisTransitioning = tokenA !== previousTokenA;
  const tokenBisTransitioning = tokenB !== previousTokenB;

  // update tokens after the transition
  useEffect(() => {
    const timeout = setTimeout(() => {
      setPreviousTokenA(tokenA);
    }, 1000);
    timeoutRef.current = timeout;
    return () => clearTimeout(timeout);
  }, [tokenA]);
  useEffect(() => {
    const timeout = setTimeout(() => {
      setPreviousTokenB(tokenB);
    }, 1000);
    timeoutRef.current = timeout;
    return () => clearTimeout(timeout);
  }, [tokenB]);

  return (
    <div className={['token-pair-logos', className].filter(Boolean).join(' ')}>
      <TokenLogo
        // add transition classes
        className={
          tokenAisTransitioning
            ? tokenBisTransitioning
              ? 'swapping-tokens-a'
              : 'swapping-token-a'
            : 'token-a'
        }
        token={tokenA}
      />
      <TokenLogo
        className={
          tokenBisTransitioning
            ? tokenAisTransitioning
              ? 'swapping-tokens-b'
              : 'swapping-token-b'
            : 'token-b'
        }
        token={tokenB}
      />
    </div>
  );
}
