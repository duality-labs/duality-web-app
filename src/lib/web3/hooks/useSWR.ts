import { UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import { SWRResponse } from 'swr';

export type SWRCommon<Data = unknown, Error = unknown> = Omit<
  SWRResponse<Data, Error>,
  'mutate'
>;

export function useSwrResponse<T>(
  data: T | undefined,
  swr1: Omit<SWRCommon, 'data'>,
  swr2?: Omit<SWRCommon, 'data'>
): SWRCommon<T> {
  return useMemo(() => {
    return {
      isLoading: !!(swr1.isLoading || swr2?.isLoading),
      isValidating: !!(swr1.isValidating || swr2?.isValidating),
      error: swr1.error || swr2?.error,
      data,
    };
  }, [
    data,
    swr1.isLoading,
    swr1.isValidating,
    swr1.error,
    swr2?.isLoading,
    swr2?.isValidating,
    swr2?.error,
  ]);
}

export function useSwrResponseFromReactQuery<T>(
  data: T | undefined,
  queryResult1: Omit<UseQueryResult, 'data'>,
  queryResult2?: Omit<UseQueryResult, 'data'>
): SWRCommon<T> {
  const swr1 = useMemo(
    () => ({
      isLoading: queryResult1.isPending,
      isValidating: queryResult1.isFetching,
      error: queryResult1.error || undefined,
    }),
    [queryResult1]
  );
  const swr2 = useMemo(
    () => ({
      isLoading: !!queryResult2?.isPending,
      isValidating: !!queryResult2?.isFetching,
      error: queryResult2?.error || undefined,
    }),
    [queryResult2]
  );
  return useSwrResponse(data, swr1, swr2);
}
