import { SWRConfiguration, SWRResponse } from 'swr';
import useSWRInfinite from 'swr/infinite';

import {
  QueryAllTokensRequest,
  QueryAllTokensResponseSDKType,
} from '@duality-labs/dualityjs/types/codegen/duality/dex/query';
import { useLcdClientPromise } from '../lcdClient';
import { TokensSDKType } from '@duality-labs/dualityjs/types/codegen/duality/dex/tokens';

import { defaultPaginationParams, getNextPaginationKey } from './utils';

type QueryAllTokensList = QueryAllTokensResponseSDKType['Tokens'];
type QueryAllTokensState = {
  data: QueryAllTokensList | undefined;
  isValidating: SWRResponse['isValidating'];
  error: SWRResponse['error'];
};

export default function useTokenPairs({
  swr: swrConfig,
  query: queryConfig,
  queryClient: queryClientConfig,
}: {
  swr?: SWRConfiguration;
  query?: QueryAllTokensRequest;
  queryClient?: string;
} = {}): QueryAllTokensState {
  const params: QueryAllTokensRequest = {
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
  } = useSWRInfinite<QueryAllTokensResponseSDKType>(
    getNextPaginationKey<QueryAllTokensRequest>(
      // set unique cache key for this client method
      'dualitylabs.duality.dex.tokensAll',
      params
    ),
    async ([, params]: [paths: string, params: QueryAllTokensRequest]) => {
      const client = await lcdClientPromise;
      return await client.dualitylabs.duality.dex.tokensAll(params);
    },
    { persistSize: true, ...swrConfig }
  );
  // set number of pages to latest total
  const pageItemCount = Number(pages?.[0]?.Tokens?.length);
  const totalItemCount = Number(pages?.[0]?.pagination?.total);
  if (pageItemCount > 0 && totalItemCount > pageItemCount) {
    const pageCount = Math.ceil(totalItemCount / pageItemCount);
    if (size !== pageCount) {
      setSize(pageCount);
    }
  }
  // place pages of data into the same list
  const tradingPairs = pages?.reduce<TokensSDKType[]>((acc, page) => {
    return acc.concat(page.Tokens || []);
  }, []);
  return { data: tradingPairs, isValidating, error };
}
