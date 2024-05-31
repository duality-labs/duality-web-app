import BigNumber from 'bignumber.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeepCompareMemoize } from 'use-deep-compare-effect';
import {
  widget,
  IBasicDataFeed,
  ChartingLibraryWidgetOptions,
  DatafeedConfiguration,
  ResolutionString,
  LibrarySymbolInfo,
  SearchSymbolResultItem,
  Bar,
  Timezone,
  VisiblePriceRange,
  PriceScaleMode,
  IChartWidgetApi,
} from 'charting_library';

import { Token, getTokenId } from '../../lib/web3/utils/tokens';

import { useTokenByDenom } from '../../lib/web3/hooks/useDenomClients';
import useTokenPairs from '../../lib/web3/hooks/useTokenPairs';
import { tickIndexToPrice } from '../../lib/web3/utils/ticks';
import { TimeSeriesRow } from '../../components/stats/utils';
import {
  BaseTimeSeriesSSERow,
  IndexerStreamAccumulateSingleDataSet,
  TimeSeriesPage,
  fetchMostRecentDataRowFromTimeseries,
} from '../../lib/web3/hooks/useIndexer';
import { days, hours, minutes, seconds } from '../../lib/utils/time';

const { REACT_APP__INDEXER_API = '', PROD } = import.meta.env;

const defaultWidgetOptions: Partial<ChartingLibraryWidgetOptions> = {
  custom_css_url: '/tradingview.css',
  settings_overrides: {
    'paneProperties.backgroundType': 'solid',
    'paneProperties.background': '#101828', // var(--default)
  },
  debug: !PROD,
  autosize: true,
  container: '',
  locale: 'en',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone as Timezone,
  disabled_features: [
    // disable searching for symbols inside chart: token pair search is on page
    'header_symbol_search',
    // disable comparing multiple symbols: can get complicated
    'header_compare',
    // note: the mouse panning feature is called 'chart_scroll'
    //       disabling this ensures that the right side of chart is current time
    //       however this isn't necessary to lock to understand the liquidity
    //       visualization we have added to the right of it
  ],
  enabled_features: ['hide_left_toolbar_by_default'],
  charts_storage_url: 'https://saveload.tradingview.com',
  charts_storage_api_version: '1.1',
  // path to static assets of the charting library
  library_path: '/charting_library/',
  theme: 'dark',
};

interface RequestQuery {
  stream?: 'true';
}

interface PaginationRequestQuery extends RequestQuery {
  // replicated CosmosSDK keys
  offset?: string; // integer
  limit?: string; // integer
}

interface BlockRangeRequestQuery extends RequestQuery {
  // custom query parameters
  from_block_hght?: string; // integer
  to_block_hght?: string; // integer
  from_block_tmstmp?: string; // integer
  to_block_tmstmp?: string; // integer
}

interface TimeSeriesPriceDataRow extends BaseTimeSeriesSSERow {
  high: string;
  low: string;
  open: string;
  close: string;
}

type TimeSeriesResolution = 'second' | 'minute' | 'hour' | 'day' | 'month';

// helper function to ensure that chart is interactable
// note: several chart methods such as chart.getVisiblePriceRange() will throw
//       an exception if the chart exists but is not in a ready state
//       this method should be able to detect is the chart is not in that state
function isChartReady(chart: IChartWidgetApi | undefined) {
  const visibleTimeScaleRange = chart?.getVisibleRange();
  // skip calculation if timescale is not yet visible
  // because otherwise a measurement function will throw an exception
  return (
    visibleTimeScaleRange &&
    visibleTimeScaleRange.from > 0 &&
    visibleTimeScaleRange.to
  );
}

