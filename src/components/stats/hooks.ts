import { useCallback, useMemo } from 'react';
import BigNumber from 'bignumber.js';
import useSWR from 'swr';

import {
  TimeSeriesRow,
  TokenValuePair,
  getIndexerTokenPathPart,
  getLastDataChanges,
  getLastDataValues,
} from './utils';
import { Token } from '../../lib/web3/utils/tokens';
import { useTokenValueTotal } from '../../lib/web3/hooks/useTokens';
import {
  tickIndexToDisplayPrice,
  tickIndexToPrice,
} from '../../lib/web3/utils/ticks';
import {
  BaseStatsDataSSERow,
  BaseStatsDataSSEPage,
  useIndexerStreamLastUpdateOfSingleDataSet,
} from '../../lib/web3/hooks/useIndexer';

const { REACT_APP__INDEXER_API = '', REACT_APP__INDEXER_API_KEY = '' } =
  import.meta.env;

type BaseStatsSSEPoint = BaseStatsDataSSEPage['current'];
function useLastUpdateOfIndexerData<StatsSSEPoint extends BaseStatsSSEPoint>(
  tokenA: Token | undefined,
  tokenB: Token | undefined,
  getIndexerPath: (tokenA: Token, tokenB: Token) => string | undefined,
  getValues: (values: StatsSSEPoint) => number[]
): TimeSeriesRow[] | null | undefined {
  const urlPath = tokenA && tokenB && getIndexerPath(tokenA, tokenB);
  const url = urlPath && `${REACT_APP__INDEXER_API}/${urlPath}`;
  const update = useIndexerStreamLastUpdateOfSingleDataSet<
    BaseStatsDataSSEPage,
    Map<number, BaseStatsDataSSERow>
  >(url);

  return useMemo<TimeSeriesRow[] | null | undefined>(() => {
    const data = update.data;
    const error = update.error;
    // return error state as null, and return "there is no data" as null
    if (error || data?.size === 0) {
      return null;
    }
    // return uninitialized data state as "not yet defined", ie. a loading state
    const dataRow =
      data &&
      // return a combination of possible 24hour and 10day stat return types
      (Array.from(data.values())[0] as unknown as {
        current: StatsSSEPoint;
        // from 24hour stat endpoints
        hour24?: StatsSSEPoint;
        hour48?: StatsSSEPoint;
        // from 10 day stat endpoints
        d10?: StatsSSEPoint;
        d20?: StatsSSEPoint;
      });
    if (!dataRow || !dataRow || !dataRow.current?.tmstmp) {
      return undefined;
    }
    // const { current, hour24, hour48 } = dataRow;
    // return success state as loading or data
    return [
      getTimeseriesRow(dataRow.current),
      // should be safe to add both 24hour and 10 day stats together
      // they should not be seen on the same endpoint
      ...(dataRow.hour24?.tmstmp ? [getTimeseriesRow(dataRow.hour24)] : []),
      ...(dataRow.hour48?.tmstmp ? [getTimeseriesRow(dataRow.hour48)] : []),
      // note: that at the moment only volatility endpoints use d10 and d20
      ...(dataRow.d10?.tmstmp ? [getTimeseriesRow(dataRow.d10)] : []),
      ...(dataRow.d20?.tmstmp ? [getTimeseriesRow(dataRow.d20)] : []),
    ];
    function getTimeseriesRow(dataRowSection: StatsSSEPoint): TimeSeriesRow {
      return [dataRowSection.tmstmp, getValues(dataRowSection)];
    }
  }, [update.data, update.error, getValues]);
}

function useStatData<StatsSSEPoint extends BaseStatsSSEPoint>(
  tokenA: Token | undefined,
  tokenB: Token | undefined,
  getIndexerPath: (tokenA: Token, tokenB: Token) => string | undefined,
  getValues: (values: StatsSSEPoint) => number[]
): [
  number | null | undefined,
  number[] | null | undefined,
  number[] | null | undefined
] {
  const data = useLastUpdateOfIndexerData(
    tokenA,
    tokenB,
    getIndexerPath,
    getValues
  );

  const [timeUnix, values] = data
    ? getLastDataValues(data) || [null, null]
    : [data, data];
  const valueDiffs = data && getLastDataChanges(data);

  // expect values to exist, if an empty array is found consider the stat to be
  // in an error state not a loading state
  return [
    timeUnix,
    values && (values.length > 0 ? values : null),
    valueDiffs && (valueDiffs.length > 0 ? valueDiffs : null),
  ];
}

