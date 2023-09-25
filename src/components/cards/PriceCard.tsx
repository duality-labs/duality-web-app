import { ReactNode } from 'react';

import { Token } from '../../lib/web3/utils/tokens';
import { useCurrentPriceFromTicks } from '../Liquidity/useCurrentPriceFromTicks';
import { formatPrice } from '../../lib/utils/number';
import { useSimplePrice } from '../../lib/tokenPrices';

import './PriceCard.scss';
import { getTokenId } from '../../lib/web3/hooks/useTokens';

export function PriceCard({
  tokenA,
  tokenB,
  price,
}: {
  tokenA: Token;
  tokenB: Token | string;
  price: number | undefined;
}) {
  return (
    <div className="price-card row flex-centered gap-3 px-4 py-2">
      <div className="price-card__token-logo col my-2">
        <img
          className="token-logo token-current"
          alt={`${tokenA.symbol} logo`}
          src={tokenA.logo_URIs?.svg ?? tokenA.logo_URIs?.png}
        />
      </div>
      <div className="price-card__text row">
        <div className="row gap-sm">
          <span>{tokenA.symbol}</span>
          <span>=</span>
          <span>
            {price !== undefined && !isNaN(price)
              ? formatPrice(price, {
                  minimumSignificantDigits: 3,
                })
              : '-'}
          </span>
          <span>{typeof tokenB === 'string' ? tokenB : tokenB.symbol}</span>
        </div>
      </div>
    </div>
  );
}

export function PairPriceCard({
  tokenA,
  tokenB,
}: {
  tokenA: Token;
  tokenB: Token;
}) {
  const currentPrice = useCurrentPriceFromTicks(
    getTokenId(tokenA),
    getTokenId(tokenB)
  );
  return (
    <PriceCard
      tokenA={tokenA}
      tokenB={tokenB}
      price={currentPrice?.toNumber()}
    />
  );
}

export function PriceUSDCard({ token }: { token: Token }) {
  const { data: currentPrice } = useSimplePrice(token);
  return <PriceCard tokenA={token} tokenB="USD" price={currentPrice} />;
}

// simple optional row layout container
export function PriceCardRow({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={['flex row gap-2', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}
