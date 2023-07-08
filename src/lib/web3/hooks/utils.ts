import { PageResponseSDKType } from '@duality-labs/dualityjs/types/codegen/cosmos/base/query/v1beta1/pagination';
import { PageRequest } from '@duality-labs/dualityjs/types/codegen/helpers';
import Long from 'long';

export function getNextPaginationKey<
  RequestType extends { pagination?: Partial<PageRequest> | undefined }
>(path: string, params: RequestType) {
  return (
    _: number,
    lastPage: { pagination: PageResponseSDKType }
  ): [key: string, params: RequestType] | null => {
    const nextKey = lastPage?.pagination?.next_key;
    return lastPage
      ? // get next key or null (null will de-activate fetcher)
        nextKey && nextKey.length > 0
        ? // insert next key into query params
          [
            path,
            {
              ...params,
              pagination: {
                ...params?.pagination,
                // the types say it is a UInt8Array, but it seems to be a string
                key:
                  typeof nextKey === 'string'
                    ? bytesFromBase64(nextKey)
                    : nextKey,
              },
            },
          ]
        : // request to cancel the chain of requests
          null
      : // pass params as given
        [path, params];
  };
}

export const defaultPaginationParams: PageRequest = {
  key: new Uint8Array(),
  offset: Long.fromNumber(0),
  limit: Long.fromNumber(1000),
  countTotal: true,
  reverse: false,
};

function bytesFromBase64(base64String: string): Uint8Array {
  const buffer = Buffer.from(base64String, 'base64');
  return new Uint8Array(buffer);
}
