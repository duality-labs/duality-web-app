import { ReactNode } from 'react';

import { Token } from '../../lib/web3/utils/tokens';
import { useCurrentPriceFromTicks } from '../LiquiditySelector/useCurrentPriceFromTicks';
import { formatPrice } from '../../lib/utils/number';

import './PriceCard.scss';

export default function PriceCard({
  tokenA,
  tokenB,
}: {
  tokenA: Token;
  tokenB: Token;
}) {
  const currentPrice = useCurrentPriceFromTicks(tokenA.address, tokenB.address);

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
            {currentPrice && !currentPrice.isNaN()
              ? formatPrice(currentPrice.toNumber(), {
                  minimumSignificantDigits: 3,
                })
              : '-'}
          </span>
          <span>{tokenB.symbol}</span>
        </div>
      </div>
    </div>
  );
}

// simple optional row layout container
export function PriceCardRow({ children }: { children: ReactNode }) {
  return <div className="flex row gap-2">{children}</div>;
}
