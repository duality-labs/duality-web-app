import BigNumber from 'bignumber.js';
import { useEffect, useMemo, useRef } from 'react';
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
} from '@tradingview/charting-library';

import { Token } from '../../lib/web3/utils/tokens';

import useTokens, {
  matchTokenByAddress,
  useTokensWithIbcInfo,
} from '../../lib/web3/hooks/useTokens';
import useTokenPairs from '../../lib/web3/hooks/useTokenPairs';
import { tickIndexToPrice } from '../../lib/web3/utils/ticks';
import { TimeSeriesRow } from '../../components/stats/utils';
import { IndexerStreamAccumulateSingleDataSet } from '../../lib/web3/hooks/useIndexer';

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
  // path to static assets of the charting library
  library_path: '/charting_library/',
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

  // find chart container to fit
  const chartRef = useRef<HTMLDivElement>(null);

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

    // keep track of data subscription state here
    type FetchID = string;
    type SubscriberUUID = string;
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
      searchParams?: Record<string, string>
    ) => {
      const url = new URL(
        `${REACT_APP__INDEXER_API}/timeseries/price/${symbolA}/${symbolB}${
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

    const datafeed: IBasicDataFeed = {
      onReady: async (onReadyCallback) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        const datafeedConfiguration: DatafeedConfiguration = {
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
        // if not on correct page, go to correct page
        navigate(`/orderbook/${symbolName}`);

        // find symbol information for this page
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
      searchSymbols: (
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
              symbol: `${tokenA.symbol}/${tokenB.symbol}`,
              full_name: `${tokenA.symbol}/${tokenB.symbol}`,
              description: `Duality Dex pair of ${tokenA.name} and ${tokenB.name}`,
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
        const searchParams: PaginationRequestQuery = {
          'pagination.before': periodParams.to?.toFixed(0),
          'pagination.after': periodParams.from?.toFixed(0),
        };
        const url = getFetchURL(
          tokenAPath,
          tokenBPath,
          resolution,
          // remove `undefined` properties using JSON.stringify
          JSON.parse(JSON.stringify(searchParams))
        );

        const stream = new IndexerStreamAccumulateSingleDataSet<TimeSeriesRow>(
          url,
          {
            onCompleted: (data, height) => {
              stream.unsubscribe();
              knownHeights.set(fetchID, height);
              const bars: Bar[] = Array.from(data)
                // note: the data needs to be in chronological order
                // and our API delivers results in reverse-chronological order
                .reverse()
                .map(getBarFromTimeSeriesRow);
              onHistoryCallback(bars, { noData: !bars.length });
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
        subscriberUID,
        onResetCacheNeededCallback
      ) => {
        const fetchID = getFetchID(symbolInfo, resolution);

        const searchParams: BlockRangeRequestQuery = {
          'block_range.from_height': knownHeights.get(fetchID)?.toFixed(0),
        };
        const url = getFetchURL(
          tokenAPath,
          tokenBPath,
          resolution,
          // remove `undefined` properties using JSON.stringify
          JSON.parse(JSON.stringify(searchParams))
        );

        const stream = new IndexerStreamAccumulateSingleDataSet<TimeSeriesRow>(
          url,
          {
            onUpdate: (dataUpdates) => {
              // note: the data needs to be in chronological order
              // and our API delivers results in reverse-chronological order
              const chronologicalUpdates = dataUpdates.reverse();
              for (const row of chronologicalUpdates) {
                onRealtimeCallback(getBarFromTimeSeriesRow(row));
              }
            },
            onError: (e) => {
              // eslint-disable-next-line no-console
              console.error('SSE error', e);
            },
          }
        );
        streams.set(subscriberUID, stream);
      },
      unsubscribeBars: (subscriberUID) => {
        streams.get(subscriberUID)?.unsubscribe();
        streams.delete(subscriberUID);
      },
    };

    if (chartRef.current && tokenPairID) {
      // create options if possible to do so
      const widgetOptions: ChartingLibraryWidgetOptions = {
        ...defaultWidgetOptions,
        container: chartRef.current,
        locale: 'en',
        symbol: tokenPairID,
        // start with minute resolution
        interval: '1' as ResolutionString,
        datafeed,
      };

      // create chart widget
      const tvWidget = new widget(widgetOptions);

      // return method to cleanup widget and data subscribers
      return () => {
        // remove widget
        tvWidget.remove();
        // unsubscribe all requests (both getBars and subscribeBars)
        streams.forEach((stream) => {
          stream.unsubscribe();
        });
      };
    }
  }, [navigate, tokenAPath, tokenBPath, tokenPairID, tokenPairs]);

  return <div className="trading-view-chart flex" ref={chartRef}></div>;
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
