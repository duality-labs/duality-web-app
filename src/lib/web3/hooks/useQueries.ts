import { useEffect } from 'react';

import { UseInfiniteQueryResult } from '@tanstack/react-query';

export function useFetchAllPaginatedPages(results: UseInfiniteQueryResult) {
  const { fetchNextPage, isFetchingNextPage, hasNextPage } = results;
  // fetch more data if data has changed but there are still more pages to get
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      // cancelRefetch will create a new request for each hook
      // and should not be done here because this is an effect not a user action
      fetchNextPage({ cancelRefetch: false });
    }
  }, [fetchNextPage, isFetchingNextPage, hasNextPage]);
}
