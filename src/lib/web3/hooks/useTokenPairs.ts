import { SWRConfiguration, SWRResponse } from 'swr';
import useSWRInfinite from 'swr/infinite';

import { queryClient } from '../generated/ts-client/nicholasdotsol.duality.dex/module';
import {
  DexTradingPair,
  Api,
} from '../generated/ts-client/nicholasdotsol.duality.dex/rest';

import {
  defaultFetchParams,
  defaultQueryClientConfig,
  getNextPaginationKey,
} from './utils';

type QueryTokenPairsAllRequest = Parameters<
  Api<unknown>['queryTradingPairAll']
>[0];
type QueryTokenPairsAll = Awaited<
  ReturnType<Api<unknown>['queryTradingPairAll']>
>;
type QueryTokenPairsAllList = QueryTokenPairsAll['data']['TradingPair'];
type QueryTokenPairsAllState = {
  data: QueryTokenPairsAllList;
  isValidating: SWRResponse['isValidating'];
  error: SWRResponse['error'];
};

export default function useTokenPairs({
  swr: swrConfig,
  query: queryConfig,
  queryClient: queryClientConfig,
}: {
  swr?: SWRConfiguration;
  query?: QueryTokenPairsAllRequest;
  queryClient?: Parameters<typeof queryClient>[0];
} = {}): QueryTokenPairsAllState {
  const params: QueryTokenPairsAllRequest = {
    ...queryConfig,
    ...defaultFetchParams,
  };
  const client = queryClient({
    ...defaultQueryClientConfig,
    ...queryClientConfig,
  });

  const {
    data: pages,
    isValidating,
    error,
    size,
    setSize,
  } = useSWRInfinite<QueryTokenPairsAll>(
    getNextPaginationKey(
      // set unique cache key for this client method
      client.queryTradingPairAll.toString(),
      params
    ),
    async (_: string, params: QueryTokenPairsAllRequest) => {
      const response: QueryTokenPairsAll = await client.queryTradingPairAll(
        params
      );
      if (response.status === 200) {
        return response;
      } else {
        // remove API error details from public view
        throw new Error(
          `API error code: ${response.status} ${response.statusText}`
        );
      }
      // default to persisting the current size so the list is only resized by 'setSize'
    },
    { persistSize: true, ...swrConfig }
  );
  // set number of pages to latest total
  const pageItemCount = Number(pages?.[0]?.data.TradingPair?.length);
  const totalItemCount = Number(pages?.[0]?.data.pagination?.total);
  if (pageItemCount > 0 && totalItemCount > pageItemCount) {
    const pageCount = Math.ceil(totalItemCount / pageItemCount);
    if (size !== pageCount) {
      setSize(pageCount);
    }
  }
  // place pages of data into the same list
  const tokens = pages?.reduce<DexTradingPair[]>((acc, page) => {
    return acc.concat(page.data.TradingPair || []);
  }, []);
  return { data: tokens, isValidating, error };
}
