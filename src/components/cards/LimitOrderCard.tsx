import { useMemo } from 'react';
import TabsCard from './TabsCard';

import { Token } from '../../lib/web3/utils/tokens';

export default function LimitOrderCard({
  tokenA,
  tokenB,
}: {
  tokenA?: Token;
  tokenB?: Token;
}) {
  return (
    <TabsCard
      className="flex limitorder-card"
      style={{
        // fix width to a minimum to allow tabs to be of equal size
        minWidth: '20em',
      }}
      tabs={useMemo(() => {
        return [
          {
            nav: 'Buy',
            Tab: () => (tokenA && tokenB ? <div>Buy</div> : null),
          },
          {
            nav: 'Sell',
            Tab: () => (tokenA && tokenB ? <div>Sell</div> : null),
          },
        ];
      }, [tokenA, tokenB])}
    />
  );
}
