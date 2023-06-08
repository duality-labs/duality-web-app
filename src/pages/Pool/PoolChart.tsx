import BigNumber from 'bignumber.js';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ReactNode, useEffect, useMemo, useState } from 'react';

import BarChart from '../../components/charts/BarChart';
import ButtonGroup from '../../components/ButtonGroup/ButtonGroup';

import { days, hours, weeks } from '../../lib/utils/time';
import { Token, getTokenValue } from '../../lib/web3/utils/tokens';
import { useSimplePrice } from '../../lib/tokenPrices';
import {
  TimeSeriesPage,
  TimeSeriesRow,
  TokenValue,
  formatStatPercentageValue,
  formatStatTokenValue,
} from '../../components/stats/utils';

import './PoolChart.scss';
import { tickIndexToPrice } from '../../lib/web3/utils/ticks';

const { REACT_APP__INDEXER_API = '' } = process.env;

const timePeriodKeys: TimePeriodKey[] = ['24H', '1W', '1M', '1Y', 'ALL'];

type TimePeriodKey = '24H' | '1W' | '1M' | '1Y' | 'ALL';
type DataResolution = 'second' | 'minute' | 'hour' | 'day' | 'month';

const chartKeys = ['TVL', 'Volume', 'Fees', 'Volatility'] as const;

export default function PoolChart({
  tokenA,
  tokenB,
}: {
  tokenA: Token;
  tokenB: Token;
}) {
  const [chartIndex, setChartIndex] = useState<number>(0);
  const [timePeriodIndex, setTimePeriodIndex] = useState<number>(0);

  return (
    <div className="pool-chart-area chart-area">
      <div className="chart__nav flex row">
        <div className="chart__nav-left row gap-5">
          {chartKeys.map((chartKey, index) => {
            return (
              <button
                key={index}
                className={['pb-4 px-0', index === chartIndex && 'active']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setChartIndex(index)}
              >
                {chartKey}
              </button>
            );
          })}
        </div>
        <div className="chart__nav-right ml-auto">
          <ButtonGroup
            buttonGroup={timePeriodKeys}
            tabIndex={timePeriodIndex}
            setTabIndex={setTimePeriodIndex}
          />
        </div>
      </div>
      {chartKeys[chartIndex] === 'TVL' ? (
        // plot line chart type
        <PoolBarChart
          tokenA={tokenA}
          tokenB={tokenB}
          chartKey={chartKeys[chartIndex]}
          timePeriodKey={timePeriodKeys[timePeriodIndex]}
        />
      ) : (
        // plot bar chart type
        <PoolBarChart
          tokenA={tokenA}
          tokenB={tokenB}
          chartKey={chartKeys[chartIndex]}
          timePeriodKey={timePeriodKeys[timePeriodIndex]}
        />
      )}
    </div>
  );
}

function getPaginationLimit(timePeriodKey: TimePeriodKey): number | undefined {
  // add time restriction
  const now = Date.now();
  switch (timePeriodKey) {
    case '24H':
      return now - hours * 24;
    case '1W':
      return now - weeks * 1;
    case '1M':
      return now - weeks * 4;
    case '1Y':
      return now - days * 365;
  }
}

function getDataResolution(
  timePeriodKey: TimePeriodKey
): DataResolution | undefined {
  switch (timePeriodKey) {
    case '24H':
      return 'minute';
    case '1W':
      return 'hour';
    case '1M':
      return 'day';
    case '1Y':
      return 'day';
  }
}

