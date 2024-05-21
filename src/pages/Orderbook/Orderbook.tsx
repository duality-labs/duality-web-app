import { useMemo, useState } from 'react';
import { useMatch } from 'react-router-dom';

import { useDenomFromPathParam } from '../../lib/web3/hooks/useTokens';
import { useToken } from '../../lib/web3/hooks/useDenomClients';
import { useRealtimeDisplayPrice } from '../../components/stats/hooks';
import useBuckets from './useBuckets';

import TabsCard from '../../components/cards/TabsCard';
import { Tab } from '../../components/Tabs/Tabs';
import OrderbookHeader from './OrderbookHeader';
import OrderbookFooter from './OrderbookFooter';
import OrderBookChart, { ChartPriceAxisInfo } from './OrderbookChart';
import OrderbookChartConnector, {
  ChartArea,
  ConnectionArea,
} from './OrderbookChartConnector';
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

export type PriceOffset = [price: number, offset?: number];
export type BucketOffset = [inner: PriceOffset, outer: PriceOffset];
const bucketResolution = 0.001; // size of price set for buckets
const connectionMaxOpacity = 0.5;

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

  const [depthBucketOffsets, setDepthBucketOffsets] = useState<
    BucketOffset[][]
  >([]);

  const [, currentPrice] = useRealtimeDisplayPrice(tokenA, tokenB);

  const depthBucketConnections = useMemo<ConnectionArea[][] | undefined>(() => {
    if (currentPrice && chartPriceAxis && buckets && depthBucketOffsets) {
      const [bucketsA = [], bucketsB = []] = buckets;
      const [bucketOffsetsA, bucketOffsetsB] = depthBucketOffsets;
      // find the maximum reserve equivalent value for connection opacity
      const reservesA = bucketsA.map((bucket) => bucket[2]);
      const reservesB = bucketsB.map((bucket) => bucket[2]);
      const maxSideReserves =
        Math.max(
          Math.max(...reservesA),
          Math.max(...reservesB) * currentPrice
        ) / connectionMaxOpacity;
      // draw connections of chart offsets to depth offsets for each bucket
      return [
        bucketOffsetsA
          ? bucketsA.map<ConnectionArea>(
              ([innerBound, outerBound, reserves]) => {
                const bucketOffset = bucketOffsetsA.find(
                  ([[innerPrice], [outerPrice]]) => {
                    return (
                      innerPrice === innerBound && outerPrice === outerBound
                    );
                  }
                );
                return [
                  [
                    // inner chart price offset
                    getChartPricePointOffset(chartPriceAxis, innerBound),
                    // inner depth price offset
                    bucketOffset?.[0][1] || 0,
                  ],
                  [
                    // outer chart price offset
                    getChartPricePointOffset(chartPriceAxis, outerBound),
                    // outer depth price offset
                    bucketOffset?.[1][1] || 0,
                  ],
                  reserves / maxSideReserves,
                ];
              }
            )
          : [],
        bucketOffsetsB
          ? bucketsB.map<ConnectionArea>(
              ([innerBound, outerBound, reserves]) => {
                const bucketOffset = bucketOffsetsB.find(
                  ([[innerPrice], [outerPrice]]) => {
                    return (
                      innerPrice === innerBound && outerPrice === outerBound
                    );
                  }
                );
                return [
                  [
                    // inner chart price offset
                    getChartPricePointOffset(chartPriceAxis, innerBound),
                    // inner depth price offset
                    bucketOffset?.[0][1] || 0,
                  ],
                  [
                    // outer chart price offset
                    getChartPricePointOffset(chartPriceAxis, outerBound),
                    // outer depth price offset
                    bucketOffset?.[1][1] || 0,
                  ],
                  (reserves * currentPrice) / maxSideReserves,
                ];
              }
            )
          : [],
      ];
    }
  }, [buckets, chartPriceAxis, currentPrice, depthBucketOffsets]);

  const chartReserveBuckets = useMemo<ChartArea[] | undefined>(() => {
    if (depthBucketConnections) {
      const [connectionsA = [], connectionsB = []] = depthBucketConnections;
      const reservesAreasA = connectionsA.map<
        [y1: number, y2: number, reserves: number]
      >(([[y1], [y2], reserves]) => {
        // either value should be within the chart bounds above zero
        return [y1, y2, reserves];
      });
      let cumulativeReservesA = 0;
      const cumulativeReservesAreasA = reservesAreasA.map<
        [y1: number, y2: number, reserves: number]
      >(([y1, y2, reserves], index, reservesAreas) => {
        // either value should be within the chart bounds above zero
        cumulativeReservesA += reserves;
        const nextReserves = reservesAreas[index + 1];
        return [y1, nextReserves ? nextReserves[1] : y2, cumulativeReservesA];
      });
      const reservesAreasB = connectionsB.map<
        [y1: number, y2: number, reserves: number]
      >(([[y1], [y2], reserves]) => {
        // either value should be within the chart bounds above zero
        return [y1, y2, reserves];
      });
      let cumulativeReservesB = 0;
      const cumulativeReservesAreasB = reservesAreasB.map<
        [y1: number, y2: number, reserves: number]
      >(([y1, y2, reserves], index, reservesAreas) => {
        // either value should be within the chart bounds above zero
        cumulativeReservesB += reserves;
        const nextReserves = reservesAreas[index + 1];
        return [y1, nextReserves ? nextReserves[1] : y2, cumulativeReservesB];
      });
      const maxCumulativeReserves =
        Math.max(
          cumulativeReservesAreasA.at(-1)?.[2] || 0,
          cumulativeReservesAreasB.at(-1)?.[2] || 0
        ) || 1;
      return [
        ...cumulativeReservesAreasA.map<ChartArea>(([y1, y2, reserves]) => {
          // either value should be within the chart bounds above zero
          return [y1, y2, reserves / maxCumulativeReserves, '#FF000022'];
        }),
        ...cumulativeReservesAreasB.map<ChartArea>(([y1, y2, reserves]) => {
          // either value should be within the chart bounds above zero
          return [y1, y2, reserves / maxCumulativeReserves, '#00FF0022'];
        }),
        ...reservesAreasA.map<ChartArea>(([y1, y2, reserves]) => {
          // either value should be within the chart bounds above zero
          return [y1, y2, reserves / maxCumulativeReserves, 'red'];
        }),
        ...reservesAreasB.map<ChartArea>(([y1, y2, reserves]) => {
          // either value should be within the chart bounds above zero
          return [y1, y2, reserves / maxCumulativeReserves, 'green'];
        }),
      ];
    }
  }, [depthBucketConnections]);

  const depthPriceIndicationBucketConnection = useMemo<
    ConnectionArea | undefined
  >(() => {
    const [bucketOffsetsA, bucketOffsetsB] = depthBucketOffsets;
    if (chartPriceAxis && currentPrice && depthPriceIndication) {
      const price = depthPriceIndication;
      const [innerBucket, outerBucket] =
        price <= currentPrice
          ? [
              bucketOffsetsA[1],
              bucketOffsetsA.find(
                ([[innerPriceOffset], [outerPriceOffset]]) => {
                  return price < innerPriceOffset && price >= outerPriceOffset;
                }
              ),
            ]
          : [
              bucketOffsetsB[1],
              bucketOffsetsB.find(
                ([[innerPriceOffset], [outerPriceOffset]]) => {
                  return price > innerPriceOffset && price <= outerPriceOffset;
                }
              ),
            ];
      if (innerBucket && outerBucket) {
        return [
          [
            getChartPricePointOffset(chartPriceAxis, innerBucket[0][0]),
            innerBucket[0][1] || 0,
          ],
          [
            getChartPricePointOffset(chartPriceAxis, outerBucket[1][0]),
            outerBucket[1][1] || 0,
          ],
          0.1,
        ];
      }
    }
  }, [chartPriceAxis, currentPrice, depthBucketOffsets, depthPriceIndication]);

  const connectionAreas = useMemo(() => {
    return [
      ...(depthBucketConnections?.[0] ?? []),
      ...(depthBucketConnections?.[1] ?? []),
      ...(depthPriceIndicationBucketConnection
        ? [depthPriceIndicationBucketConnection]
        : []),
    ];
  }, [depthBucketConnections, depthPriceIndicationBucketConnection]);

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
                connectionAreas={connectionAreas}
                chartAreas={chartReserveBuckets}
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
                            setBucketOffsets={setDepthBucketOffsets}
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
