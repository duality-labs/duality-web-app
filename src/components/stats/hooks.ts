import useSWR from 'swr';
import { useMemo } from 'react';

import {
  TimeSeriesPage,
  TimeSeriesRow,
  TokenValuePair,
  getLastDataChanges,
  getLastDataValues,
} from './utils';
import { Token } from '../../lib/web3/utils/tokens';
import { useTokenValueTotal } from '../../lib/web3/hooks/useTokens';

const { REACT_APP__INDEXER_API = '' } = process.env;

function useIndexerData(
  tokenA: Token,
  tokenB: Token,
  getIndexerPath: (tokenA: Token, tokenB: Token) => string
) {
  return useSWR<TimeSeriesPage>(
    `${REACT_APP__INDEXER_API}/${getIndexerPath(tokenA, tokenB)}`,
    async (url) => {
      const response = await fetch(url);
      return response.json();
    }
  );
}

export function useTimeSeriesData(
  tokenA: Token,
  tokenB: Token,
  getIndexerPath: (tokenA: Token, tokenB: Token) => string,
  getValues?: (values: number[]) => number[]
) {
  const response = useIndexerData(tokenA, tokenB, getIndexerPath);
  const { data: pages, error } = response;

  return useMemo<TimeSeriesRow[] | null | undefined>(() => {
    // return error state as null
    if (error && !pages) {
      return null;
    }
    // return success state as loading or data
    return pages && getValues
      ? pages.data.map(([timeUnix, values]) => [timeUnix, getValues(values)])
      : pages?.data;
  }, [error, pages, getValues]);
}

export function useStatData(
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

export function useStatTokenValue(
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

// TVL
function getStatTvlPath(tokenA: Token, tokenB: Token) {
  return `stats/tvl/${tokenA.address}/${tokenB.address}`;
}
function getStatTvlValues([amountA, amountB]: number[]): number[] {
  return [amountA, amountB];
}
export function useStatTVL(tokenA: Token, tokenB: Token) {
  return useStatTokenValue(tokenA, tokenB, getStatTvlPath, getStatTvlValues);
}

// volume and fees
function getStatVolumePath(tokenA: Token, tokenB: Token) {
  return `stats/volume/${tokenA.address}/${tokenB.address}`;
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
  return `stats/volatility/${tokenA.address}/${tokenB.address}`;
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
