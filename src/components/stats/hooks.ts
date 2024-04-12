import { useCallback, useMemo } from 'react';
import BigNumber from 'bignumber.js';
import useSWR from 'swr';

import {
  TimeSeriesPage,
  TimeSeriesRow,
  TokenValuePair,
  getIndexerTokenPathPart,
  getLastDataChanges,
  getLastDataValues,
} from './utils';
import { Token } from '../../lib/web3/utils/tokens';
import { useTokenValueTotal } from '../../lib/web3/hooks/useTokens';
import { tickIndexToPrice } from '../../lib/web3/utils/ticks';
import { useIndexerStreamLastUpdateOfSingleDataSet } from '../../lib/web3/hooks/useIndexer';

const { REACT_APP__INDEXER_API = '' } = import.meta.env;

function useLastUpdateOfIndexerData(
  tokenA: Token | undefined,
  tokenB: Token | undefined,
  getIndexerPath: (tokenA: Token, tokenB: Token) => string | undefined,
  getValues?: (values: number[]) => number[]
) {
  const urlPath = tokenA && tokenB && getIndexerPath(tokenA, tokenB);
  const url = urlPath && `${REACT_APP__INDEXER_API}/${urlPath}`;
  const update = useIndexerStreamLastUpdateOfSingleDataSet<TimeSeriesRow>(url);

  return useMemo<TimeSeriesRow[] | null | undefined>(() => {
    const data = update.data;
    const error = update.error;
    // return error state as null, and return "there is no data" as null
    if (error || data?.size === 0) {
      return null;
    }
    // return uninitialized data state as "not yet defined", ie. a loading state
    if (!data) {
      return undefined;
    }
    // sort timeseries rows reverse chronologically
    const reverseChronologicalRows: TimeSeriesRow[] = Array.from(data).sort(
      (a, b) => b[0] - a[0]
    );
    // return success state as loading or data
    return getValues
      ? reverseChronologicalRows
          // map in specific values
          .map(([timeUnix, values = []]) => {
            return [timeUnix, getValues(values)];
          })
      : reverseChronologicalRows;
  }, [update.data, update.error, getValues]);
}

function useStatData(
  tokenA: Token | undefined,
  tokenB: Token | undefined,
  getIndexerPath: (tokenA: Token, tokenB: Token) => string | undefined,
  getValues?: (values: number[]) => number[]
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

function useStatTokenValue(
  tokenA: Token,
  tokenB: Token,
  getIndexerPath: (tokenA: Token, tokenB: Token) => string,
  getValues?: (values: number[]) => number[]
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

// Real-time price
function getLastPriceValue([, , , close]: number[]): number[] {
  return [tickIndexToPrice(new BigNumber(close)).toNumber()];
}
export function useRealtimePrice(
  tokenA: Token | undefined,
  tokenB: Token | undefined
): [timeUnix: number | null | undefined, priceBtoA: number | null | undefined] {
  // fetch most recent value with a page limit
  const denomA = tokenA && getIndexerTokenPathPart(tokenA);
  const denomB = tokenB && getIndexerTokenPathPart(tokenB);
  const fetchURL = new URL(
    `timeseries/price/${denomA}/${denomB}`,
    REACT_APP__INDEXER_API
  );
  fetchURL.searchParams.append('pagination.limit', '1');
  const { data: latestDataUpdate } = useSWR<TimeSeriesPage>(
    denomA && denomB ? [fetchURL.toString(), 'fetch'] : null,
    () => fetch(fetchURL).then((response) => response.json())
  );
  const knownHeight = latestDataUpdate?.block_range.to_height;

  const getRealtimePricePath = useCallback(
    (tokenA: Token, tokenB: Token): string | undefined => {
      const denomA = tokenA && getIndexerTokenPathPart(tokenA);
      const denomB = tokenB && getIndexerTokenPathPart(tokenB);
      return knownHeight
        ? `timeseries/price/${denomA}/${denomB}?block_range.from_height=${knownHeight}`
        : undefined;
    },
    [knownHeight]
  );

  const mostRecentUpdate = useStatData(tokenA, tokenB, getRealtimePricePath);
  // read data from latest update or last fetched value or return null
  const [timeUnix, lastRow] = mostRecentUpdate.find((v) => v)
    ? mostRecentUpdate
    : latestDataUpdate?.data[0] ?? [null, null, null];
  // return single values from data
  return [timeUnix, lastRow && getLastPriceValue(lastRow)[0]];
}

// Price
function getStatPricePath(tokenA: Token, tokenB: Token) {
  return `stats/price/${getIndexerTokenPathPart(
    tokenA
  )}/${getIndexerTokenPathPart(tokenB)}`;
}
export function useStatPrice(
  tokenA: Token,
  tokenB: Token,
  attribute: 'open' | 'high' | 'low' | 'close' = 'close'
) {
  const getStatPriceValues = useCallback(
    ([open, high, low, close]: number[]): number[] => {
      return [
        tickIndexToPrice(
          new BigNumber({ open, high, low, close }[attribute])
        ).toNumber(),
      ];
    },
    [attribute]
  );
  const [timeUnix, prices, priceDiffs] = useStatData(
    tokenA,
    tokenB,
    getStatPricePath,
    getStatPriceValues
  );
  // return single values from data
  return [timeUnix, prices && prices[0], priceDiffs && priceDiffs[0]];
}

// TVL
function getStatTvlPath(tokenA: Token, tokenB: Token) {
  return `stats/tvl/${[
    getIndexerTokenPathPart(tokenA),
    getIndexerTokenPathPart(tokenB),
  ].join('/')}`;
}
function getStatTvlValues([amountA, amountB]: number[]): number[] {
  return [amountA, amountB];
}
export function useStatTVL(tokenA: Token, tokenB: Token) {
  return useStatTokenValue(tokenA, tokenB, getStatTvlPath, getStatTvlValues);
}

export function useStatComposition(tokenA: Token, tokenB: Token) {
  return useStatData(tokenA, tokenB, getStatTvlPath, getStatTvlValues);
}

// volume and fees
function getStatVolumePath(tokenA: Token, tokenB: Token) {
  return `stats/volume/${[
    getIndexerTokenPathPart(tokenA),
    getIndexerTokenPathPart(tokenB),
  ].join('/')}`;
}
function getStatVolumeValues([amountA, amountB]: number[]): number[] {
  return [amountA, amountB];
}
export function useStatVolume(tokenA: Token, tokenB: Token) {
  return useStatTokenValue(
    tokenA,
    tokenB,
    getStatVolumePath,
    getStatVolumeValues
  );
}
function getStatFeeValues([, , amountA, amountB]: number[]): number[] {
  return [amountA, amountB];
}
export function useStatFee(tokenA: Token, tokenB: Token) {
  return useStatTokenValue(tokenA, tokenB, getStatVolumePath, getStatFeeValues);
}

// volatility
function getStatVolatilityPath(tokenA: Token, tokenB: Token) {
  return `stats/volatility/${[
    getIndexerTokenPathPart(tokenA),
    getIndexerTokenPathPart(tokenB),
  ].join('/')}`;
}
function getStatVolatilityValues([value]: number[]): number[] {
  return [value];
}
export function useStatVolatility(
  tokenA: Token,
  tokenB: Token
): TokenValuePair {
  const [timeUnix, amounts, amountDiffs] = useStatData(
    tokenA,
    tokenB,
    getStatVolatilityPath,
    getStatVolatilityValues
  );
  // return single values from data
  return [timeUnix, amounts && amounts[0], amountDiffs && amountDiffs[0]];
}
