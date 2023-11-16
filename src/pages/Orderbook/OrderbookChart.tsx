import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  widget,
  IBasicDataFeed,
  ChartingLibraryWidgetOptions,
  DatafeedConfiguration,
  LanguageCode,
  ResolutionString,
  TradingTerminalWidgetOptions,
  LibrarySymbolInfo,
  SearchSymbolResultItem,
  Bar,
} from '@tradingview/charting-library';

import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';

import { Token } from '../../lib/web3/utils/tokens';

import useTokens, {
  matchTokenByAddress,
  useTokensWithIbcInfo,
} from '../../lib/web3/hooks/useTokens';
import useTokenPairs from '../../lib/web3/hooks/useTokenPairs';
import useResizeObserver from '@react-hook/resize-observer';
import useDeepCompareEffect, {
  useDeepCompareMemoize,
} from 'use-deep-compare-effect';
import { IDatafeedChartApi } from '@tradingview/charting-library/charting_library/datafeed-api';
import { TimeSeriesPage, TimeSeriesRow } from '../../components/stats/utils';
import {
  tickIndexToDisplayPrice,
  tickIndexToPrice,
} from '../../lib/web3/utils/ticks';
import BigNumber from 'bignumber.js';
import { useNavigate } from 'react-router-dom';

const { REACT_APP__INDEXER_API = '', NODE_ENV = 'production' } = process.env;

const defaultWidgetOptions: Partial<ChartingLibraryWidgetOptions> = {
  debug: NODE_ENV !== 'production',
  autosize: true,
  container: '',
  locale: 'en',
  disabled_features: ['use_localstorage_for_settings'],
  enabled_features: ['study_templates'],
  charts_storage_url: 'https://saveload.tradingview.com',
  charts_storage_api_version: '1.1',

  library_path: '/charting_library/',
  studies_overrides: {},
};

// const widget = new widget({
//   ...defaultWidgetOptions,
// });

const datafeed: IBasicDataFeed = {
  onReady: async (onReadyCallback) => {
    console.log('[onReady]: Method call');
    await new Promise((resolve) => setTimeout(resolve, 1));
    const datafeedConfiguration: DatafeedConfiguration = {
      // supports_search: true,
      // supports_group_request: false,
      supports_marks: true,
      supports_timescale_marks: true,
      supports_time: true,
      exchanges: [{ value: 'duality', name: 'Duality', desc: 'Duality' }],
      symbols_types: [
        { name: 'All types', value: '' },
        { name: 'Stock', value: 'stock' },
        { name: 'Index', value: 'index' },
      ],
      supported_resolutions: [
        '1S',
        '1',
        '60',
        '1D',
        '2D',
        '3D',
        'W',
        '3W',
        'M',
        '6M',
      ] as ResolutionString[],
    };

    onReadyCallback(datafeedConfiguration);
  },
  searchSymbols: (userInput, exchange, symbolType, onResultReadyCallback) => {
    console.log('[searchSymbols]: Method call');
  },
  resolveSymbol: (
    symbolName,
    onSymbolResolvedCallback,
    onResolveErrorCallback,
    extension
  ) => {
    console.log('[resolveSymbol]: Method call', symbolName);
  },
  getBars: (
    symbolInfo,
    resolution,
    periodParams,
    onHistoryCallback,
    onErrorCallback
  ) => {
    console.log('[getBars]: Method call', symbolInfo);
  },
  subscribeBars: (
    symbolInfo,
    resolution,
    onRealtimeCallback,
    subscriberUID,
    onResetCacheNeededCallback
  ) => {
    console.log(
      '[subscribeBars]: Method call with subscriberUID:',
      subscriberUID
    );
  },
  unsubscribeBars: (subscriberUID) => {
    console.log(
      '[unsubscribeBars]: Method call with subscriberUID:',
      subscriberUID
    );
  },
};

