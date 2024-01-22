export async function fetchJSON(url: string) {
  return fetch(url).then((res) => {
    if (res.status >= 400) {
      throw new Error('Bad response');
    }
    return res.json();
  });
}

const globalCachePromises = new Map<string, Promise<unknown>>();

export function getCachedValue<
  Data = unknown,
  T = string | (string | undefined)[]
>(key: T, fetcher: (key: T) => Promise<Data>): Promise<Data> {
  const cacheKey = typeof key === 'string' ? key : JSON.stringify(key);
  const oldPromise = globalCachePromises.get(cacheKey) as Promise<Data>;
  if (oldPromise) {
    return oldPromise;
  }
  const newPromise = fetcher(key);
  globalCachePromises.set(cacheKey, newPromise);
  return newPromise;
}
