import { useMemo, useState } from 'react';
import { useMatch } from 'react-router-dom';

import { useDenomFromPathParam } from '../../lib/web3/hooks/useTokens';
import { useToken } from '../../lib/web3/hooks/useDenomClients';
import useBuckets from './useBuckets';

import TabsCard from '../../components/cards/TabsCard';
import { Tab } from '../../components/Tabs/Tabs';
import OrderbookHeader from './OrderbookHeader';
import OrderbookFooter from './OrderbookFooter';
import OrderBookChart, { ChartPriceAxisInfo } from './OrderbookChart';
import OrderbookChartConnector from './OrderbookChartConnector';
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

export type PriceOffset = [price?: number, offset?: number];
const bucketResolution = 0.001; // size of price set for buckets

function Orderbook() {
  // change tokens to match pathname
  const match = useMatch('/orderbook/:tokenA/:tokenB');
  const { data: denomA } = useDenomFromPathParam(match?.params['tokenA']);
  const { data: denomB } = useDenomFromPathParam(match?.params['tokenB']);
  const { data: tokenA } = useToken(denomA);
  const { data: tokenB } = useToken(denomB);

  const [chartPriceAxis, setChartPriceAxis] = useState<ChartPriceAxisInfo>();
  const [[depthPriceIndication, depthPriceOffset] = [], setDepthPriceOffset] =
    useState<PriceOffset>();
  const buckets = useBuckets(tokenA, tokenB, bucketResolution);

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
                  setPriceAxis={setChartPriceAxis}
                />
              )}
            </div>
            <div className="chart-depth-connector col">
              <OrderbookChartConnector
                connectionPoints={useMemo(() => {
                  if (
                    chartPriceAxis &&
                    depthPriceIndication &&
                    depthPriceOffset
                  ) {
                    return [
                      [
                        getChartPricePointOffset(
                          chartPriceAxis,
                          depthPriceIndication
                        ),
                        depthPriceOffset,
                      ],
                    ];
                  }
                  return [];
                }, [chartPriceAxis, depthPriceIndication, depthPriceOffset])}
              />
            </div>
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
                            buckets={buckets}
                            bucketResolution={bucketResolution}
                            priceIndication={depthPriceIndication}
                            setPriceOffset={setDepthPriceOffset}
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
                }, [buckets, depthPriceIndication, tokenA, tokenB])}
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

function getPointOffsetPercent(
  value: number,
  max: number,
  min: number = 0,
  mode: ChartPriceAxisInfo['mode'] = 0
): number {
  switch (mode) {
    // handle linear math
    case 0: {
      return (value - min) / (max - min);
    }
  }
  // todo: handle other math
  return NaN;
}
function getPointOffset(
  percent: number,
  extent: number,
  offset: number = 0
): number {
  return percent * extent + offset;
}

const chartPriceAxisOffset = {
  top: 42,
};
function getChartPricePointOffset(
  chartPriceAxis: ChartPriceAxisInfo,
  price: number
) {
  return getPointOffset(
    getPointOffsetPercent(
      price,
      chartPriceAxis.from,
      chartPriceAxis.to,
      chartPriceAxis.mode
    ),
    chartPriceAxis.height,
    chartPriceAxisOffset.top
  );
}
