import BigNumber from 'bignumber.js';
import { useMemo, useState } from 'react';

import Chart, { ChartProps } from '../../components/charts/Chart';
import TimeSeriesBarChart from '../../components/charts/TimeSeriesBarChart';
import TimeSeriesLineChart from '../../components/charts/TimeSeriesLineChart';
import ButtonGroup from '../../components/ButtonGroup/ButtonGroup';

import { days, hours, weeks } from '../../lib/utils/time';
import { Token, getTokenValue } from '../../lib/web3/utils/tokens';
import {
  AccumulatorOptions,
  BaseTimeSeriesSSERow,
  TimeSeriesPage,
  useIndexerStreamOfSingleDataSet,
} from '../../lib/web3/hooks/useIndexer';
import { useSimplePrice } from '../../lib/tokenPrices';
import {
  TimeSeriesRow,
  formatStatPercentageValue,
  formatStatTokenValue,
  getIndexerTokenPathPart,
} from '../../components/stats/utils';
import { formatAmount } from '../../lib/utils/number';

import './PoolChart.scss';
import { tickIndexToPrice } from '../../lib/web3/utils/ticks';

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
  // return unix times for API
  switch (timePeriodKey) {
    case '24H':
      return Math.floor((now - hours * 24) / 1000);
    case '1W':
      return Math.floor((now - weeks * 1) / 1000);
    case '1M':
      return Math.floor((now - weeks * 4) / 1000);
    case '1Y':
      return Math.floor((now - days * 365) / 1000);
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

function useTimeSeriesData<TimeSeriesDataRow extends BaseTimeSeriesSSERow>(
  pathPart: string,
  tokenA: Token,
  tokenB: Token,
  timePeriodKey: TimePeriodKey,
  opts?: AccumulatorOptions<TimeSeriesDataRow>
) {
  const urlPath = useMemo(() => {
    const denomA = getIndexerTokenPathPart(tokenA);
    const denomB = getIndexerTokenPathPart(tokenB);
    const resolution = getDataResolution(timePeriodKey) || 'day';
    const from = getPaginationLimit(timePeriodKey) || 0;
    return `${pathPart}?${[
      `token_a=${denomA}`,
      `token_b=${denomB}`,
      `resolution=${resolution}`,
      `from_block_tmstmp=${from}`,
    ].join('&')}`;
  }, [pathPart, tokenA, tokenB, timePeriodKey]);
  const stream = useIndexerStreamOfSingleDataSet<
    TimeSeriesPage<TimeSeriesDataRow>,
    TimeSeriesDataRow,
    Map<number, number[]>
  >(urlPath, opts);

  return useMemo<TimeSeriesRow[] | null | undefined>(() => {
    const data = stream.data;
    const error = stream.error;
    // return error state as null, and return "there is no data" as null
    if (error || data?.size === 0) {
      return null;
    }
    // return uninitialized data state as "not yet defined", ie. a loading state
    const dataRows = data && Array.from(data);
    if (!dataRows || !dataRows.length) {
      return undefined;
    }
    // sort timeseries rows chronologically
    const chronologicalRows: TimeSeriesRow[] = dataRows.sort(
      (a, b) => a[0] - b[0]
    );
    // return success state as loading or data
    return chronologicalRows;
  }, [stream.data, stream.error]);
}

// if data is in the form [timeUnix, [amountA, amountB]]
// then transform the data using price data to [timeUnix, [valueA, valueB]]
function useTimeSeriesTokenValues<
  TimeSeriesSSERow extends BaseTimeSeriesSSERow
>(
  pathPart: string,
  tokenA: Token,
  tokenB: Token,
  timePeriodKey: TimePeriodKey,
  opts?: AccumulatorOptions<TimeSeriesSSERow>
): TimeSeriesRow[] | null | undefined {
  const data = useTimeSeriesData(pathPart, tokenA, tokenB, timePeriodKey, opts);
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

// TVL
interface TimeSeriesTvlDataRow extends BaseTimeSeriesSSERow {
  tvl_a: string;
  tvl_b: string;
}
function getTimeseriesTvlValues(row: TimeSeriesTvlDataRow): number[] {
  return [Number(row.tvl_a), Number(row.tvl_b)];
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
    'v1/timeseries/tvl',
    tokenA,
    tokenB,
    timePeriodKey,
    {
      getDataUpdateValue: getTimeseriesTvlValues,
    }
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

// Volume
interface TimeSeriesVolumeDataRow extends BaseTimeSeriesSSERow {
  swap_volume_a: string;
  swap_volume_b: string;
  fee_a: string;
  fee_b: string;
}
function getTimeseriesVolumeValues(row: TimeSeriesVolumeDataRow): number[] {
  return [Number(row.swap_volume_a), Number(row.swap_volume_b)];
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
    'v1/timeseries/volume',
    tokenA,
    tokenB,
    timePeriodKey,
    {
      getDataUpdateValue: getTimeseriesVolumeValues,
    }
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

function getTimeseriesFeeValues(row: TimeSeriesVolumeDataRow): number[] {
  return [Number(row.fee_a), Number(row.fee_b)];
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
    'v1/timeseries/volume',
    tokenA,
    tokenB,
    timePeriodKey,
    { getDataUpdateValue: getTimeseriesFeeValues }
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

// Volatility
// todo: this is actually showing price not volatility
interface TimeSeriesPriceDataSSERow extends BaseTimeSeriesSSERow {
  high: string;
  low: string;
  open: string;
  close: string;
}
function getTimeseriesPriceValues(row: TimeSeriesPriceDataSSERow): number[] {
  return [tickIndexToPrice(new BigNumber(row.close)).toNumber()];
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
    'v1/timeseries/price',
    tokenA,
    tokenB,
    timePeriodKey,
    { getDataUpdateValue: getTimeseriesPriceValues }
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
        dataRow={highlightedData || chartData?.at(-1)}
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
