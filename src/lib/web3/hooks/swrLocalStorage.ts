import { Middleware, SWRHook, SWRConfiguration } from 'swr';
import ms from 'ms';

export class KeyWithModifiedTime {
  data: unknown = undefined;
  modifiedDate: Date | undefined;
  constructor(data: unknown, modifiedDate: Date) {
    this.data = data;
    this.modifiedDate = modifiedDate;
  }
  toString() {
    return JSON.stringify([this.data, this.modifiedDate]);
  }
}

// This is a SWR middleware for storing results in localStorage and avoiding
// fetching on mount unless the data is considered stale
export default function createLocalStorageMiddleware(msCacheTime: number) {
  return function swrLocalStorageMiddleware(
    useSWRNext: SWRHook
  ): ReturnType<Middleware> {
    return (key, fetcher, config) => {
      const localStorageKey = `swr-cache:${JSON.stringify(key)}`;

      let cachedData: Data = undefined;
      const foundCache = localStorage?.getItem(localStorageKey);
      if (foundCache) {
        try {
          const { data, time: storageTime } = decodeData(foundCache);
          const staleTimeValue = Date.now() - msCacheTime;
          if (storageTime.valueOf() < staleTimeValue) {
            cachedData = data;
            // return { data, error: undefined, isLoading: false, isValidating: false, mutate: async() => undefined }
          }
        } catch {
          // remove cache and continue
          localStorage?.removeItem(localStorageKey);
        }
      }

      // use given SWR fetcher and config, but use cached data as initial data
      // if the data exists: SWR will not use the fetcher
      const swr = useSWRNext(key, fetcher, {
        revalidateOnMount: false,
        initialData: cachedData,
        ...config,
      });

      if (localStorage) {
        localStorage.setItem(localStorageKey, encodeData(swr.data));
      }

      // return fetched data state
      return swr;
    };
  };
}

// specify SWR expected data type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Data = any | undefined;

function encodeData(data: Data, time = new Date()): string {
  return JSON.stringify({ data, time: time.toISOString() });
}

function decodeData(dataString: string): { data: Data; time: Date } {
  const { data, time } = JSON.parse(dataString);
  return { data, time: new Date(time) };
}

export const swrLocalStorageConfig: SWRConfiguration = {
  // add defaults to not revalidate as if using 'swr/immutable'
  // https://swr.vercel.app/docs/revalidation#disable-automatic-revalidations
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  // add middleware
  use: [createLocalStorageMiddleware(ms('1 hour'))],
};
