import { RefetchOptions, UseQueryResult } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';
import { SWRResponse } from 'swr';

export type SWRCommon<Data = unknown, Error = unknown> = Omit<
  SWRResponse<Data, Error>,
  'mutate'
> & { refetch?: (opts?: RefetchOptions) => void };
interface SWRCommonWithRequiredData<Data = unknown, Error = unknown>
  extends SWRCommon<Data, Error> {
  data: Data;
}

export function useSwrResponse<Data, Error = unknown>(
  data: Data | undefined,
  swr1: Omit<SWRCommon<Data, Error>, 'data'>,
  swr2?: Omit<SWRCommon<Data, Error>, 'data'>
): SWRCommon<Data, Error> {
  return useMemo(() => {
    return {
      isLoading: !!(swr1.isLoading || swr2?.isLoading),
      isValidating: !!(swr1.isValidating || swr2?.isValidating),
      error: swr1.error || swr2?.error,
      refetch: swr1.refetch || swr2?.refetch,
      data,
    };
  }, [
    swr1.isLoading,
    swr1.isValidating,
    swr1.error,
    swr1.refetch,
    swr2?.isLoading,
    swr2?.isValidating,
    swr2?.error,
    swr2?.refetch,
    data,
  ]);
}

type QueryResultCommon<Data, Error = unknown> = Pick<
  UseQueryResult<Data, Error>,
  'isPending' | 'isFetching' | 'error'
> & { refetch: (opts?: RefetchOptions) => unknown };

export function useSwrResponseFromReactQuery<Data, Error = unknown>(
  data: Data | undefined,
  queryResult1: QueryResultCommon<Data, Error>,
  queryResult2?: QueryResultCommon<Data, Error>
): SWRCommon<Data, Error> {
  const swr1 = useMemo(
    () => ({
      isLoading: queryResult1.isPending,
      isValidating: queryResult1.isFetching,
      error: queryResult1.error || undefined,
      refetch: queryResult1.refetch,
    }),
    [queryResult1]
  );
  const swr2 = useMemo(
    () => ({
      isLoading: !!queryResult2?.isPending,
      isValidating: !!queryResult2?.isFetching,
      error: queryResult2?.error || undefined,
      refetch: queryResult2?.refetch,
    }),
    [queryResult2]
  );
  return useSwrResponse(data, swr1, swr2);
}

export function useCombineResults<Data, Error>(): (
  results: UseQueryResult<Data, Error>[]
) => SWRCommonWithRequiredData<Data[], Error> {
  const memoizedData = useRef<Data[]>([]);
  return useCallback((results: UseQueryResult<Data, Error>[]) => {
    const data = results.flatMap((result) =>
      result.data ? [result.data] : []
    );
    // update the memoized reference if the new data is different
    if (!isEqualArray(data, memoizedData.current)) {
      memoizedData.current = data;
    }
    // return memoized data and combined result state
    return {
      data: memoizedData.current,
      isLoading: results.every((result) => result.isPending),
      isValidating: results.some((result) => result.isFetching),
      error: results.find((result) => result.error)?.error ?? undefined,
      refetch: results.find((result) => result.refetch)?.refetch ?? undefined,
    };
  }, []);
}

export function isEqualArray<V>(
  array1: Array<V>,
  array2: Array<V> = new Array<V>()
): boolean {
  // compare array values if they are the same length
  if (array1.length === array2.length) {
    const length = array1.length;
    for (let i = 0; i < length; i++) {
      const value1 = array1[i];
      const value2 = array2[i];
      if (value1 !== value2) {
        // an item is different
        return false;
      }
    }
    // no changes found
    return true;
  }
  // the array length is different
  else {
    return false;
  }
}

export function isEqualMap<K, V>(
  map1: Map<K, V>,
  map2: Map<K, V> = new Map<K, V>()
): boolean {
  // compare map keys and values if they are the same size
  if (map1.size === map2.size) {
    const entries1 = map1.entries();
    const entries2 = map2.entries();
    for (let i = 0; i < map1.size; i++) {
      const [key1, value1] = entries1.next().value;
      const [key2, value2] = entries2.next().value;
      if (key1 !== key2 || value1 !== value2) {
        // an item is different
        return false;
      }
    }
    // no changes found
    return true;
  }
  // the map size is different
  else {
    return false;
  }
}
