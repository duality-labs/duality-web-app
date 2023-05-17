import { useMemo } from 'react';
import { SWRConfiguration, SWRResponse } from 'swr';
import useSWRInfinite from 'swr/infinite';

import {
  QueryAllTickLiquidityRequest,
  QueryAllTickLiquidityResponseSDKType,
} from '@duality-labs/dualityjs/types/codegen/duality/dex/query';
import { useLcdClientPromise } from '../lcdClient';

import { defaultPaginationParams, getNextPaginationKey } from './utils';

type QueryAllTickLiquidityList =
  QueryAllTickLiquidityResponseSDKType['tickLiquidity'];
type QueryAllTickLiquidityState = {
  data: QueryAllTickLiquidityList | undefined;
  isValidating: SWRResponse['isValidating'];
  error: SWRResponse['error'];
};

export default function useTickLiquidity({
  swr: swrConfig,
  query: queryConfig,
  queryClient: queryClientConfig,
}: {
  swr?: SWRConfiguration;
  query: QueryAllTickLiquidityRequest;
  queryClient?: string;
}): QueryAllTickLiquidityState {
  if (!queryConfig?.pairId) {
    throw new Error('Cannot fetch liquidity: no pair ID given');
  }
  if (!queryConfig?.tokenIn) {
    throw new Error('Cannot fetch liquidity: no token ID given');
  }

  const params: QueryAllTickLiquidityRequest = {
    ...queryConfig,
    pagination: {
      ...defaultPaginationParams,
      ...queryConfig?.pagination,
    },
  };

  const lcdClientPromise = useLcdClientPromise(queryClientConfig);

  const {
    data: pages,
    isValidating,
    error,
    size,
    setSize,
  } = useSWRInfinite<QueryAllTickLiquidityResponseSDKType>(
    getNextPaginationKey<QueryAllTickLiquidityRequest>(
      // set unique cache key for this client method
      'dualitylabs.duality.dex.tickLiquidityAll',
      params
    ),
    async ([, params]: [_: string, params: QueryAllTickLiquidityRequest]) => {
      const client = await lcdClientPromise;
      return await client.dualitylabs.duality.dex.tickLiquidityAll(params);
    },
    { persistSize: true, ...swrConfig }
  );
  // set number of pages to latest total
  const pageItemCount = Number(pages?.[0]?.tickLiquidity?.length);
  const totalItemCount = Number(pages?.[0]?.pagination?.total);
  if (pageItemCount > 0 && totalItemCount > pageItemCount) {
    const pageCount = Math.ceil(totalItemCount / pageItemCount);
    if (size !== pageCount) {
      setSize(pageCount);
    }
  }
  // place pages of data into the same list
  const tradingPairs = useMemo(() => {
    const liquidity = pages?.flatMap((page) => page.tickLiquidity);
    return liquidity && transformData(liquidity);
  }, [pages]);
  return { data: tradingPairs, isValidating, error };
}
