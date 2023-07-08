import BigNumber from 'bignumber.js';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import Chart, { ChartProps } from '../../components/charts/Chart';
import TimeSeriesBarChart from '../../components/charts/TimeSeriesBarChart';
import TimeSeriesLineChart from '../../components/charts/TimeSeriesLineChart';
import ButtonGroup from '../../components/ButtonGroup/ButtonGroup';

import { days, hours, weeks } from '../../lib/utils/time';
import { Token, getTokenValue } from '../../lib/web3/utils/tokens';
import { useSimplePrice } from '../../lib/tokenPrices';
import {
  TimeSeriesPage,
  TimeSeriesRow,
  formatStatPercentageValue,
  formatStatTokenValue,
} from '../../components/stats/utils';
import { formatAmount } from '../../lib/utils/number';

import './PoolChart.scss';
import { tickIndexToPrice } from '../../lib/web3/utils/ticks';

const { REACT_APP__INDEXER_API = '' } = process.env;

const timePeriodKeys: TimePeriodKey[] = ['24H', '1W', '1M', '1Y', 'ALL'];

type TimePeriodKey = '24H' | '1W' | '1M' | '1Y' | 'ALL';
type DataResolution = 'second' | 'minute' | 'hour' | 'day' | 'month';

const chartKeys = ['TVL', 'Volume', 'Fees', 'Volatility'] as const;
const chartComponents = {
  TVL: ChartTVL,
  Volume: ChartVolume,
  Fees: ChartFees,
  Volatility: ChartVolatility,
};

