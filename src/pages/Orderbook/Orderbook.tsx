import { useMemo } from 'react';
import { useMatch } from 'react-router-dom';

import { useTokenBySymbol } from '../../lib/web3/hooks/useTokens';

import TabsCard from '../../components/cards/TabsCard';
import OrderbookHeader from './OrderbookHeader';
import OrderbookFooter from './OrderbookFooter';
import OrderBookChart from './OrderbookChart';
import OrderBookList from './OrderbookList';

import './Orderbook.scss';
import OrderBookTradesList from './OrderbookTradesList';

export default function OrderbookPage() {
  return (
    <div className="container flex row">
      <div className="page orderbook-page flex col my-5">
        <Orderbook />
      </div>
    </div>
  );
}

function Orderbook() {
  // change tokens to match pathname
  const match = useMatch('/orderbook/:tokenA/:tokenB');
  const tokenA = useTokenBySymbol(match?.params['tokenA']);
  const tokenB = useTokenBySymbol(match?.params['tokenB']);

  return (
    <div className="flex col gap-3">
      <div className="orderbook-header row">
        <OrderbookHeader tokenA={tokenA} tokenB={tokenB} />
      </div>
      <div className="orderbook-body row gap-3">
        <div className="flex col">
          <div className="flex page-card">
            {tokenA?.address === 'stake' && tokenB?.address === 'token' && (
              <OrderBookChart tokenA={tokenA} tokenB={tokenB} />
            )}
          </div>
        </div>
        <div className="col">
          <TabsCard
            className="flex"
            style={{
              // fix width to a minimum to allow tabs to be of equal size
              // sized to the word "Orderbook" with padding
              minWidth: '15em',
            }}
            tabs={useMemo(() => {
              return [
                {
                  nav: 'Orderbook',
                  Tab: () =>
                    tokenA?.address === 'stake' &&
                    tokenB?.address === 'token' ? (
                      <OrderBookList tokenA={tokenA} tokenB={tokenB} />
                    ) : null,
                },
                {
                  nav: 'Trades',
                  Tab: () =>
                    tokenA?.address === 'stake' &&
                    tokenB?.address === 'token' ? (
                      <OrderBookTradesList tokenA={tokenA} tokenB={tokenB} />
                    ) : null,
                },
              ];
            }, [tokenA, tokenB])}
          />
        </div>
        <div className="col">
          <div className="flex page-card">Limit Order control</div>
        </div>
      </div>
      <div className="orderbook-footer row">
        <OrderbookFooter tokenA={tokenA} tokenB={tokenB} />
      </div>
    </div>
  );
}
