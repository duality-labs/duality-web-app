import { SWRConfiguration, SWRResponse } from 'swr';
import useSWRInfinite from 'swr/infinite';

import {
  QueryAllTradingPairRequest,
  QueryAllTradingPairResponseSDKType,
} from '@duality-labs/dualityjs/types/codegen/duality/dex/query';
import { useLcdClientPromise } from '../lcdClient';
import { TradingPairSDKType } from '@duality-labs/dualityjs/types/codegen/duality/dex/trading_pair';

import { defaultPaginationParams, getNextPaginationKey } from './utils';

type QueryTradingPairsAllList =
  QueryAllTradingPairResponseSDKType['TradingPair'];
type QueryTokenPairsAllState = {
  data: QueryTradingPairsAllList | undefined;
  isValidating: SWRResponse['isValidating'];
  error: SWRResponse['error'];
};

export default function useTokenPairs({
  swr: swrConfig,
  query: queryConfig,
  queryClient: queryClientConfig,
}: {
  swr?: SWRConfiguration;
  query?: QueryAllTradingPairRequest;
  queryClient?: string;
} = {}): QueryTokenPairsAllState {
  const params: QueryAllTradingPairRequest = {
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
  } = useSWRInfinite<QueryAllTradingPairResponseSDKType>(
    getNextPaginationKey<QueryAllTradingPairRequest>(
      // set unique cache key for this client method
      'dualitylabs.duality.dex.tradingPairAll',
      params
    ),
    async ([, params]: [paths: string, params: QueryAllTradingPairRequest]) => {
      const client = await lcdClientPromise;
      return await client.dualitylabs.duality.dex.tradingPairAll(params);
    },
    { persistSize: true, ...swrConfig }
  );
  // set number of pages to latest total
  const pageItemCount = Number(pages?.[0]?.TradingPair?.length);
  const totalItemCount = Number(pages?.[0]?.pagination?.total);
  if (pageItemCount > 0 && totalItemCount > pageItemCount) {
    const pageCount = Math.ceil(totalItemCount / pageItemCount);
    if (size !== pageCount) {
      setSize(pageCount);
    }
  }
  // place pages of data into the same list
  const tradingPairs = pages?.reduce<TradingPairSDKType[]>((acc, page) => {
    return acc.concat(page.TradingPair || []);
  }, []);
  return { data: tradingPairs, isValidating, error };
}