function useStatTokenValue<StatsSSEPoint extends BaseStatsSSEPoint>(
  tokenA: Token,
  tokenB: Token,
  getIndexerPath: (tokenA: Token, tokenB: Token) => string,
  getValues: (values: StatsSSEPoint) => number[]
): TokenValuePair {
  const [timeUnix, amounts, amountDiffs] = useStatData(
    tokenA,
    tokenB,
    getIndexerPath,
    getValues
  );

  const [amountA, amountB] = amounts || [];
  const [amountDiffA, amountDiffB] = amountDiffs || [];

  const valueTotal = useTokenValueTotal([tokenA, amountA], [tokenB, amountB]);
  const valueDiffTotal = useTokenValueTotal(
    [tokenA, amountDiffA],
    [tokenB, amountDiffB]
  );

  return [timeUnix, valueTotal, valueDiffTotal];
}

interface PriceRow {
  high: number;
  low: number;
  open: number;
  close: number;
}
interface TimeseriesPriceRowPoint extends PriceRow {
  block_tmstmp: number;
  block_height: number;
}
interface StatsPriceRowPoint extends PriceRow {
  tmstmp: number;
}
// Real-time price
function getRealtimePricePath(tokenA: Token, tokenB: Token) {
  const denomA = tokenA && getIndexerTokenPathPart(tokenA);
  const denomB = tokenB && getIndexerTokenPathPart(tokenB);
  return `timeseries/price?token_a=${denomA}&token_b=${denomB}&resolution=second`;
}
function getLastPriceTickIndexValue({ close }: PriceRow): number[] {
  return [close];
}
function useRealtimePriceTickIndex(
  tokenA: Token | undefined,
  tokenB: Token | undefined
): [
  timeUnix: number | null | undefined,
  tickIndexBtoA: number | null | undefined
] {
  // fetch most recent value with a page limit
  const url = tokenA && tokenB && getRealtimePricePath(tokenA, tokenB);
  const { data: latestDataUpdate } = useSWR<{
    data: TimeseriesPriceRowPoint[];
  }>(url ? [url, 'fetch'] : null, () =>
    fetch(`${REACT_APP__INDEXER_API}/${url}&offset=0&limit=1`, {
      headers: {
        auth_token: `${REACT_APP__INDEXER_API_KEY}`,
      },
    }).then((response) => response.json())
  );

  const mostRecentUpdate = useStatData<StatsPriceRowPoint>(
    tokenA,
    tokenB,
    getRealtimePricePath,
    getLastPriceTickIndexValue
  );
  // read data from latest update or last fetched value or return null
  const [timeUnix, lastRow] = mostRecentUpdate.find((v) => v)
    ? mostRecentUpdate
    : latestDataUpdate?.data[0]
    ? [
        latestDataUpdate.data[0].block_tmstmp,
        getLastPriceTickIndexValue(latestDataUpdate.data[0]),
      ]
    : [null, null, null];
  // return single values from data
  return [timeUnix, lastRow?.[0]];
}

export function useRealtimeBasePrice(
  tokenA: Token | undefined,
  tokenB: Token | undefined
): [timeUnix: number | null | undefined, priceBtoA: number | null | undefined] {
  const [timeUnix, tickIndex] = useRealtimePriceTickIndex(tokenA, tokenB);
  return [
    timeUnix,
    tickIndex && tickIndexToPrice(new BigNumber(tickIndex)).toNumber(),
  ];
}
export function useRealtimeDisplayPrice(
  tokenA: Token | undefined,
  tokenB: Token | undefined
): [timeUnix: number | null | undefined, priceBtoA: number | null | undefined] {
  const [timeUnix, tickIndex] = useRealtimePriceTickIndex(tokenA, tokenB);
  return [
    timeUnix,
    tickIndex &&
      tickIndexToDisplayPrice(
        new BigNumber(tickIndex),
        tokenA,
        tokenB
      )?.toNumber(),
  ];
}