export interface ChartPriceAxisInfo extends VisiblePriceRange {
  mode: PriceScaleMode;
  height: number;
}
export default function OrderBookChart({
  tokenA,
  tokenB,
  priceIndication,
  setPriceAxis,
}: {
  tokenA: Token;
  tokenB: Token;
  priceIndication?: number | undefined;
  setPriceIndication?: React.Dispatch<React.SetStateAction<number | undefined>>;
  setPriceAxis?: React.Dispatch<
    React.SetStateAction<ChartPriceAxisInfo | undefined>
  >;
}) {
  const tokenIdA = getTokenId(tokenA);
  const tokenIdB = getTokenId(tokenB);

  const navigate = useNavigate();

  // find chart container to fit
  const chartRef = useRef<HTMLDivElement>(null);

  // store chart widget when ready
  const [chart, setChart] = useState<IChartWidgetApi>();

  const { data: tokenPairReserves } = useTokenPairs();
  const { data: tokenByDenom } = useTokenByDenom(
    tokenPairReserves?.flatMap(([denom0, denom1]) => [denom0, denom1])
  );

  // memoize tokenPairs so we don't trigger the graph re-rendering too often
  const tokenPairs = useDeepCompareMemoize(
    useMemo<Array<[Token, Token]>>(() => {
      return tokenPairReserves && tokenByDenom
        ? tokenPairReserves
            // find the tokens that match our known pair token IDs
            .map(([denom0, denom1]) => {
              return [tokenByDenom.get(denom0), tokenByDenom.get(denom1)];
            })
            // remove pairs with unfound tokens
            .filter<[Token, Token]>((tokenPair): tokenPair is [Token, Token] =>
              tokenPair.every(Boolean)
            )
        : [];
    }, [tokenByDenom, tokenPairReserves])
  );

  // tokenPairID is made of symbols, which is different to token paths
  const tokenPairID = useMemo(() => {
    if (tokenA && tokenB) {
      return `${tokenA.symbol}/${tokenB.symbol}`;
    }
  }, [tokenA, tokenB]);

  useEffect(() => {
    const supportedResolutions: ResolutionString[] = [
      '1S', // second
      '1', // minute
      '5', // 5 minutes
      '10', // 10 minutes
      '60', // hour
      '1D', // day
    ] as ResolutionString[];

    const resolutionMap: {
      [tradingViewResolution: string]: TimeSeriesResolution;
    } = {
      '1S': 'second', // second
      '1': 'minute', // minute
      '5': 'minute', // minute
      '10': 'minute', // minute
      '60': 'hour', // hour
      '1D': 'day', // day
    };

    const resolutionInMsMap: {
      [tradingViewResolution: string]: number;
    } = {
      '1S': 1 * seconds,
      '1': 1 * minutes,
      '5': 5 * minutes,
      '10': 10 * minutes,
      '60': 1 * hours,
      '1D': 1 * days,
    };

    // keep track of data subscription state here
    type FetchID = string;
    type SubscriberUUID = string;
    const firstBars: Map<FetchID, Bar> = new Map();
    const lastBars: Map<FetchID, Bar> = new Map();
    const streams: Map<
      SubscriberUUID,
      IndexerStreamAccumulateSingleDataSet<
        TimeSeriesPage<TimeSeriesPriceDataRow>,
        TimeSeriesPriceDataRow
      >
    > = new Map();

    const getFetchID = (
      symbolInfo: LibrarySymbolInfo,
      resolution: ResolutionString
    ): FetchID => {
      return JSON.stringify({ name: symbolInfo.name, resolution });
    };
    const getFetchURL = (
      symbolA: string,
      symbolB: string,
      resolution: ResolutionString,
      searchParams?: PaginationRequestQuery & BlockRangeRequestQuery
    ) => {
      const url = new URL(
        `v1/timeseries/price?${[
          `token_a=${encodeURIComponent(symbolA)}`,
          `token_b=${encodeURIComponent(symbolB)}`,
          `resolution=${resolutionMap[`${resolution}`]}`,
        ].join('&')}`,
        `${REACT_APP__INDEXER_API}`
      );

      // add search params into constructed URL
      Object.entries(searchParams || {}).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });

      return url;
    };

    // don't create options unless ID requirements are satisfied
    if (chartRef.current && tokenPairID && tokenIdA && tokenIdB) {
      const datafeed: IBasicDataFeed = {
        onReady: async (onReadyCallback) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          const datafeedConfiguration: DatafeedConfiguration = {
            supports_marks: true,
            supports_timescale_marks: true,
            supports_time: true,
            exchanges: [{ value: 'neutron', name: 'Neutron', desc: 'Neutron' }],
            // these are categories to be able to search on in the searchSymbols callback
            symbols_types: [],
            supported_resolutions: supportedResolutions,
          };
          onReadyCallback(datafeedConfiguration);
        },
        resolveSymbol: (
          symbolName,
          onSymbolResolvedCallback
          // onResolveErrorCallback,
          // extension
        ) => {
          // if not on correct page, go to correct page
          navigate(`/orderbook/${symbolName}`);

          // find symbol information for this page
          const symbolInfo: LibrarySymbolInfo = {
            description: `Pair of ${symbolName}`,
            format: 'price',
            full_name: symbolName,
            exchange: 'Neutron',
            listed_exchange: '',
            minmov: 1,
            name: symbolName,
            pricescale: 1000,
            session: '24x7',
            has_intraday: true,
            supported_resolutions: supportedResolutions,
            timezone: 'Etc/UTC',
            type: 'crypto',
            has_empty_bars: true,
          };
          setTimeout(() => {
            onSymbolResolvedCallback(symbolInfo);
          }, 0);
        },
        searchSymbols: (
          userInput = '',
          _exchange, // will always be "Neutron"
          _symbolType, // will always be "crypto"
          onResultReadyCallback
        ) => {
          const tokens = Array.from(new Set(tokenPairs.flatMap((v) => v)));
          const inputs = userInput.toLowerCase().split('/');
          const filteredTokens = tokens.filter((token) => {
            // return a match if any of the inputs given match a token
            return inputs.some((input) => {
              return (
                token.chain.chain_name.toLowerCase().includes(input) ||
                token.name.toLowerCase().includes(input) ||
                token.base.toLowerCase().includes(input) ||
                token.display.toLowerCase().includes(input) ||
                token.symbol.toLowerCase().includes(input) ||
                token.keywords?.map((v) => v.toLowerCase()).includes(input)
              );
            });
          });

          const items: SearchSymbolResultItem[] = tokenPairs
            .filter(([tokenA, tokenB]) => {
              return (
                filteredTokens.includes(tokenA) ||
                filteredTokens.includes(tokenB)
              );
            })
            .map(([tokenA, tokenB]) => {
              return {
                exchange: 'Neutron Dex',
                symbol: `${tokenA.symbol}/${tokenB.symbol}`,
                full_name: `${tokenA.symbol}/${tokenB.symbol}`,
                description: `Neutron Dex pair of ${tokenA.name} and ${tokenB.name}`,
                type: 'crypto',
              };
            });
          onResultReadyCallback(items);
        },
        getBars: async (
          symbolInfo,
          resolution,
          periodParams,
          onHistoryCallback,
          onErrorCallback
        ) => {
          // construct fetch ID that corresponds to a unique known fetch height
          const fetchID = getFetchID(symbolInfo, resolution);
          const url = getFetchURL(tokenIdA, tokenIdB, resolution, {
            from_block_tmstmp: periodParams.from?.toFixed(0),
            to_block_tmstmp: periodParams.to?.toFixed(0),
            limit: '100',
          });

          const stream = new IndexerStreamAccumulateSingleDataSet<
            TimeSeriesPage<TimeSeriesPriceDataRow>,
            TimeSeriesPriceDataRow,
            Map<TimeSeriesRow[0], TimeSeriesRow[1]>
          >(
            url,
            {
              onCompleted: async (data) => {
                stream.unsubscribe();
                // the API is not strictly ordered: it must be re-sorted
                const sortedData = Array.from(data).sort((a, b) => a[0] - b[0]);
                const bars: Bar[] = sortedData.map(getBarFromTimeSeriesRow);
                // record earliest bar info of this fetch
                const firstBar = bars.at(0);
                if (
                  firstBar &&
                  firstBar.time > (firstBars.get(fetchID)?.time ?? 0)
                ) {
                  firstBars.set(fetchID, firstBar);
                }
                // record most recent bar info of this fetch
                const lastBar = bars.at(-1);
                if (
                  lastBar &&
                  lastBar.time > (lastBars.get(fetchID)?.time ?? 0)
                ) {
                  lastBars.set(fetchID, lastBar);
                }
                // if no bars were received: determine if there are other bars
                // that can be fetched in a subsequent query
                if (!bars.length) {
                  // find the most recent timestamp before a certain timestamp
                  const latestData = await fetchMostRecentDataRowFromTimeseries(
                    getFetchURL(tokenIdA, tokenIdB, resolution, {
                      to_block_tmstmp: periodParams.from?.toFixed(0),
                    })
                  );
                  const previousUnixTimestamp = latestData?.block_tmstmp;
                  // inform the chart that there is more data starting at this
                  // next timestamp (or not): it will adjust the next query
                  return onHistoryCallback(bars, {
                    noData: !previousUnixTimestamp,
                    nextTime: previousUnixTimestamp || null,
                  });
                }
                onHistoryCallback(bars, {
                  // assume there is more data,
                  // on next query: if no data is found it will be handled there
                  noData: false,
                });
              },
              onError: (e) => {
                onErrorCallback(
                  (e as Error)?.message || 'Unknown error occurred'
                );
              },
            },
            {
              disableSSE: true,
              ignoreInitialData404s: true,
              getDataUpdateKey: (dataRow) => dataRow.block_tmstmp,
              getDataUpdateValue: (dataRow) => [
                Number(dataRow.open),
                Number(dataRow.high),
                Number(dataRow.low),
                Number(dataRow.close),
              ],
            }
          );
          streams.set(fetchID, stream);
        },
        subscribeBars: (
          symbolInfo,
          resolution,
          onRealtimeCallback,
          subscriberUID
          // onResetCacheNeededCallback
        ) => {
          const fetchID = getFetchID(symbolInfo, resolution);
          const lastBarTime = lastBars.get(fetchID)?.time;
          const url = getFetchURL(tokenIdA, tokenIdB, resolution, {
            // set start limit in Unix seconds
            from_block_tmstmp: Math.floor(
              (lastBarTime || Date.now()) / 1000
            ).toFixed(0),
          });

          const stream = new IndexerStreamAccumulateSingleDataSet<
            TimeSeriesPage<TimeSeriesPriceDataRow>,
            TimeSeriesPriceDataRow,
            Map<TimeSeriesRow[0], TimeSeriesRow[1]>
          >(
            url,
            {
              onUpdate: (dataUpdates) => {
                let lastBar = lastBars.get(fetchID);
                const resolutionInMs = resolutionInMsMap[resolution];
                // note: the data should be sorted but can be almost-sorted
                const chronologicalUpdates = dataUpdates.sort(
                  (a, b) => a.block_tmstmp - b.block_tmstmp
                );
                for (const row of chronologicalUpdates) {
                  const dataUpdate: TimeSeriesRow = [
                    row.block_tmstmp,
                    [
                      Number(row.open),
                      Number(row.high),
                      Number(row.low),
                      Number(row.close),
                    ],
                  ];
                  const bar = getBarFromTimeSeriesRow(dataUpdate);
                  // add extra empty bars if there would be a gap in time
                  if (lastBar && resolutionInMs) {
                    let lastTimestamp = lastBar.time;
                    while (lastTimestamp + resolutionInMs < bar.time) {
                      lastTimestamp += resolutionInMs;
                      onRealtimeCallback({
                        time: lastTimestamp,
                        open: lastBar.close,
                        high: lastBar.close,
                        low: lastBar.close,
                        close: lastBar.close,
                      });
                    }
                  }
                  // add only bars that are new or updates to last timestamp
                  if (!lastBar || bar.time >= lastBar.time) {
                    onRealtimeCallback(bar);
                  }
                  // record last timestamp (to state, and shortcut in-loop var)
                  lastBar = bar;
                }
                // record last bar to state
                if (lastBar) {
                  lastBars.set(fetchID, lastBar);
                }
              },
              onError: (e) => {
                // eslint-disable-next-line no-console
                console.error('SSE error', e);
              },
            },
            {
              ignoreInitialData404s: !!lastBars.get(fetchID),
              getDataUpdateKey: (dataRow) => dataRow.block_tmstmp,
              getDataUpdateValue: (dataRow) => [
                Number(dataRow.open),
                Number(dataRow.high),
                Number(dataRow.low),
                Number(dataRow.close),
              ],
            }
          );
          streams.set(subscriberUID, stream);
        },
        unsubscribeBars: (subscriberUID) => {
          streams.get(subscriberUID)?.unsubscribe();
          streams.delete(subscriberUID);
        },
      };

      // create options if possible to do so
      const widgetOptions: ChartingLibraryWidgetOptions = {
        ...defaultWidgetOptions,
        container: chartRef.current,
        locale: 'en',
        symbol: tokenPairID,
        // start with minute resolution
        interval: '5' as ResolutionString,
        datafeed,
      };

      // create chart widget
      const tvWidget = new widget(widgetOptions);
      tvWidget.onChartReady(() => {
        // re-apply overrides (somtimes not applied properly)
        if (defaultWidgetOptions.settings_overrides) {
          tvWidget.applyOverrides(defaultWidgetOptions.settings_overrides);
        }
        // store current widget
        setChart(tvWidget.activeChart());
      });

      // return method to cleanup widget and data subscribers
      return () => {
        // remove widget
        setChart(undefined);
        tvWidget.remove();
        // unsubscribe all requests (both getBars and subscribeBars)
        streams.forEach((stream) => {
          stream.unsubscribe();
        });
      };
    }
  }, [navigate, tokenIdA, tokenIdB, tokenPairID, tokenPairs]);

  useEffect(() => {
    if (priceIndication && chart && isChartReady(chart)) {
      const line = chart
        // this function will throw an exception if chart is not ready yet
        .createOrderLine()
        .setPrice(priceIndication)
        .setText('')
        .setQuantity('');
      return () => line.remove();
    }
  }, [chart, priceIndication]);

  const [isFocused, setIsFocused] = useState<boolean>(false);
  const setFocused = useCallback(() => setIsFocused(true), []);
  const setUnfocused = useCallback(() => setIsFocused(false), []);

  useEffect(() => {
    if (chart) {
      const checkChartAxis = () => {
        setPriceAxis?.((chartPriceAxis) => {
          const pane = isChartReady(chart) ? chart?.getPanes()[0] : undefined;
          const rightPriceScale = pane?.getRightPriceScales?.()?.[0];
          // this function will throw an exception if series is not yet visible
          const visiblePriceRange = rightPriceScale?.getVisiblePriceRange?.();
          const newChartPriceAxis: ChartPriceAxisInfo | undefined =
            rightPriceScale && visiblePriceRange
              ? {
                  from: visiblePriceRange.from,
                  to: visiblePriceRange.to,
                  mode: rightPriceScale.getMode(),
                  height: pane.getHeight(),
                }
              : undefined;
          if (
            (chartPriceAxis && !newChartPriceAxis) ||
            (!chartPriceAxis && newChartPriceAxis) ||
            chartPriceAxis?.from !== newChartPriceAxis?.from ||
            chartPriceAxis?.to !== newChartPriceAxis?.to ||
            chartPriceAxis?.mode !== newChartPriceAxis?.mode ||
            chartPriceAxis?.height !== newChartPriceAxis?.height
          ) {
            return newChartPriceAxis;
          }
          return chartPriceAxis;
        });
        timeout = setTimeout(checkChartAxis, isFocused ? 30 : 100);
      };
      let timeout = setTimeout(checkChartAxis, 0);
      return () => clearTimeout(timeout);
    }
  }, [chart, isFocused, setPriceAxis]);

  return (
    <div
      className="trading-view-chart flex"
      ref={chartRef}
      onMouseEnter={setFocused}
      onMouseLeave={setUnfocused}
    ></div>
  );
}

function getBarFromTimeSeriesRow([
  unixTimestamp,
  [open, high, low, close],
]: TimeSeriesRow) {
  return {
    time: unixTimestamp * 1000,
    open: tickIndexToPrice(new BigNumber(open)).toNumber(),
    high: tickIndexToPrice(new BigNumber(high)).toNumber(),
    low: tickIndexToPrice(new BigNumber(low)).toNumber(),
    close: tickIndexToPrice(new BigNumber(close)).toNumber(),
  };
}
