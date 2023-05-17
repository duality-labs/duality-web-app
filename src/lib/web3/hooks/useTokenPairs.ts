import { SWRConfiguration, SWRResponse } from 'swr';
import useSWRInfinite from 'swr/infinite';

import {
  QueryAllTokenMapRequest,
  QueryAllTokenMapResponseSDKType,
} from '@duality-labs/dualityjs/types/codegen/duality/dex/query';
import { useLcdClientPromise } from '../lcdClient';
import { TokenMapSDKType } from '@duality-labs/dualityjs/types/codegen/duality/dex/token_map';

import { defaultPaginationParams, getNextPaginationKey } from './utils';

type QueryAllTokenMapList = QueryAllTokenMapResponseSDKType['tokenMap'];
type QueryAllTokenMapState = {
  data: QueryAllTokenMapList | undefined;
  isValidating: SWRResponse['isValidating'];
  error: SWRResponse['error'];
};

export default function useTokenPairs({
  swr: swrConfig,
  query: queryConfig,
  queryClient: queryClientConfig,
}: {
  swr?: SWRConfiguration;
  query?: QueryAllTokenMapRequest;
  queryClient?: string;
} = {}): QueryAllTokenMapState {
  const params: QueryAllTokenMapRequest = {
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
  } = useSWRInfinite<QueryAllTokenMapResponseSDKType>(
    getNextPaginationKey<QueryAllTokenMapRequest>(
      // set unique cache key for this client method
      'dualitylabs.duality.dex.tokenMapAll',
      params
    ),
    async ([, params]: [paths: string, params: QueryAllTokenMapRequest]) => {
      const client = await lcdClientPromise;
      return await client.dualitylabs.duality.dex.tokenMapAll(params);
    },
    { persistSize: true, ...swrConfig }
  );
  // set number of pages to latest total
  const pageItemCount = Number(pages?.[0]?.tokenMap?.length);
  const totalItemCount = Number(pages?.[0]?.pagination?.total);
  if (pageItemCount > 0 && totalItemCount > pageItemCount) {
    const pageCount = Math.ceil(totalItemCount / pageItemCount);
    if (size !== pageCount) {
      setSize(pageCount);
    }
  }
  // place pages of data into the same list
  const tradingPairs = pages?.reduce<TokenMapSDKType[]>((acc, page) => {
    return acc.concat(page.tokenMap || []);
  }, []);
  return { data: tradingPairs, isValidating, error };
}
