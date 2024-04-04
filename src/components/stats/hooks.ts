import { useCallback, useMemo } from 'react';
import BigNumber from 'bignumber.js';

import {
  TimeSeriesRow,
  TokenValuePair,
  getIndexerTokenPathPart,
  getLastDataChanges,
  getLastDataValues,
} from './utils';
import { Token, getTokenId } from '../../lib/web3/utils/tokens';
import { useTokenValueTotal } from '../../lib/web3/hooks/useTokens';
import { tickIndexToPrice } from '../../lib/web3/utils/ticks';
import { useIndexerStreamLastUpdateOfSingleDataSet } from '../../lib/web3/hooks/useIndexer';

const { REACT_APP__INDEXER_API = '' } = import.meta.env;

function useTimeSeriesData(
  tokenA: Token,
  tokenB: Token,
  getIndexerPath: (tokenA: Token, tokenB: Token) => string,
  getValues?: (values: number[]) => number[]
) {
  const url = `${REACT_APP__INDEXER_API}/${getIndexerPath(tokenA, tokenB)}`;
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
  tokenA: Token,
  tokenB: Token,
  getIndexerPath: (tokenA: Token, tokenB: Token) => string,
  getValues?: (values: number[]) => number[]
): [
  number | null | undefined,
  number[] | null | undefined,
  number[] | null | undefined
] {
  const data = useTimeSeriesData(tokenA, tokenB, getIndexerPath, getValues);

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

// Price
function getStatPricePath(tokenA: Token, tokenB: Token) {
  return `stats/price/${getTokenId(tokenA)}/${getTokenId(tokenB)}`;
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
