import { SWRConfiguration, SWRResponse } from 'swr';
import useSWRInfinite from 'swr/infinite';

import { queryClient } from '../generated/ts-client/nicholasdotsol.duality.dex/module';
import {
  DexTokens,
  Api,
} from '../generated/ts-client/nicholasdotsol.duality.dex/rest';

import {
  defaultFetchParams,
  defaultQueryClientConfig,
  getNextPaginationKey,
} from './utils';

type QueryTokensAll = Awaited<ReturnType<Api<unknown>['queryTokensAll']>>;
type QueryTokensAllList = QueryTokensAll['data']['Tokens'];
type QueryTokensAllState = {
  data: QueryTokensAllList;
  isValidating: SWRResponse['isValidating'];
  error: SWRResponse['error'];
};

export default function useTokens({
  swr: swrConfig,
  query: queryConfig,
  queryClient: queryClientConfig,
}: {
  swr?: SWRConfiguration;
  query?: Parameters<Api<unknown>['queryTokensAll']>[0];
  queryClient?: Parameters<typeof queryClient>[0];
} = {}): QueryTokensAllState {
  const {
    data: pages,
    isValidating,
    error,
    size,
    setSize,
  } = useSWRInfinite<QueryTokensAll>(
    getNextPaginationKey,
    async (paginationKey: string) => {
      const client = queryClient({
        ...defaultQueryClientConfig,
        ...queryClientConfig,
      });
      const response: QueryTokensAll = await client.queryTokensAll({
        ...defaultFetchParams,
        ...queryConfig,
        'pagination.key': paginationKey,
      });
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
  const pageItemCount = Number(pages?.[0]?.data.Tokens?.length);
  const totalItemCount = Number(pages?.[0]?.data.pagination?.total);
  if (pageItemCount > 0 && totalItemCount > pageItemCount) {
    const pageCount = Math.ceil(totalItemCount / pageItemCount);
    if (size !== pageCount) {
      setSize(pageCount);
    }
  }
  // place pages of data into the same list
  const tokens = pages?.reduce<DexTokens[]>((acc, page) => {
    return acc.concat(page.data.Tokens || []);
  }, []);
  return { data: tokens, isValidating, error };
}