const chartOptions: ApexOptions = {
  title: {
    text: '',
    align: 'left',
  },
  xaxis: {
    decimalsInFloat: 1,
    type: 'datetime',
    title: {
      text: 'Time',
    },
  },
  yaxis: {
    decimalsInFloat: 1,
    tooltip: {
      enabled: true,
    },
    title: {
      text: '',
    },
  },
  theme: {
    mode: 'dark',
  },
  chart: {
    background: '#1f2b37',
  },
  plotOptions: {
    candlestick: {
      colors: {
        upward: '#31C48D',
        downward: '#F05252',
      },
      wick: {
        useFillColor: true,
      },
    },
  },
  tooltip: {
    z: {
      formatter(val) {
        return Number(val).toFixed(2);
      },
    },
  },
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

export default function OrderBookChart({
  tokenA,
  tokenB,
}: {
  tokenA: Token;
  tokenB: Token;
}) {
  const tokenAPath = tokenA.address;
  const tokenBPath = tokenB.address;

  const navigate = useNavigate();

  // find container size to fit
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

  // redraw canvas when the screen size changes
  useResizeObserver(chartContainerRef, (container) =>
    setChartSize({
      width: container.contentRect.width,
      height: container.contentRect.height,
    })
  );

  const [, setWidgetOptions] = useState<ChartingLibraryWidgetOptions>();

  const tokenList = useTokensWithIbcInfo(useTokens());
  const { data: tokenPairAddresses } = useTokenPairs();
  // memoize tokenPairs so we don't trigger the graph re-rendering too often
  const tokenPairs = useDeepCompareMemoize(
    useMemo<Array<[Token, Token]>>(() => {
      return tokenPairAddresses
        ? tokenPairAddresses
            // find the tokens that match our known pair token addresses
            .map(([token0, token1]) => {
              return [
                tokenList.find(matchTokenByAddress(token0)),
                tokenList.find(matchTokenByAddress(token1)),
              ];
            })
            // remove pairs with unfound tokens
            .filter<[Token, Token]>((tokenPair): tokenPair is [Token, Token] =>
              tokenPair.every(Boolean)
            )
        : [];
    }, [tokenList, tokenPairAddresses])
  );

  const tokenPairID = useMemo(() => {
    if (tokenA && tokenB) {
      return `${tokenA.symbol}/${tokenB.symbol}`;
    }
  }, [tokenA, tokenB]);

  useEffect(() => {
    console.log('tokenList', tokenList);
  }, [tokenList]);
  useEffect(() => {
    console.log('tokenPairs', tokenPairs);
  }, [tokenPairs]);
  useEffect(() => {
    console.log('stringify tokenPairs', tokenPairs);
  }, [JSON.stringify(tokenPairs)]);
  useEffect(() => {
    console.log('tokenPairAddresses', tokenPairAddresses);
  }, [tokenPairAddresses]);
  useEffect(() => {
    console.log('tokenPairID', tokenPairID);
  }, [tokenPairID]);

  const searchSymbols = useCallback<IDatafeedChartApi['searchSymbols']>(
    (
      userInput = '',
      exchange, // will always be "Duality"
      symbolType, // will always be "crypto"
      onResultReadyCallback
    ) => {
      const tokens = Array.from(new Set(tokenPairs.flatMap((v) => v)));
      const input = userInput.toLowerCase();
      const filteredTokens = tokens.filter((token) => {
        return (
          token.chain.chain_name.toLowerCase().includes(input) ||
          token.name.toLowerCase().includes(input) ||
          token.base.toLowerCase().includes(input) ||
          token.display.toLowerCase().includes(input) ||
          token.symbol.toLowerCase().includes(input) ||
          token.keywords?.map((v) => v.toLowerCase()).includes(input)
        );
      });

      const items: SearchSymbolResultItem[] = tokenPairs
        .filter(([tokenA, tokenB]) => {
          return (
            filteredTokens.includes(tokenA) || filteredTokens.includes(tokenB)
          );
        })
        .map(([tokenA, tokenB]) => {
          return {
            exchange: 'Duality Dex',
            symbol: `${tokenA.symbol}<>${tokenB.symbol}`,
            full_name: `${tokenA.symbol}/${tokenB.symbol}`,
            description: `Duality Dex pair of ${tokenA.name} and ${tokenB.name}`,
            type: 'crypto',
          };
        });
      onResultReadyCallback(items);
    },
    [tokenPairs]
  );

  useEffect(() => {
    const supportedResolutions: ResolutionString[] = [
      '1S', // second
      '1', // minute
      '60', // hour
      '1D', // day
    ] as ResolutionString[];

    const resolutionMap: {
      [tradingViewResolution: string]: TimeSeriesResolution;
    } = {
      '1S': 'second', // second
      '1': 'minute', // minute
      '60': 'hour', // hour
      '1D': 'day', // day
    };

    // todo: plan
    //   - short poll on getBars (or stream to current height)
    //   - stream on subscribe bars, save AbortController to useEffect context
    //   - on unsubscribe, the Abort the current request
    // let lastKnownHeight = 0;
    const knownHeights: Map<string, number> = new Map();
    const subscribers: Map<string, AbortController> = new Map();
    // const initialFetchControllers: Array<AbortController> = [];
    // let abortController: AbortController | undefined;
    // const setAbortController = (newAbortController?: AbortController) => {
    //   abortController?.abort();
    //   abortController = newAbortController;
    // }

    const getFetchID = (
      symbolInfo: LibrarySymbolInfo,
      resolution: ResolutionString
    ) => {
      return JSON.stringify({ name: symbolInfo.name, resolution });
    };
    const getFetchURL = (
      symbolInfo: LibrarySymbolInfo,
      resolution: ResolutionString,
      searchParams?:
        | string
        | URLSearchParams
        | string[][]
        | Record<string, string>
        | undefined
    ) => {
      const url = new URL(
        `${REACT_APP__INDEXER_API}/timeseries/price/${symbolInfo.name}${
          resolutionMap[`${resolution}`]
            ? `/${resolutionMap[`${resolution}`]}`
            : ''
        }`
      );

      // add search params into constructed URL
      new URLSearchParams(searchParams).forEach((value, key) => {
        if (value !== undefined) {
          url.searchParams.append(key, value);
        }
      });

      return url;
    };

    // let pollTimeout = 0;
    const datafeed: IBasicDataFeed = {
      onReady: async (onReadyCallback) => {
        console.log('[onReady]: Method call');
        await new Promise((resolve) => setTimeout(resolve, 1));
        const datafeedConfiguration: DatafeedConfiguration = {
          // supports_search: true,
          // supports_group_request: false,
          supports_marks: true,
          supports_timescale_marks: true,
          supports_time: true,
          exchanges: [{ value: 'duality', name: 'Duality', desc: 'Duality' }],
          // these are categories to be able to search on in the searchSymbols callback
          symbols_types: [],
          supported_resolutions: supportedResolutions,
        };
        onReadyCallback(datafeedConfiguration);
      },
      resolveSymbol: (
        symbolName,
        onSymbolResolvedCallback,
        onResolveErrorCallback,
        extension
      ) => {
        console.log('[resolveSymbol]: Method call', symbolName, extension);
        // do stuff here
        navigate(`/orderbook/${symbolName}`);

        const symbolInfo: LibrarySymbolInfo = {
          description: `Pair of ${symbolName}`,
          format: 'price',
          full_name: symbolName,
          exchange: 'Duality',
          listed_exchange: '',
          minmov: 1,
          name: symbolName,
          pricescale: 1000,
          session: '24x7',
          has_intraday: true,
          supported_resolutions: supportedResolutions,
          timezone: 'Etc/UTC',
          type: 'crypto',
        };
        setTimeout(() => {
          onSymbolResolvedCallback(symbolInfo);
        }, 0);
      },
      searchSymbols,
      getBars: async (
        symbolInfo,
        resolution,
        periodParams,
        onHistoryCallback,
        onErrorCallback
      ) => {
        console.log(
          '[getBars]: Method call',
          symbolInfo,
          resolution,
          periodParams
        );
        // construct fetch ID that corresponds to a unique known fetch height
        const fetchID = getFetchID(symbolInfo, resolution);
        // track requests with abort controller
        const abortController = new AbortController();
        subscribers.set(fetchID, abortController);
        // initialFetchControllers.push(abortController);
        await new Promise<TimeSeriesRow[]>(async (resolve, reject) => {
          try {
            let next = '';
            const timeseries = [];
            do {
              const searchParams: PaginationRequestQuery = {
                'pagination.before': periodParams.to?.toFixed(0),
                'pagination.after': periodParams.from?.toFixed(0),
                'pagination.key': next || undefined,
              };
              const url = getFetchURL(
                symbolInfo,
                resolution,
                Object.entries(searchParams)
              );

              const surl = `${REACT_APP__INDEXER_API}/timeseries/price/${tokenAPath}/${tokenBPath}${
                resolutionMap[`${resolution}`]
                  ? `/${resolutionMap[`${resolution}`]}`
                  : ''
              }${
                Object.values(searchParams).length
                  ? `?${new URLSearchParams(
                      JSON.parse(JSON.stringify(searchParams)) as Record<
                        string,
                        string
                      >
                    )}`
                  : ''
              }`;
              console.log('searchParams', searchParams);
              console.log('surl', surl.toString());
              console.log('url', url.toString());
              const response = await fetch(url.toString(), {
                signal: abortController.signal,
              });
              const {
                data = [],
                pagination = {},
                block_range: range,
              } = (await response.json()) as TimeSeriesPage;
              // add data into current context
              // note: the data needs to be in chronological order
              // and our API delivers results in reverse-chronological order
              timeseries.unshift(...data.reverse());
              // set known height for subscribers
              if (range.to_height > (knownHeights.get(fetchID) ?? 0)) {
                knownHeights.set(fetchID, range.to_height);
              }
              // fetch again if necessary
              next = pagination['next_key'] || '';
            } while (next);
            // if (!periodParams.firstDataRequest) {
            //   console.log('not first timeseries', timeseries)
            //   throw new Error('Not first request');
            // }
            resolve(timeseries);
          } catch (e) {
            // if (abortController.signal?.aborted) {
            //   reject(abortController.signal?.reason);
            // }
            // else {
              reject(e);
            // }
          }
        })
          .then((timeseries) => {
            console.log('timeseries', timeseries);
            const bars: Bar[] = timeseries.map(
              ([unixTimestamp, [open, high, low, close]]) => {
                return {
                  time: unixTimestamp * 1000,
                  open: tickIndexToPrice(new BigNumber(open)).toNumber(),
                  high: tickIndexToPrice(new BigNumber(high)).toNumber(),
                  low: tickIndexToPrice(new BigNumber(low)).toNumber(),
                  close: tickIndexToPrice(new BigNumber(close)).toNumber(),
                };
              }
            );
            console.log('----- set bars ------', bars);
            //  start here
            // note: I think I might need to fill out *all* the expected bars: i.e. 301 bars
            onHistoryCallback(bars, { noData: !bars.length });
          })
          .catch((e) => {
            console.log('e', e);
            onErrorCallback((e as Error)?.message || 'Unknown error occurred');
          });
        // clean up abort controller
        subscribers.delete(fetchID);
      },
      subscribeBars: (
        symbolInfo,
        resolution,
        onRealtimeCallback,
        subscriberUID,
        onResetCacheNeededCallback
      ) => {
        const fetchID = getFetchID(symbolInfo, resolution);

        const searchParams: BlockRangeRequestQuery = {
          'block_range.from_height': knownHeights.get(fetchID)?.toFixed(0),
          stream: 'true',
        };
        const url = getFetchURL(
          symbolInfo,
          resolution,
          Object.entries(searchParams)
        );

        const eventSource = new EventSource(url);
        const update = (e: MessageEvent<TimeSeriesRow>) => {
          console.log('PriceDataRow', e.data);
        };

        // listen for updates
        eventSource.addEventListener('update', update);
        // create a fake AbortController to abort this request like with `fetch`
        const abortController: AbortController = {
          // signal: {
          //   prototype: AbortSignal,
          //   new() {},
          // },
          abort: () => eventSource.close(),
        };
        subscribers.set(subscriberUID, abortController);

        console.log(
          '[subscribeBars]: Method call with subscriberUID:',
          subscriberUID
        );
        // onRealtimeCallback()
      },
      unsubscribeBars: (subscriberUID) => {
        subscribers.get(subscriberUID)?.abort();
        subscribers.delete(subscriberUID);
        console.log(
          '[unsubscribeBars]: Method call with subscriberUID:',
          subscriberUID
        );
      },
    };

    if (chartRef.current && tokenPairID) {
      // create options if possible to do so
      const widgetOptions: ChartingLibraryWidgetOptions = {
        ...defaultWidgetOptions,
        height: 400,
        // height: chartSize.height,
        // width: chartSize.width,
        container: chartRef.current,
        locale: 'en',
        symbol: tokenPairID,
        interval: '1' as ResolutionString,
        datafeed,

        // // demo
        // datafeed: new window.Datafeeds.UDFCompatibleDatafeed(defaultProps.datafeedUrl), 'https://demo_feed.tradingview.com',
        // client_id: 'tradingview.com',
        // user_id: 'public_user_id',
      };

      // create chart widget
      const tvWidget = new widget(widgetOptions);

      // create chart on container
      console.log('waiting for tvWidget.onChartReady ...');
      tvWidget.onChartReady(() => {
        console.log('waiting for tvWidget.headerReady ...');
        tvWidget.headerReady().then(() => {
          console.log('creating a button somehow? ...');
          const button = tvWidget.createButton();
          button.setAttribute('title', 'Click to show a notification popup');
          button.classList.add('apply-common-tooltip');
          button.addEventListener('click', () =>
            tvWidget.showNoticeDialog({
              title: 'Notification',
              body: 'TradingView Charting Library API works correctly',
              callback: () => {
                console.log('Noticed!');
              },
            })
          );
          button.innerHTML = 'Check API';
        });

        tvWidget.subscribe('toggle_header', (...args) =>
          console.log('layout_changed', args)
        );
      });

      // const url = `${REACT_APP__INDEXER_API}/timeseries/price/${tokenAPath}/${tokenBPath}${
      //   resolutionMap[`${resolution}`]
      //     ? `/${resolutionMap[`${resolution}`]}`
      //     : ''
      // }?pagination.limit=1`;

      // const evtSource = new EventSource("//api.example.com/ssedemo.php", {
      //   withCredentials: true,
      // });

      // return options so they aren't recreated again
      return () => {
        // remove widget
        tvWidget.remove();
        // unsubscribe all requests (both getBars and subscribeBars)
        subscribers.forEach((subscriber) => {
          subscriber.abort();
        });
      };
    }
  }, [searchSymbols, tokenAPath, tokenBPath, tokenPairID]);

  useEffect(() => console.log('chartSize', chartSize), [chartSize]);
  useEffect(() => console.log('tokenA.symbol', tokenA.symbol), [tokenA.symbol]);
  useEffect(() => console.log('tokenB.symbol', tokenB.symbol), [tokenB.symbol]);

  return <div className="trading-view-chart flex" ref={chartRef}></div>;
}
