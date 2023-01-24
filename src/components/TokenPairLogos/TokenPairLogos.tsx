import { useEffect, useRef, useState } from 'react';
import { Token } from '../TokenPicker/hooks';

import './TokenPairLogos.scss';

function TokenLogo({
  className,
  token,
  previousToken = token,
}: {
  className: string;
  token: Token;
  previousToken?: Token;
}) {
  return (
    <div className="token-pair-logo">
      <img
        className={`${className} token-current`}
        alt={`${token.symbol} logo`}
        src={token.logo_URIs?.svg ?? token.logo_URIs?.png}
      />
      <img
        className={`${className} token-${
          token === previousToken ? 'current' : 'previous'
        }`}
        alt={`${previousToken.symbol} logo`}
        src={previousToken.logo_URIs?.svg ?? previousToken.logo_URIs?.png}
      />
    </div>
  );
}

const tokenSwitchDelayMs = 1000;
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
    }, tokenSwitchDelayMs);
    timeoutRef.current = timeout;
    return () => clearTimeout(timeout);
  }, [tokenA]);
  useEffect(() => {
    const timeout = setTimeout(() => {
      setPreviousTokenB(tokenB);
    }, tokenSwitchDelayMs);
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
        previousToken={previousTokenA}
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
        previousToken={previousTokenB}
        token={tokenB}
      />
    </div>
  );
}