export function useTimeSeriesData(
  tokenA: Token,
  tokenB: Token,
  timePeriodKey: TimePeriodKey,
  getIndexerPath: (tokenA: Token, tokenB: Token) => string,
  getValues?: (values: number[]) => number[]
) {
  const resolution = getDataResolution(timePeriodKey) || 'day';
  const indexerPath = getIndexerPath(tokenA, tokenB);
  const {
    data: resultData,
    error,
    isFetching,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: [indexerPath, resolution],
    queryFn: async ({ pageParam: pageKey }): Promise<TimeSeriesPage> => {
      const queryParams = new URLSearchParams();
      if (pageKey) {
        queryParams.append('pagination.key', pageKey);
      } else {
        // add time restriction
        const startTimeMs = getPaginationLimit(timePeriodKey);
        if (startTimeMs) {
          queryParams.append(
            'pagination.after',
            (startTimeMs / 1000).toFixed(0)
          );
        }
      }
      const query = queryParams.toString() ? `?${queryParams}` : '';
      const response = await fetch(
        `${REACT_APP__INDEXER_API}/${indexerPath}/${resolution}${query}`
      );
      return await response.json();
    },
    defaultPageParam: '',
    getNextPageParam: (lastPage: TimeSeriesPage) => {
      const nextKey = lastPage?.pagination?.next_key;
      return nextKey ? nextKey : undefined;
    },
  });

  // fetch more data if data has changed but there are still more pages to get
  useEffect(() => {
    if (fetchNextPage && hasNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, resultData, hasNextPage]);

  // collect page data together
  return useMemo<TimeSeriesRow[] | null | undefined>(() => {
    const { pages } = resultData || {};
    // return error state as null
    if (error) {
      return null;
    }
    if (!pages) {
      if (!isFetching) {
        return undefined;
      }
      return pages;
    }
    // return success state as loading or data
    return pages && getValues
      ? pages?.flatMap<TimeSeriesRow>(({ data: rows = [] }) =>
          rows.map<TimeSeriesRow>(([timeUnix, values]) => [
            timeUnix,
            getValues(values),
          ])
        )
      : pages?.flatMap<TimeSeriesRow>(({ data: rows = [] }) =>
          rows.map<TimeSeriesRow>(([timeUnix, values]) => [timeUnix, values])
        );
  }, [resultData, isFetching, error, getValues]);
}

// if data is in the form [timeUnix, [amountA, amountB]]
// then transform the data using price data to [timeUnix, [valueA, valueB]]
export function useTimeSeriesTokenValues(
  tokenA: Token,
  tokenB: Token,
  timePeriodKey: TimePeriodKey,
  getIndexerPath: (tokenA: Token, tokenB: Token) => string,
  getValues?: (values: number[]) => number[]
): TimeSeriesRow[] | null | undefined {
  const data = useTimeSeriesData(
    tokenA,
    tokenB,
    timePeriodKey,
    getIndexerPath,
    getValues
  );
  const {
    data: [priceA, priceB],
  } = useSimplePrice([tokenA, tokenB]);

  return useMemo(() => {
    if (!data) {
      return data;
    }
    if (priceA === undefined || priceB === undefined) {
      return undefined;
    }

    return data.map<TimeSeriesRow>(([timeUnix, [amountA, amountB]]) => {
      return [
        timeUnix,
        [
          getTokenValue(tokenA, amountA, priceA) || 0,
          getTokenValue(tokenB, amountB, priceB) || 0,
        ],
      ];
    });
  }, [tokenA, tokenB, priceA, priceB, data]);
}

function getTimeSeriesTvlPath(tokenA: Token, tokenB: Token): string {
  return `timeseries/tvl/${tokenA.address}/${tokenB.address}`;
}
function getStatTvlValues([amountA, amountB]: number[]): number[] {
  return [amountA, amountB];
}
export function useTimeSeriesTVL(
  tokenA: Token,
  tokenB: Token,
  timePeriodKey: TimePeriodKey
): TimeSeriesRow[] | null | undefined {
  return useTimeSeriesTokenValues(
    tokenA,
    tokenB,
    timePeriodKey,
    getTimeSeriesTvlPath,
    getStatTvlValues
  );
}

function getTimeSeriesVolumePath(tokenA: Token, tokenB: Token): string {
  return `timeseries/volume/${tokenA.address}/${tokenB.address}`;
}
function getStatVolumeValues([amountA, amountB]: number[]): number[] {
  return [amountA, amountB];
}
export function useTimeSeriesVolume(
  tokenA: Token,
  tokenB: Token,
  timePeriodKey: TimePeriodKey
): TimeSeriesRow[] | null | undefined {
  return useTimeSeriesTokenValues(
    tokenA,
    tokenB,
    timePeriodKey,
    getTimeSeriesVolumePath,
    getStatVolumeValues
  );
}
function getStatFeeValues([, , amountA, amountB]: number[]): number[] {
  return [amountA, amountB];
}
export function useTimeSeriesFees(
  tokenA: Token,
  tokenB: Token,
  timePeriodKey: TimePeriodKey
): TimeSeriesRow[] | null | undefined {
  return useTimeSeriesTokenValues(
    tokenA,
    tokenB,
    timePeriodKey,
    getTimeSeriesVolumePath,
    getStatFeeValues
  );
}

function getTimeSeriesVolatilityPath(tokenA: Token, tokenB: Token): string {
  return `timeseries/price/${tokenA.address}/${tokenB.address}`;
}
function getStatVolatilityValues([open, high, low, close]: number[]): number[] {
  return [tickIndexToPrice(new BigNumber(close)).toNumber()];
}
export function useTimeSeriesVolatility(
  tokenA: Token,
  tokenB: Token,
  timePeriodKey: TimePeriodKey
): TimeSeriesRow[] | null | undefined {
  return useTimeSeriesData(
    tokenA,
    tokenB,
    timePeriodKey,
    getTimeSeriesVolatilityPath,
    getStatVolatilityValues
  );
}