// Price
function getStatPricePath(tokenA: Token, tokenB: Token) {
  const denomA = tokenA && getIndexerTokenPathPart(tokenA);
  const denomB = tokenB && getIndexerTokenPathPart(tokenB);
  return `stats/price?token_a=${denomA}&token_b=${denomB}`;
}
export function useStatDisplayPrice(
  tokenA: Token,
  tokenB: Token,
  attribute: 'open' | 'high' | 'low' | 'close' = 'close'
) {
  const getStatPriceValues = useCallback(
    ({ open, high, low, close }: StatsPriceRowPoint): number[] => {
      return [
        tickIndexToDisplayPrice(
          new BigNumber({ open, high, low, close }[attribute]),
          tokenA,
          tokenB
        )?.toNumber() || 0,
      ];
    },
    [attribute, tokenA, tokenB]
  );
  const [timeUnix, prices, priceDiffs] = useStatData<StatsPriceRowPoint>(
    tokenA,
    tokenB,
    getStatPricePath,
    getStatPriceValues
  );
  // return single values from data
  return [timeUnix, prices && prices[0], priceDiffs && priceDiffs[0]];
}

// TVL
type StatsTvlRowPoint = {
  tmstmp: number;
  tvl_a: string;
  tvl_b: string;
};
function getStatTvlPath(tokenA: Token, tokenB: Token) {
  const denomA = tokenA && getIndexerTokenPathPart(tokenA);
  const denomB = tokenB && getIndexerTokenPathPart(tokenB);
  return `stats/tvl?token_a=${denomA}&token_b=${denomB}`;
}
function getStatTvlValues(row: StatsTvlRowPoint): number[] {
  return [Number(row.tvl_a), Number(row.tvl_b)];
}
export function useStatTVL(tokenA: Token, tokenB: Token) {
  return useStatTokenValue<StatsTvlRowPoint>(
    tokenA,
    tokenB,
    getStatTvlPath,
    getStatTvlValues
  );
}

export function useStatComposition(tokenA: Token, tokenB: Token) {
  return useStatData(tokenA, tokenB, getStatTvlPath, getStatTvlValues);
}

// volume and fees
type StatsVolumeRowPoint = {
  tmstmp: number;
  swap_volume_a: string;
  swap_volume_b: string;
  fee_a: string;
  fee_b: string;
};
function getStatVolumePath(tokenA: Token, tokenB: Token) {
  const denomA = tokenA && getIndexerTokenPathPart(tokenA);
  const denomB = tokenB && getIndexerTokenPathPart(tokenB);
  return `stats/volume?token_a=${denomA}&token_b=${denomB}`;
}
function getStatVolumeValues(row: StatsVolumeRowPoint): number[] {
  return [Number(row.swap_volume_a), Number(row.swap_volume_b)];
}
export function useStatVolume(tokenA: Token, tokenB: Token) {
  return useStatTokenValue(
    tokenA,
    tokenB,
    getStatVolumePath,
    getStatVolumeValues
  );
}
function getStatFeeValues(row: StatsVolumeRowPoint): number[] {
  return [Number(row.fee_a), Number(row.fee_b)];
}
export function useStatFee(tokenA: Token, tokenB: Token) {
  return useStatTokenValue(tokenA, tokenB, getStatVolumePath, getStatFeeValues);
}

// volatility
type StatsVolatilityRowPoint = {
  tmstmp: number;
  volatility: string;
};
function getStatVolatilityPath(tokenA: Token, tokenB: Token) {
  const denomA = tokenA && getIndexerTokenPathPart(tokenA);
  const denomB = tokenB && getIndexerTokenPathPart(tokenB);
  return `stats/volatility?token_a=${denomA}&token_b=${denomB}`;
}
function getStatVolatilityValues(row: StatsVolatilityRowPoint): number[] {
  return [Number(row.volatility)];
}
export function useStatVolatility(
  tokenA: Token,
  tokenB: Token
): TokenValuePair {
  const [timeUnix, amounts, amountDiffs] = useStatData<StatsVolatilityRowPoint>(
    tokenA,
    tokenB,
    getStatVolatilityPath,
    getStatVolatilityValues
  );
  // return single values from data
  return [timeUnix, amounts && amounts[0], amountDiffs && amountDiffs[0]];
}