export default function PoolChart({
  tokenA,
  tokenB,
}: {
  tokenA: Token;
  tokenB: Token;
}) {
  const [chartIndex, setChartIndex] = useState<number>(0);
  const [timePeriodIndex, setTimePeriodIndex] = useState<number>(0);
  const chartKey = chartKeys[chartIndex];
  const timePeriodKey = timePeriodKeys[timePeriodIndex];
  const ChartComponent = chartComponents[chartKey];

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
      <ChartComponent
        tokenA={tokenA}
        tokenB={tokenB}
        timePeriodKey={timePeriodKey}
      />
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

function useTimeSeriesData(
  tokenA: Token,
  tokenB: Token,
  timePeriodKey: TimePeriodKey,
  basePath: string,
  getValues?: (values: number[]) => number[]
) {
  const resolution = getDataResolution(timePeriodKey) || 'day';
  const path = `${basePath}/${tokenA.address}/${tokenB.address}/${resolution}`;
  const {
    data: resultData,
    error,
    isFetching,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: [path],
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
      const response = await fetch(`${REACT_APP__INDEXER_API}/${path}${query}`);
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
function useTimeSeriesTokenValues(
  tokenA: Token,
  tokenB: Token,
  timePeriodKey: TimePeriodKey,
  basePath: string,
  getValues?: (values: number[]) => number[]
): TimeSeriesRow[] | null | undefined {
  const data = useTimeSeriesData(
    tokenA,
    tokenB,
    timePeriodKey,
    basePath,
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

function getStatTvlValues([amountA, amountB]: number[]): number[] {
  return [amountA, amountB];
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
  const data = useTimeSeriesTokenValues(
    tokenA,
    tokenB,
    timePeriodKey,
    'timeseries/tvl',
    getStatTvlValues
  );
  return (
    <ChartBase
      ChartComponent={TimeSeriesLineChart}
      chartData={data}
      timeFormatter={dateFormats[timePeriodKey]}
      valueFormatter={formatStatTokenValue}
    />
  );
}

function getStatVolumeValues([amountA, amountB]: number[]): number[] {
  return [amountA, amountB];
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
  const data = useTimeSeriesTokenValues(
    tokenA,
    tokenB,
    timePeriodKey,
    'timeseries/volume',
    getStatVolumeValues
  );
  return (
    <ChartBase
      ChartComponent={TimeSeriesBarChart}
      chartData={data}
      timeFormatter={dateFormats[timePeriodKey]}
      valueFormatter={formatStatTokenValue}
    />
  );
}

function getStatFeeValues([, , amountA, amountB]: number[]): number[] {
  return [amountA, amountB];
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
  const data = useTimeSeriesTokenValues(
    tokenA,
    tokenB,
    timePeriodKey,
    'timeseries/volume',
    getStatFeeValues
  );
  return (
    <ChartBase
      ChartComponent={TimeSeriesBarChart}
      chartData={data}
      timeFormatter={dateFormats[timePeriodKey]}
      valueFormatter={formatStatTokenValue}
    />
  );
}

function getStatVolatilityValues([open, high, low, close]: number[]): number[] {
  return [tickIndexToPrice(new BigNumber(close)).toNumber()];
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
  const data = useTimeSeriesData(
    tokenA,
    tokenB,
    timePeriodKey,
    'timeseries/price',
    getStatVolatilityValues
  );
  return (
    <ChartBase
      ChartComponent={TimeSeriesLineChart}
      chartData={data}
      timeFormatter={dateFormats[timePeriodKey]}
      valueFormatter={formatStatPercentageValue}
    />
  );
}

const dateFormats = {
  '24H': new Intl.DateTimeFormat(undefined, {
    dateStyle: 'long',
    timeStyle: 'short',
  }),
  '1W': new Intl.DateTimeFormat(undefined, {
    dateStyle: 'long',
    timeStyle: 'short',
  }),
  '1M': new Intl.DateTimeFormat(undefined, {
    dateStyle: 'long',
  }),
  '1Y': new Intl.DateTimeFormat(undefined, {
    dateStyle: 'long',
  }),
  ALL: new Intl.DateTimeFormat(undefined, {
    dateStyle: 'long',
  }),
};

function ChartBase({
  ChartComponent,
  chartData,
  timeFormatter,
  valueFormatter,
}: {
  ChartComponent: React.FunctionComponent<ChartProps<TimeSeriesRow>>;
  chartData: TimeSeriesRow[] | null | undefined;
  valueFormatter?: (values: number) => string | null | undefined;
  timeFormatter?: Intl.DateTimeFormat;
}) {
  const [highlightedData, setHighlightedData] = useState<TimeSeriesRow>();
  const height = 300;
  return (
    <div className="chart">
      <ChartHeader
        dataRow={highlightedData || chartData?.[0]}
        timeFormatter={timeFormatter}
        valueFormatter={valueFormatter}
      />
      {chartData && chartData.length > 0 ? (
        // show chart
        <Chart
          className="fade-in-fast"
          height={height}
          ChartComponent={ChartComponent}
          data={chartData}
          onHover={setHighlightedData}
        />
      ) : (
        // show empty or loading state
        <div
          className="chart--empty flex flex-centered row fade-in-fast"
          style={{ height }}
        >
          {chartData === undefined
            ? // only an undefined data object represents a loading state
              'Loading...'
            : // data may be empty [] or null (on error or something unexpected)
              'No data available for this time period'}
        </div>
      )}
    </div>
  );
}

function ChartHeader({
  dataRow,
  valueFormatter = formatAmount,
  timeFormatter = dateFormats['ALL'],
}: {
  dataRow: TimeSeriesRow | undefined;
  valueFormatter?: (values: number) => string | null | undefined;
  timeFormatter?: Intl.DateTimeFormat;
}) {
  const [timeUnix, lastValues = []] = dataRow || [undefined, []];
  // sum last row values as the value to use in the header
  const value = lastValues.reduce((acc, value) => acc + value, 0);
  return (
    <>
      <div className="chart__header mt-lg">
        {timeUnix && timeUnix !== undefined ? (
          valueFormatter(value)
        ) : (
          <>&nbsp;</>
        )}
      </div>
      <div className="chart__subheader">
        {timeUnix ? (
          timeFormatter.format(new Date(timeUnix * 1000))
        ) : (
          <>&nbsp;</>
        )}
      </div>
    </>
  );
}
