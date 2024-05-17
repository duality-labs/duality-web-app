import { useMemo, useState } from 'react';
import { useMatch } from 'react-router-dom';

import { useDenomFromPathParam } from '../../lib/web3/hooks/useTokens';
import { useToken } from '../../lib/web3/hooks/useDenomClients';

import TabsCard from '../../components/cards/TabsCard';
import { Tab } from '../../components/Tabs/Tabs';
import OrderbookHeader from './OrderbookHeader';
import OrderbookFooter from './OrderbookFooter';
import OrderBookChart from './OrderbookChart';
import OrderBookList from './OrderbookList';
import OrderBookTradesList from './OrderbookTradesList';
import LimitOrderCard from '../../components/cards/LimitOrderCard';

import './Orderbook.scss';

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
  const { data: denomA } = useDenomFromPathParam(match?.params['tokenA']);
  const { data: denomB } = useDenomFromPathParam(match?.params['tokenB']);
  const { data: tokenA } = useToken(denomA);
  const { data: tokenB } = useToken(denomB);

  const [depthPriceIndication, setDepthPriceIndication] = useState<number>();

  return (
    <div className="decontainer flex col gap-3">
      <div className="orderbook-header row">
        <OrderbookHeader tokenA={tokenA} tokenB={tokenB} />
      </div>
      <div className="orderbook-body row gap-3">
        <div className="flex col">
          <div className="orderbook-chart-book flex row">
            <div className="flex col page-card p-0">
              {tokenA && tokenB && (
                <OrderBookChart
                  tokenA={tokenB}
                  tokenB={tokenA}
                  priceIndication={depthPriceIndication}
                  setPriceIndication={setDepthPriceIndication}
                />
              )}
            </div>
            <div className="chart-depth-connector col"></div>
            <div className="col">
              <TabsCard
                className="flex"
                style={{
                  // fix width to a minimum to allow tabs to be of equal size
                  // sized to the word "Orderbook" with padding
                  minWidth: '15em',
                }}
                tabs={useMemo<Tab[]>(() => {
                  return [
                    {
                      nav: 'Orderbook',
                      tab:
                        tokenA && tokenB ? (
                          <OrderBookList
                            tokenA={tokenA}
                            tokenB={tokenB}
                            priceIndication={depthPriceIndication}
                            setPriceIndication={setDepthPriceIndication}
                          />
                        ) : null,
                    },
                    {
                      nav: 'Trades',
                      tab:
                        tokenA && tokenB ? (
                          <OrderBookTradesList
                            tokenA={tokenA}
                            tokenB={tokenB}
                          />
                        ) : null,
                    },
                  ];
                }, [depthPriceIndication, tokenA, tokenB])}
              />
            </div>
          </div>
        </div>
        <div className="col">
          <LimitOrderCard tokenA={tokenA} tokenB={tokenB} />
        </div>
      </div>
      <div className="orderbook-footer row">
        <OrderbookFooter tokenA={tokenA} tokenB={tokenB} />
      </div>
    </div>
  );
}