function PoolBarChart({
  chartKey,
  timePeriodKey,
  tokenA,
  tokenB,
}: {
  chartKey: typeof chartKeys[number];
  timePeriodKey: TimePeriodKey;
  tokenA: Token;
  tokenB: Token;
}) {
  const ChartComponent = chartComponents[chartKey];

  return (
    // plot chart
    <ChartComponent
      tokenA={tokenA}
      tokenB={tokenB}
      timePeriodKey={timePeriodKey}
    />
  );
}

const chartComponents = {
  TVL: ChartTVL,
  Volume: ChartVolume,
  Fees: ChartFees,
  Volatility: ChartVolatility,
};

function useChartData(data: TimeSeriesRow[] | undefined) {
  // map data to chart
  return useMemo(() => {
    return data
      ?.map(([unixTime, values]) => {
        // add values here properly with price data
        return {
          x: unixTime.toFixed(),
          y: values.reduce((acc, value) => acc + value, 0),
        };
      })
      .reverse();
  }, [data]);
}

function sum(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  return values.reduce((acc, value) => acc + value, 0);
}

function ChartTVL({
  tokenA,
  tokenB,
  timePeriodKey,
}: {
  tokenA: Token;
  tokenB: Token;
  timePeriodKey: TimePeriodKey;
}) {
  const data = useTimeSeriesTVL(tokenA, tokenB, timePeriodKey);
  const [[timeUnix, lastValues = []] = []] = data || [];
  return (
    <BarChartBase
      loading={data === undefined}
      header={formatStatTokenValue(sum(lastValues))}
      timeUnix={timeUnix}
      chartData={useChartData(data || undefined)}
    />
  );
}

function ChartVolume({
  tokenA,
  tokenB,
  timePeriodKey,
}: {
  tokenA: Token;
  tokenB: Token;
  timePeriodKey: TimePeriodKey;
}) {
  const data = useTimeSeriesVolume(tokenA, tokenB, timePeriodKey);
  const [[timeUnix, lastValues = []] = []] = data || [];
  return (
    <BarChartBase
      loading={data === undefined}
      header={formatStatTokenValue(sum(lastValues))}
      timeUnix={timeUnix}
      chartData={useChartData(data || undefined)}
    />
  );
}

function ChartFees({
  tokenA,
  tokenB,
  timePeriodKey,
}: {
  tokenA: Token;
  tokenB: Token;
  timePeriodKey: TimePeriodKey;
}) {
  const data = useTimeSeriesFees(tokenA, tokenB, timePeriodKey);
  const [[timeUnix, lastValues = []] = []] = data || [];
  return (
    <BarChartBase
      loading={data === undefined}
      header={formatStatTokenValue(sum(lastValues))}
      timeUnix={timeUnix}
      chartData={useChartData(data || undefined)}
    />
  );
}

function ChartVolatility({
  tokenA,
  tokenB,
  timePeriodKey,
}: {
  tokenA: Token;
  tokenB: Token;
  timePeriodKey: TimePeriodKey;
}) {
  const data = useTimeSeriesVolatility(tokenA, tokenB, timePeriodKey);
  const [[timeUnix, lastValues = []] = []] = data || [];
  return (
    <BarChartBase
      loading={data === undefined}
      header={formatStatPercentageValue(sum(lastValues))}
      timeUnix={timeUnix}
      chartData={useChartData(data || undefined)}
    />
  );
}

interface DataTuple {
  x: string;
  y: number;
}

function BarChartBase({
  loading,
  header,
  timeUnix,
  chartData,
}: {
  loading: boolean;
  header: ReactNode;
  timeUnix: TokenValue;
  chartData?: DataTuple[];
}) {
  return chartData ? (
    <div className="line-chart">
      <div className="chart__header mt-lg">{header}</div>
      <div className="chart__subheader">
        {timeUnix ? (
          new Date(timeUnix * 1000).toLocaleDateString(undefined, {
            dateStyle: 'long',
          })
        ) : (
          <>&nbsp;</>
        )}
      </div>
      <BarChart width={500} height={300} data={chartData || []} />
    </div>
  ) : (
    // show skeleton
    <div
      className="chart--empty mt-6 mb-xl flex flex-centered row"
      style={{ height: 300 }}
    >
      {loading ? 'loading...' : 'no data'}
    </div>
  );
}
