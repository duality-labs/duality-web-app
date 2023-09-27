import { useMemo } from 'react';

import TabsCard from './TabsCard';
import Tabs from '../Tabs';

import { Token } from '../../lib/web3/utils/tokens';

import './LimitOrderCard.scss';

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
            Tab: () => <LimitOrderType tokenA={tokenA} tokenB={tokenB} />,
          },
          {
            nav: 'Sell',
            Tab: () => <LimitOrderType tokenA={tokenA} tokenB={tokenB} sell />,
          },
        ];
      }, [tokenA, tokenB])}
    />
  );
}

function LimitOrderType({
  tokenA,
  tokenB,
  sell = false,
}: {
  tokenA?: Token;
  tokenB?: Token;
  sell?: boolean;
}) {
  const tabs = useMemo(() => {
    const props = { tokenA, tokenB, sell };
    return [
      {
        nav: 'Limit',
        Tab: () => <LimitOrder {...props} />,
      },
      {
        nav: 'Market',
        Tab: () => <LimitOrder {...props} />,
      },
      {
        nav: 'Stop Limit',
        Tab: () => <LimitOrder {...props} />,
      },
    ];
  }, [tokenA, tokenB, sell]);

  return (
    <div className="p-md">
      <Tabs className="limitorder-type" tabs={tabs} />
    </div>
  );
}

function LimitOrder({
  tokenA,
  tokenB,
  sell: sellMode = false,
}: {
  tokenA?: Token;
  tokenB?: Token;
  sell?: boolean;
}) {
  const buyMode = !sellMode;

  return (
    <div>
      <div className="flex row">
        <button className="limit-order__confirm-button flex button-primary my-lg py-4">
          {buyMode ? 'Buy' : 'Sell'}
        </button>
      </div>
    </div>
  );
}
