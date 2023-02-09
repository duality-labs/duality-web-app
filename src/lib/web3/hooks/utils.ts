import { V1Beta1PageResponse } from '../generated/ts-client/nicholasdotsol.duality.dex/rest';

const { REACT_APP__REST_API } = process.env;

export function getNextPaginationKey(
  _: number,
  lastPage: { data: { pagination: V1Beta1PageResponse } }
) {
  return lastPage
    ? // get next key or null (null will de-activate fetcher)
      lastPage?.data?.pagination?.next_key ?? null
    : // use undefined in a tuple to activate fetcher but with an `undefined` key
      [undefined];
}

export type TokenAddress = string; // a valid hex address, eg. 0x01

export const defaultFetchParams = {
  'pagination.limit': '1000',
  'pagination.count_total': true,
};

export const defaultQueryClientConfig = { addr: REACT_APP__REST_API || '' };
