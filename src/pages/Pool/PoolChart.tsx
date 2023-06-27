import BigNumber from 'bignumber.js';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import BarChart from '../../components/charts/BarChart';
import ButtonGroup from '../../components/ButtonGroup/ButtonGroup';

import { days, hours, weeks } from '../../lib/utils/time';
import { Token, getAmountInDenom } from '../../lib/web3/utils/tokens';
import { formatCurrency } from '../../lib/utils/number';
import { useSimplePrice } from '../../lib/tokenPrices';

import './PoolChart.scss';

const { REACT_APP__INDEXER_API = '' } = process.env;

const resolutions = ['hour', 'day', 'week'] as const;

const timePeriodKeys: TimePeriodKey[] = ['24H', '1W', '1M', '1Y', 'ALL'];

type TimePeriodKey = '24H' | '1W' | '1M' | '1Y' | 'ALL';
type DataResolution = 'second' | 'minute' | 'hour' | 'day' | 'month';

interface DataRow {
  timestamp: string;
  tokenA: number;
  tokenB: number;
}
interface DataPeriod {
  resolution: typeof resolutions[number];
  data: Array<DataRow>;
}
interface DataPeriodsResponse {
  '24H': DataPeriod;
  '1W': DataPeriod;
  '1M': DataPeriod;
  '1Y': DataPeriod;
  ALL: DataPeriod;
}

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
        <PoolLineChart
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

type TimeSeriesRow = [unixTime: number, values: number[]];
type TimeSeriesPage = {
  shape: Array<string>;
  data: Array<TimeSeriesRow>;
  pagination?: {
    next_key?: string | null;
  };
};

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

