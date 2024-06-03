import BigNumber from 'bignumber.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  widget,
  IBasicDataFeed,
  ChartingLibraryWidgetOptions,
  DatafeedConfiguration,
  ResolutionString,
  LibrarySymbolInfo,
  Bar,
  Timezone,
  VisiblePriceRange,
  PriceScaleMode,
  IChartWidgetApi,
  CrossHairMovedEventParams,
} from 'charting_library';

import { Token, getTokenId } from '../../lib/web3/utils/tokens';

import { tickIndexToPrice } from '../../lib/web3/utils/ticks';
import { TimeSeriesRow } from '../../components/stats/utils';
import {
  IndexerPage,
  IndexerStreamAccumulateSingleDataSet,
} from '../../lib/web3/hooks/useIndexer';

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
  'pagination.key'?: string; // base64 string key
  'pagination.offset'?: string; // integer
  'pagination.limit'?: string; // integer
  'pagination.count_total'?: 'true'; // boolean
  // custom
  'pagination.before'?: string; // unix timestamp
  'pagination.after'?: string; // unix timestamp
}

interface BlockRangeRequestQuery extends RequestQuery {
  // custom query parameters
  'block_range.from_height'?: string; // integer
  'block_range.to_height'?: string; // integer
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
  setLimitPrice,
  setPriceAxis,
}: {
  tokenA: Token;
  tokenB: Token;
  priceIndication?: number | undefined;
  setPriceIndication?: React.Dispatch<React.SetStateAction<number | undefined>>;
  setLimitPrice?: (limitPrice: string) => void;
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

  // tokenPairID is made of symbols, which is different to token paths
  const tokenPairID = useMemo(() => {
    if (tokenA && tokenB) {
      return `${tokenB.symbol}/${tokenA.symbol}`;
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

    // keep track of data subscription state here
    type FetchID = string;
    type SubscriberUUID = string;
    const firstBars: Map<FetchID, Bar> = new Map();
    const lastBars: Map<FetchID, Bar> = new Map();
    const knownHeights: Map<FetchID, number> = new Map();
    const streams: Map<
      SubscriberUUID,
      IndexerStreamAccumulateSingleDataSet<TimeSeriesRow>
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
        `${REACT_APP__INDEXER_API}/timeseries/price/${encodeURIComponent(
          symbolB
        )}/${encodeURIComponent(symbolA)}${
          resolutionMap[`${resolution}`]
            ? `/${resolutionMap[`${resolution}`]}`
            : ''
        }`
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
          _userInput,
          _exchange, // will always be "Neutron"
          _symbolType, // will always be "crypto"
          onResultReadyCallback
        ) => {
          onResultReadyCallback([]);
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
            'pagination.before': periodParams.to?.toFixed(0),
            'pagination.after': periodParams.from?.toFixed(0),
          });

          const stream =
            new IndexerStreamAccumulateSingleDataSet<TimeSeriesRow>(
              url,
              {
                onCompleted: async (data, height) => {
                  stream.unsubscribe();
                  if (height > (knownHeights.get(fetchID) ?? 0)) {
                    knownHeights.set(fetchID, height);
                  }
                  // note: the data needs to be in chronological order
                  // and our API delivers results in reverse-chronological order
                  const bars: Bar[] = Array.from(data)
                    .reverse()
                    .map(getBarFromTimeSeriesRow);
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
                    const previousDataURL = getFetchURL(
                      tokenIdA,
                      tokenIdB,
                      resolution,
                      {
                        'pagination.before': periodParams.from?.toFixed(0),
                        'pagination.limit': '1',
                      }
                    );
                    const previousData: IndexerPage<TimeSeriesRow> =
                      await fetch(previousDataURL).then((response) =>
                        response.json()
                      );
                    const previousUnixTimestamp = previousData.data[0]?.[0];
                    // inform the chart that there is more data starting at this
                    // next timestamp (or not): it will adjust the next query
                    return onHistoryCallback(bars, {
                      noData: !previousUnixTimestamp,
                      nextTime: previousUnixTimestamp || null,
                    });
                  }
                  onHistoryCallback(bars);
                },
                onError: (e) => {
                  onErrorCallback(
                    (e as Error)?.message || 'Unknown error occurred'
                  );
                },
              },
              { disableSSE: true }
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
          const url = getFetchURL(tokenIdA, tokenIdB, resolution, {
            'block_range.from_height': knownHeights.get(fetchID)?.toFixed(0),
          });

          const stream =
            new IndexerStreamAccumulateSingleDataSet<TimeSeriesRow>(url, {
              onUpdate: (dataUpdates) => {
                let lastBar = lastBars.get(fetchID);
                // note: the data needs to be in chronological order
                // and our API delivers results in reverse-chronological order
                const chronologicalUpdates = dataUpdates.slice().reverse();
                for (const row of chronologicalUpdates) {
                  const bar = getBarFromTimeSeriesRow(row);
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
            });
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

        const chart = tvWidget.activeChart();

        // track chart onClick price
        if (setLimitPrice) {
          let crosshair: CrossHairMovedEventParams | undefined;
          let lastMouseDownAt: number = 0;
          chart.crossHairMoved().subscribe(null, (e) => (crosshair = e));
          tvWidget.subscribe(
            'mouse_down',
            () => (lastMouseDownAt = Date.now())
          );
          tvWidget.subscribe('mouse_up', () => {
            if (Date.now() - lastMouseDownAt < 100) {
              if (crosshair?.price) {
                setLimitPrice?.(new BigNumber(crosshair.price).toPrecision(6));
              }
            }
          });
        }

        // store current widget
        setChart(chart);
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
  }, [navigate, setLimitPrice, tokenIdA, tokenIdB, tokenPairID]);

  useEffect(() => {
    if (priceIndication && chart && isChartReady(chart)) {
      const line = chart
        // this function will throw an exception if chart is not ready yet
        .createOrderLine()
        .setLineColor('white')
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
      return () => {
        clearTimeout(timeout);
        // remove chart axis when chart is removed
        if (!isChartReady(chart)) {
          setPriceAxis?.(undefined);
        }
      };
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
