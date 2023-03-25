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
    <div className={`${className} token-pair-logo`}>
      <img
        className="token-logo token-current"
        alt={`${token.symbol} logo`}
        src={token.logo_URIs?.svg ?? token.logo_URIs?.png}
      />
      <img
        className="token-logo token-previous"
        alt={`${previousToken.symbol} logo`}
        src={previousToken.logo_URIs?.svg ?? previousToken.logo_URIs?.png}
      />
    </div>
  );
}

const tokenSwitchDelayMs = 800;
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
  const tokensTransitioning = tokenAisTransitioning || tokenBisTransitioning;

  // set the middle of the transition
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (tokensTransitioning && containerRef.current) {
      containerRef.current?.classList.add('token-pair-transition-start');
      setTimeout(() => {
        containerRef.current?.classList.add('token-pair-transition-end');
        containerRef.current?.classList.remove('token-pair-transition-start');
      }, tokenSwitchDelayMs / 1.25); // cut-off early for smoother transition
    }
  }, [tokensTransitioning]);

  // update tokens after the transition
  useEffect(() => {
    const timeout = setTimeout(() => {
      setPreviousTokenA(tokenA);
      setPreviousTokenB(tokenB);
    }, tokenSwitchDelayMs + 25); // add a little allowance for smoother transition
    timeoutRef.current = timeout;
    return () => clearTimeout(timeout);
  }, [tokenA, tokenB, previousTokenA, previousTokenB]);

  return (
    <div
      ref={containerRef}
      className={[
        'token-pair-logos',
        className,
        tokensTransitioning && 'token-pair-transition-active',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <TokenLogo
        // add transition classes
        className={
          tokenAisTransitioning
            ? tokenBisTransitioning
              ? 'token-a swapping-tokens-a'
              : 'token-a swapping-token-a'
            : 'token-a'
        }
        previousToken={previousTokenA}
        token={tokenA}
      />
      <TokenLogo
        className={
          tokenBisTransitioning
            ? tokenAisTransitioning
              ? 'token-b swapping-tokens-b'
              : 'token-b swapping-token-b'
            : 'token-b'
        }
        previousToken={previousTokenB}
        token={tokenB}
      />
    </div>
  );
}