function PoolLineChart({
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
  const {
    data: [tokenAPrice, tokenBPrice],
  } = useSimplePrice([tokenA, tokenB]);

  const resolution = getDataResolution(timePeriodKey);

  const {
    data: resultData,
    isFetching,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: [tokenA.address, tokenB.address, resolution],
    queryFn: async ({ pageParam: pageKey }): Promise<TimeSeriesPage> => {
      const requestPath = (() => {
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
        const query = queryParams ? `?${queryParams}` : '';
        switch (chartKey) {
          case 'TVL':
            return `/timeseries/tvl/${tokenA.address}/${tokenB.address}/${
              resolution || ''
            }${query}`;
          default:
            return `/timeseries/tvl/${tokenA.address}/${tokenB.address}/${
              resolution || ''
            }`;
        }
      })();
      const response = await fetch(`${REACT_APP__INDEXER_API}${requestPath}`);
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

  // collect pages together
  const data = useMemo<TimeSeriesRow[] | undefined>(() => {
    return resultData?.pages?.flatMap((page) => page.data);
  }, [resultData?.pages]);

  // map data to chart
  const chartData = useMemo(() => {
    return data
      ?.map(([unixTime, [amountA, amountB]]) => {
        // add values here properly with price data
        return { x: unixTime.toFixed(), y: Number(amountA) + Number(amountB) };
      })
      .reverse();
  }, [data]);

  const unixTime = data?.[0]?.[0];
  const [lastAmountA, lastAmountB] = getLastDataValues(data);

  return chartData ? (
    // plot chart
    <div className="line-chart">
      <div className="chart__header mt-lg">
        {tokenAPrice &&
        tokenBPrice &&
        Number(lastAmountA) >= 0 &&
        Number(lastAmountB) >= 0
          ? formatCurrency(
              BigNumber.sum(
                getAmountInDenom(
                  tokenA,
                  Number(lastAmountA) * tokenAPrice,
                  tokenA.address,
                  tokenA.display
                ) || 0,
                getAmountInDenom(
                  tokenB,
                  Number(lastAmountB) * tokenBPrice,
                  tokenB.address,
                  tokenB.display
                ) || 0
              ).toFixed()
            )
          : '...'}
      </div>
      <div className="chart__subheader">
        {unixTime ? (
          new Date(unixTime * 1000).toLocaleDateString(undefined, {
            dateStyle: 'long',
          })
        ) : (
          <>&nbsp;</>
        )}
      </div>
      <BarChart width={500} height={300} data={chartData} />
    </div>
  ) : (
    // show skeleton
    <div
      className="chart--empty mt-6 mb-xl flex flex-centered row"
      style={{ height: 300 }}
    >
      {isFetching ? 'loading...' : 'no data'}
    </div>
  );
}

function getLastDataValues(data: TimeSeriesRow[] = [], index = 0): number[] {
  // if data exists and there are values at the index then return them
  if (data?.[index]) {
    const [, values] = data[index];
    // protect against non-numbers (such as null)
    if (values.every((value) => !isNaN(value))) {
      return values;
    }
  }
  return [];
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
  const {
    data: [tokenAPrice, tokenBPrice],
  } = useSimplePrice([tokenA, tokenB]);

  const { data, isFetching } = useQuery({
    queryKey: [tokenA.address, tokenB.address],
    queryFn: async (): Promise<DataPeriodsResponse> => {
      const requestPath = (() => {
        switch (chartKey) {
          case 'Volume':
            return `/timeseries/volume/${tokenA.address}/${tokenB.address}`;
          default:
            return `/timeseries/volume/${tokenA.address}/${tokenB.address}`;
        }
      })();
      const response = await fetch(`${REACT_APP__INDEXER_API}${requestPath}`);
      return await response.json();
    },
  });

  const dataPeriod = useMemo<DataPeriod | null>(() => {
    if (data && timePeriodKey) {
      return data[timePeriodKey];
    }
    return null;
  }, [data, timePeriodKey]);

  // map data to chart
  const chartData = useMemo(() => {
    if (dataPeriod) {
      const length = (() => {
        switch (true) {
          case dataPeriod.resolution === 'hour' && timePeriodKey === '24H':
            return 24;
          case dataPeriod.resolution === 'hour' && timePeriodKey === '1W':
            return 24 * 7;
          case dataPeriod.resolution === 'day' && timePeriodKey === '1M':
            return 28;
          case dataPeriod.resolution === 'week' && timePeriodKey === '1Y':
            return 52;
          case dataPeriod.resolution === 'hour':
            return 24;
          case dataPeriod.resolution === 'day':
            return 28;
          case dataPeriod.resolution === 'week':
            return 52;
          default:
            return 1;
        }
      })();
      return Array.from({ length })
        .map((_, index) => {
          const dataRow = dataPeriod.data[index];
          // todo: find data for expected timestamps
          if (dataRow) {
            const { timestamp, tokenA, tokenB }: DataRow = dataRow;
            // add values here properly with price data
            return { x: timestamp, y: tokenA + tokenB };
          }
          return { x: `empty-${index}`, y: 0 };
        })
        .reverse();
    }
  }, [dataPeriod, timePeriodKey]);

  const [lastChartData] = dataPeriod?.data ?? [];

  return chartData ? (
    // plot chart
    <div className="bar-chart">
      <div className="chart__header mt-lg">
        {tokenAPrice && tokenBPrice && lastChartData
          ? formatCurrency(
              BigNumber.sum(
                getAmountInDenom(
                  tokenA,
                  lastChartData.tokenA * tokenAPrice,
                  tokenA.address,
                  tokenA.display
                ) || 0,
                getAmountInDenom(
                  tokenB,
                  lastChartData.tokenB * tokenBPrice,
                  tokenB.address,
                  tokenB.display
                ) || 0
              ).toFixed()
            )
          : '...'}
      </div>
      <div className="chart__subheader">
        {lastChartData ? (
          new Date(lastChartData.timestamp).toLocaleDateString(undefined, {
            dateStyle: 'long',
          })
        ) : (
          <>&nbsp;</>
        )}
      </div>
      <BarChart width={500} height={300} data={chartData} />
    </div>
  ) : (
    // show skeleton
    <div
      className="chart--empty mt-6 mb-xl flex flex-centered row"
      style={{ height: 300 }}
    >
      {isFetching ? 'loading...' : 'no data'}
    </div>
  );
}
