import { useCallback, useMemo, useRef, useState } from 'react';
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
  ConnectionLine,
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

function Orderbook() {
  // change tokens to match pathname
  const match = useMatch('/orderbook/:tokenA/:tokenB');
  const { data: denomA } = useDenomFromPathParam(match?.params['tokenA']);
  const { data: denomB } = useDenomFromPathParam(match?.params['tokenB']);
  const { data: tokenA } = useToken(denomA);
  const { data: tokenB } = useToken(denomB);

  const [chartPriceAxis, setChartPriceAxis] = useState<ChartPriceAxisInfo>();
  const [formPriceIndication, setFormPriceIndication] = useState<number>();
  const [depthPriceIndication, setDepthPriceIndication] = useState<number>();
  const [bucketResolution, setBucketResolution] = useState<number>();
  const buckets = useBuckets(tokenA, tokenB, bucketResolution);

  const [showIndividualBuckets, setShowIndividualBuckets] = useState(false);
  const [showCumulativeBuckets, setShowCumulativeBuckets] = useState(false);

  const [depthBucketOffsets, setDepthBucketOffsets] = useState<
    BucketOffset[][]
  >([]);

  const [, currentPrice] = useRealtimeDisplayPrice(tokenA, tokenB);

  const priceIndication = depthPriceIndication ?? formPriceIndication;
  const activeBucketOffsets = useMemo(() => {
    if (
      currentPrice &&
      priceIndication !== undefined &&
      currentPrice !== priceIndication
    ) {
      const [bucketOffsetsA = [], bucketOffsetsB = []] = depthBucketOffsets;
      return priceIndication > currentPrice
        ? bucketOffsetsB?.filter(
            ([[innerBound]]) => priceIndication > innerBound
          )
        : bucketOffsetsA?.filter(
            ([[innerBound]]) => priceIndication < innerBound
          );
    }
  }, [depthBucketOffsets, currentPrice, priceIndication]);

  const priceConnectionLines = useMemo<ConnectionLine[]>(() => {
    if (
      chartPriceAxis &&
      priceIndication !== undefined &&
      depthBucketOffsets &&
      currentPrice
    ) {
      const [bucketOffsetsA = []] = depthBucketOffsets;
      const offset =
        priceIndication === currentPrice
          ? // return average of a side's current price bucket
            ((bucketOffsetsA[0]?.[0][1] || 0) +
              (bucketOffsetsA[0]?.[1][1] || 0)) /
              2 || undefined
          : // check lower buckets
          priceIndication < currentPrice
          ? activeBucketOffsets?.at(-1)?.[1][1]
          : // check upper buckets
          priceIndication > currentPrice
          ? activeBucketOffsets?.at(-1)?.[1][1]
          : undefined;
      if (offset) {
        return [
          [getChartPricePointOffset(chartPriceAxis, priceIndication), offset],
        ];
      }
    }
    return [];
  }, [
    activeBucketOffsets,
    chartPriceAxis,
    currentPrice,
    depthBucketOffsets,
    priceIndication,
  ]);

  const depthBucketConnections = useMemo<ConnectionArea[][] | undefined>(() => {
    if (currentPrice && chartPriceAxis && buckets && depthBucketOffsets) {
      const [bucketsA = [], bucketsB = []] = buckets;
      const [bucketOffsetsA, bucketOffsetsB] = depthBucketOffsets;
      // find the maximum reserve equivalent value for connection opacity
      const reservesA = bucketsA.map((bucket) => bucket[2]);
      const reservesB = bucketsB.map((bucket) => bucket[2]);
      const maxSideReserves = Math.max(
        Math.max(...reservesA),
        Math.max(...reservesB) * currentPrice
      );
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
                  '#26801bFF',
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
                  '#d6363aff',
                ];
              }
            )
          : [],
      ];
    }
  }, [buckets, chartPriceAxis, currentPrice, depthBucketOffsets]);

  const chartReserveBuckets = useMemo<ChartArea[] | undefined>(() => {
    if (
      depthBucketConnections &&
      (showIndividualBuckets || showCumulativeBuckets)
    ) {
      const [connectionsA = [], connectionsB = []] = depthBucketConnections;
      const reservesAreasA = connectionsA.map<
        [y1: number, y2: number, reserves: number]
      >(([[y1], [y2], reserves]) => {
        // either value should be within the chart bounds above zero
        return [y1, y2, reserves];
      });
      let cumulativeReservesA = 0;
      const cumulativeAreasA = showCumulativeBuckets
        ? reservesAreasA.map<[y1: number, y2: number, reserves: number]>(
            ([y1, y2, reserves], index, reservesAreas) => {
              // either value should be within the chart bounds above zero
              cumulativeReservesA += reserves;
              const nextReserves = reservesAreas[index + 1];
              return [
                y1,
                nextReserves ? nextReserves[0] : y2,
                cumulativeReservesA,
              ];
            }
          )
        : [];
      const reservesAreasB = connectionsB.map<
        [y1: number, y2: number, reserves: number]
      >(([[y1], [y2], reserves]) => {
        // either value should be within the chart bounds above zero
        return [y1, y2, reserves];
      });
      let cumulativeReservesB = 0;
      const cumulativeAreasB = showCumulativeBuckets
        ? reservesAreasB.map<[y1: number, y2: number, reserves: number]>(
            ([y1, y2, reserves], index, reservesAreas) => {
              // either value should be within the chart bounds above zero
              cumulativeReservesB += reserves;
              const nextReserves = reservesAreas[index + 1];
              return [
                y1,
                nextReserves ? nextReserves[0] : y2,
                cumulativeReservesB,
              ];
            }
          )
        : [];
      const maxCumulativeReserves =
        (showCumulativeBuckets
          ? Math.max(
              cumulativeAreasA.at(-1)?.[2] || 0,
              cumulativeAreasB.at(-1)?.[2] || 0
            )
          : Math.max(
              ...reservesAreasA.map((v) => v[2]),
              ...reservesAreasB.map((v) => v[2])
            )) || 1;
      return [
        ...cumulativeAreasA.map<ChartArea>(([y1, y2, reserves]) => {
          // either value should be within the chart bounds above zero
          return [y1, y2, reserves / maxCumulativeReserves, '#26801b1a'];
        }),
        ...cumulativeAreasB.map<ChartArea>(([y1, y2, reserves]) => {
          // either value should be within the chart bounds above zero
          return [y1, y2, reserves / maxCumulativeReserves, '#f0515115'];
        }),
        ...reservesAreasA.map<ChartArea>(([y1, y2, reserves]) => {
          // either value should be within the chart bounds above zero
          return [y1, y2, reserves / maxCumulativeReserves, '#206916'];
        }),
        ...reservesAreasB.map<ChartArea>(([y1, y2, reserves]) => {
          // either value should be within the chart bounds above zero
          return [y1, y2, reserves / maxCumulativeReserves, '#a92325'];
        }),
      ];
    }
  }, [depthBucketConnections, showCumulativeBuckets, showIndividualBuckets]);

  const priceIndicationBucketConnection = useMemo<
    ConnectionArea | undefined
  >(() => {
    const [bucketOffsetsA = [], bucketOffsetsB = []] = depthBucketOffsets;
    if (chartPriceAxis && currentPrice && priceIndication !== undefined) {
      const price = priceIndication;
      const [innerBucket, outerBucket] =
        price <= currentPrice
          ? [bucketOffsetsA[1], activeBucketOffsets?.at(-1)]
          : [bucketOffsetsB[1], activeBucketOffsets?.at(-1)];
      if (innerBucket && outerBucket) {
        return [
          [
            getChartPricePointOffset(chartPriceAxis, innerBucket[0][0]),
            innerBucket[0][1] || 0,
          ],
          [
            getChartPricePointOffset(chartPriceAxis, priceIndication),
            outerBucket[1][1] || 0,
          ],
          // this opacity will be offset by the "minimum" connection opacity
          -0.025,
        ];
      }
    }
  }, [
    activeBucketOffsets,
    chartPriceAxis,
    currentPrice,
    depthBucketOffsets,
    priceIndication,
  ]);

  const connectionAreas = useMemo(() => {
    return [
      ...(depthBucketConnections?.[0] ?? []),
      ...(depthBucketConnections?.[1] ?? []),
      ...(priceIndicationBucketConnection
        ? [priceIndicationBucketConnection]
        : []),
    ];
  }, [depthBucketConnections, priceIndicationBucketConnection]);

  // set limit price using a ref to avoid a useEffect re-rendering issue
  const setLimitPriceRef = useRef<(limitPrice: string) => void>();
  const getSetLimitPrice = useCallback<
    (setLimitPrice: (limitPrice: string) => void) => void
  >((setLimitPrice) => {
    setLimitPriceRef.current = setLimitPrice;
  }, []);
  const setLimitPrice = useCallback<(limitPrice: string) => void>((price) => {
    setLimitPriceRef.current?.(price);
  }, []);

  const [tabIndex, setTabIndex] = useState<number>(0);

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
                  priceIndication={
                    priceIndication !== currentPrice
                      ? priceIndication
                      : undefined
                  }
                  setPriceAxis={setChartPriceAxis}
                />
              )}
            </div>
            <div className="chart-depth-connector col">
              <OrderbookChartConnector
                connectionLines={!tabIndex ? priceConnectionLines : undefined}
                connectionAreas={tabIndex === 0 ? connectionAreas : undefined}
                chartAreas={chartReserveBuckets}
                showIndividualBuckets={showIndividualBuckets}
                showCumulativeBuckets={showCumulativeBuckets}
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
                tabIndex={tabIndex}
                setTabIndex={setTabIndex}
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
                            setBucketResolution={setBucketResolution}
                            priceIndication={priceIndication}
                            setPriceIndication={setDepthPriceIndication}
                            setBucketOffsets={setDepthBucketOffsets}
                            setLimitPrice={setLimitPrice}
                            showIndividualBuckets={showIndividualBuckets}
                            showCumulativeBuckets={showCumulativeBuckets}
                            setShowIndividualBuckets={setShowIndividualBuckets}
                            setShowCumulativeBuckets={setShowCumulativeBuckets}
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
                }, [
                  bucketResolution,
                  buckets,
                  priceIndication,
                  setLimitPrice,
                  showCumulativeBuckets,
                  showIndividualBuckets,
                  tokenA,
                  tokenB,
                ])}
              />
            </div>
          </div>
        </div>
        <div className="col">
          <LimitOrderCard
            tokenA={tokenA}
            tokenB={tokenB}
            getSetLimitPrice={getSetLimitPrice}
            setPriceIndication={setFormPriceIndication}
          />
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
