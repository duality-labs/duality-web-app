import { V1Beta1PageResponse } from '../generated/ts-client/nicholasdotsol.duality.dex/rest';

const { REACT_APP__REST_API } = process.env;

export function getNextPaginationKey<
  RequestType extends { 'pagination.key'?: string } | undefined
>(path: string, params: RequestType) {
  return (
    _: number,
    lastPage: { data: { pagination: V1Beta1PageResponse } }
  ): [key: string, params: RequestType] | null => {
    return lastPage
      ? // get next key or null (null will de-activate fetcher)
        (lastPage?.data?.pagination?.next_key ?? '').length > 0
        ? // insert next key into query params
          [
            path,
            {
              ...params,
              'pagination.key': lastPage?.data?.pagination.next_key,
            },
          ]
        : // request to cancel the chain of requests
          null
      : // pass params as given
        [path, params];
  };
}

export const defaultFetchParams = {
  'pagination.limit': '1000',
  'pagination.count_total': true,
};

export const defaultQueryClientConfig = { addr: REACT_APP__REST_API || '' };
