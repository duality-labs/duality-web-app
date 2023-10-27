import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { seconds } from '../../utils/time';

const { REACT_APP__INDEXER_API = '' } = process.env;

interface IndexerLongPollingResponse<DataSet extends unknown[]> {
  block_range: {
    from_height: number; // range from (non-incluse)
    to_height: number; // range to (inclusive)
  };
  data: DataSet;
  pagination: { next_key: string; total?: number };
}

const defaultPaginationLimit = 1000;

export function useRequestLongPolling<DataSet extends unknown[]>(
  path = '',
  {
    query = {},
    paginationLimit = defaultPaginationLimit,
    combineDataSets,
  }: {
    query: Record<string, string>;
    paginationLimit: number;
    combineDataSets: (dataset: DataSet, response: DataSet) => DataSet;
  }
): {
  data: DataSet | undefined;
  error: Error | null;
  isValidating: boolean;
} {
  const [knownHeight, setKnownChainHeight] = useState<number>();

  const {
    data,
    error,
    isFetching: isValidating,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    // note: don't allow "update requests" to be considered stale (refetchable):
    // when a component loads this hook and this hook contains cached data,
    // the component will receive the cached progressive update request pages
    // in order starting from `knownHeight = undefined`, this works well.
    // but if the data is considered stale then useQuery will send out a request
    // for each cached page the component reads, generating a lot of requests
    // and cancelled requests as the component catches up on the known heights
    staleTime: Infinity,
    // note: we don't want to persist the data too long, because the hook
    // will basically loop through all cached heights to build the liquidity
    // and while this is fast, it can take a lot of time if there are many known
    // heights to process. So we remove these values from the cache early.
    gcTime: 30 * seconds,
    queryKey: [path, query, knownHeight],
    enabled: !!path,
    queryFn: async ({
      pageParam: { nextKey = undefined, height = undefined } = {},
      signal,
    }): Promise<IndexerLongPollingResponse<DataSet>> => {
      // build query params
      const queryParams = new URLSearchParams(query);
      // add pagination params
      if (nextKey) {
        queryParams.append('pagination.key', nextKey);
      } else {
        // return the item count information for stats and debugging
        queryParams.append('pagination.count_total', 'true');
        queryParams.append('pagination.limit', paginationLimit.toFixed());
      }
      // add block range params
      // if we know a certain height already, we may request a partial update
      if (knownHeight && knownHeight > 0) {
        // an update with `block_range.from_height` may take a while to resolve.
        // if the chain has no updates since the known height it will wait
        // until there is new data and send through the update from this height.
        queryParams.append('block_range.from_height', knownHeight.toFixed(0));
      }
      // if we are requesting several pages of results, ensure the same height
      // is fetched for all subsequent request pages
      if (height && height > 0) {
        // a known issue that may be possibly experienced with multiple indexers
        // is that the liquidity data of a pair cannot be guaranteed to be found
        // for a historic height. we rely on the initial (page 0) request from
        // a front end client to populate a specific height cache in the
        // indexer so that it may be found for the subsequest page requests.
        // link: https://github.com/duality-labs/hapi-indexer/issues/22
        // these requests may fail with a 412: Precondition Failed error.
        queryParams.append('block_range.to_height', height.toFixed(0));
      }
      // request with appropriate query
      const urlPath = `${REACT_APP__INDEXER_API}${path}`;
      const url = `${urlPath}${
        queryParams.toString() ? `?${queryParams}` : ''
      }`;
      const response = await fetch(url, { signal });
      // get reserve with Indexer result type
      return await response.json();
    },
    defaultPageParam: undefined,
    getNextPageParam: (lastPage: IndexerLongPollingResponse<DataSet>) => {
      // don't pass an empty array as that will trigger another page to download
      return lastPage?.pagination?.next_key?.length
        ? // return key and also height to request the right height of next page
          {
            nextKey: lastPage?.pagination?.next_key,
            height: lastPage?.block_range.to_height,
          }
        : // return undefined to indicate this as the last page and stop
          undefined;
    },
  });

  // fetch more data if data has changed but there are still more pages to get
  useEffect(() => {
    // note: when a new request chain is started, data becomes `undefined`
    if (data) {
      // fetch following page
      if (hasNextPage) {
        fetchNextPage?.();
      }
      // if the end of pages has been reached, set the new known height
      else {
        setKnownChainHeight(data.pages?.at(-1)?.block_range.to_height);
      }
    }
  }, [data, fetchNextPage, hasNextPage]);

  // place pages of data into the same list
  const lastData = useRef<DataSet>();
  const combinedData = useMemo(() => {
    // when refetching, the library sets `data` to `undefined`
    // I think this is unintuitive. we should only "empty" the data here
    // if a response comes back with an empty array, otherwise we keep the state
    const pages = data?.pages;
    if (pages && pages.length > 0) {
      const lastPage = pages[pages.length - 1];
      // update our state only if the last page of data has been reached
      if (lastPage && !lastPage.pagination?.next_key?.length) {
        // check if these pages are intended to be updates (partial content)
        if (lastPage?.block_range.from_height) {
          // double check this update can be applied to the known state
          if (lastPage?.block_range.from_height === knownHeight) {
            const dataset = lastData.current ?? ([] as unknown[]);
            lastData.current = pages
              .map((page) => page.data)
              .reduce(combineDataSets, dataset as DataSet);
          } else {
            // eslint-disable-next-line no-console
            console.error(
              'An update was received but there is no base to apply it to'
            );
          }
        }
        // no updateFromHeight should indicate this is a complete update
        else {
          lastData.current = pages
            .map((page) => page.data)
            .reduce(combineDataSets, [] as unknown[] as DataSet);
        }
      }
    }
    return lastData.current;
  }, [combineDataSets, data?.pages, knownHeight]);
  return { data: combinedData, isValidating, error };
}
