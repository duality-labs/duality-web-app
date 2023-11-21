import { useEffect, useState } from 'react';

const { REACT_APP__INDEXER_API = '' } = process.env;

type FlattenSingularItems<T> = T extends [infer U] ? U : T;

type value = string | number;
type BaseDataRow = FlattenSingularItems<[id: value, values: value[]]>;
type BaseDataSet<DataRow extends BaseDataRow> = Map<DataRow['0'], DataRow>;

interface StreamCallbacks<DataRow = BaseDataRow> {
  // onUpdate returns individual update chunks
  onUpdate?: (dataUpdates: DataRow[]) => void;
  // onCompleted indicates when the data stream is finished
  onCompleted?: () => void;
  // allow errors to be seen and handled
  onError?: (error: Error) => void;
}
interface StreamOptions {
  // optional single AbortController for all the requests
  abortController?: AbortController;
}
export class IndexerStream<DataRow = BaseDataRow> {
  // use single AbortController for all the requests
  private abortController = new AbortController();

  constructor(
    relativeURL: URL | string,
    callbacks: StreamCallbacks<DataRow>,
    opts?: StreamOptions
  ) {
    // replace abortController if one is given
    this.abortController = opts?.abortController ?? this.abortController;
    const url = new URL(relativeURL, REACT_APP__INDEXER_API);
    // attempt to subscribe to Server-Sent Events
    this.subscribeToSSE(url, callbacks)
      // fallback to long-polling if not available
      .catch(() => this.subscribeToLongPolling(url, callbacks))
      .catch(() => {
        // eslint-disable-next-line no-console
        console.error(
          `Could not establish a connection to the indexer URL: ${url}`
        );
      });
  }

  private async subscribeToSSE(url: URL, callbacks: StreamCallbacks<DataRow>) {
    return await new Promise<void>((resolve, reject) => {
      // create cancellable SSE event source
      const listenerOptions = { signal: this.abortController.signal };
      try {
        // subscribe to streaming version of URL
        const streamingURL = new URL(url);
        streamingURL.searchParams.append('stream', 'true');
        // add event source and add a cancellation listener
        const eventSource = new EventSource(streamingURL);
        this.abortController.signal.onabort = () => eventSource.close();
        // listen for updates and remove listener if aborted
        eventSource.addEventListener(
          'update',
          (e: MessageEvent<string>) => {
            let dataUpdates: DataRow[] | undefined;
            if (e.data) {
              try {
                dataUpdates = JSON.parse(e.data) as DataRow[];
              } catch (err) {
                reject(
                  new Error(`Could not parse data: ${e.data}`, {
                    cause: err instanceof Error ? err : new Error(`${err}`),
                  })
                );
              }
            }
            if (dataUpdates) {
              // send update directly to listener
              callbacks.onUpdate?.(dataUpdates);
            }
          },
          listenerOptions
        );
        // 'end' message is sent if a data stream is complete
        eventSource.addEventListener(
          'end',
          () => {
            // send onCompleted event to listener
            callbacks.onCompleted?.();
            // end promise
            resolve();
          },
          listenerOptions
        );
        eventSource.addEventListener('error', (e) => {
          callbacks.onError?.(
            new Error('SSE error', { cause: new Error(e.type) })
          );
        });
      } catch (e) {
        reject(
          new Error('SSE Error', {
            cause: e instanceof Error ? e : new Error(`${e}`),
          })
        );
      }
    })
      // unsubscribe on failure
      .catch(() => this.unsubscribe());
  }

  private async subscribeToLongPolling(
    url: URL,
    callbacks: StreamCallbacks<DataRow>
  ) {
    // todo: add long-polling
    throw new Error('Long-polling not yet implemented');
  }

  // call to unsubscribe from any data stream
  unsubscribe() {
    // abort any current requests
    this.abortController.abort();
  }
}

// abstraction of accumulatation update function that can be replaced if needed
function accumulateUpdates<
  DataRow extends BaseDataRow,
  DataSet extends BaseDataSet<DataRow> = BaseDataSet<DataRow>
>(currentMap: DataSet, dataUpdates: DataRow[]) {
  // create new map or use current map
  const newMap = new Map(currentMap) as DataSet;
  // add data updates to new map
  return accumulateUpdatesUsingMutation(newMap, dataUpdates);
}

// accumulation function that may be quicker than using non-mutation (for React)
function accumulateUpdatesUsingMutation<
  DataRow extends BaseDataRow,
  DataSet extends BaseDataSet<DataRow> = BaseDataSet<DataRow>
>(map: DataSet, dataUpdates: DataRow[]) {
  // add data updates to current map
  for (const row of dataUpdates) {
    map.set(row[0], row);
  }
  return map;
}

interface StreamSingleDataSetCallbacks<
  DataRow extends BaseDataRow,
  DataSet extends BaseDataSet<DataRow> = BaseDataSet<DataRow>
> {
  // onUpdate returns individual update chunks
  onUpdate?: (update: DataRow[]) => void;
  // onCompleted indicates when the data stream is finished
  onCompleted?: (dataSet: DataSet) => void;
  // onAccumulated returns accumulated DataSet so far as a Map
  onAccumulated?: (dataSet: DataSet) => void;
  // allow errors to be seen and handled
  onError?: (error: Error) => void;
}
export class IndexerStreamAccumulateSingleDataSet<
  DataRow extends BaseDataRow,
  DataSet extends BaseDataSet<DataRow> = BaseDataSet<DataRow>
> {
  private dataSet: DataSet = new Map() as DataSet;
  private stream?: IndexerStream<DataRow>;

  constructor(
    relativeURL: URL | string,
    callbacks: StreamSingleDataSetCallbacks<DataRow>,
    opts?: StreamOptions
  ) {
    this.stream = new IndexerStream<DataRow>(
      relativeURL,
      {
        onUpdate: (dataUpdates: DataRow[]) => {
          callbacks.onUpdate?.(dataUpdates);
          // update accumulated dataSet
          const dataSet = this.accumulateDataSet(dataUpdates);
          // send updated dataSet to listener
          callbacks.onAccumulated?.(dataSet);
        },
        onError: callbacks.onError,
        onCompleted: () => callbacks.onCompleted?.(this.dataSet),
      },
      opts
    );
  }

  // abstracted method to update saved dataSet
  private accumulateDataSet = (dataUpdates: DataRow[]) => {
    return this.accumulateUpdates(this.dataSet, dataUpdates);
  };

  // add default accumulation function, but allow it to be replaced if needed
  public accumulateUpdates = accumulateUpdates;

  // call to unsubscribe from any data stream
  unsubscribe() {
    // abort any current requests
    this.stream?.unsubscribe();
  }
}

interface StreamDualDataSetCallbacks<
  DataRow extends BaseDataRow,
  DataSet extends BaseDataSet<DataRow> = BaseDataSet<DataRow>
> {
  // onUpdate returns individual update chunks
  onUpdate?: (update: DataRow[][]) => void;
  // onCompleted indicates when the data stream is finished
  onCompleted?: (dataSet: DataSet[]) => void;
  // onAccumulated returns accumulated DataSet so far as a Map
  onAccumulated?: (dataSet: DataSet[]) => void;
  // allow errors to be seen and handled
  onError?: (error: Error) => void;
}
export class IndexerStreamAccumulateDualDataSet<
  DataRow extends BaseDataRow,
  DataSet extends BaseDataSet<DataRow> = BaseDataSet<DataRow>
> {
  // store data in class instance
  private dataSets: DataSet[] = [new Map(), new Map()] as DataSet[];
  private stream?: IndexerStream<DataRow[]>;

  constructor(
    relativeURL: URL | string,
    callbacks: StreamDualDataSetCallbacks<DataRow>,
    opts?: StreamOptions
  ) {
    this.stream = new IndexerStream<DataRow[]>(
      relativeURL,
      {
        onUpdate: (dataUpdates: DataRow[][]) => {
          callbacks.onUpdate?.(dataUpdates);
          // update accumulated dataSet
          const dataSet = this.accumulateDataSet(dataUpdates);
          // send updated dataSet to listener
          callbacks.onAccumulated?.(dataSet);
        },
        onError: callbacks.onError,
        onCompleted: () => callbacks.onCompleted?.(this.dataSets),
      },
      opts
    );
  }

  // abstracted method to update saved dataSet
  private accumulateDataSet = (dataUpdates: DataRow[][]) => {
    // create new objects (to escape React referential-equality comparision)
    this.dataSets = [
      this.accumulateUpdates(this.dataSets[0], dataUpdates[0]),
      this.accumulateUpdates(this.dataSets[1], dataUpdates[1]),
    ];
    return this.dataSets;
  };

  // add default accumulation function, but allow it to be replaced if needed
  public accumulateUpdates = accumulateUpdates;

  // call to unsubscribe from any data stream
  unsubscribe() {
    // abort any current requests
    this.stream?.unsubscribe();
  }
}

interface StaleWhileRevalidateState<DataSetOrDataSets> {
  data: DataSetOrDataSets | undefined;
  isValidating: boolean;
  error: Error | undefined;
}
// add higher-level hook to stream real-time DataSet or DataSets of Indexer URL
function useIndexerStream<
  DataRow extends BaseDataRow,
  DataSet = BaseDataSet<DataRow>
>(
  url: URL | string | undefined,
  IndexerClass: typeof IndexerStreamAccumulateSingleDataSet
): StaleWhileRevalidateState<DataSet>;
function useIndexerStream<
  DataRow extends BaseDataRow,
  DataSet = BaseDataSet<DataRow>
>(
  url: URL | string | undefined,
  IndexerClass: typeof IndexerStreamAccumulateDualDataSet
): StaleWhileRevalidateState<DataSet[]>;
function useIndexerStream<
  DataRow extends BaseDataRow,
  DataSet = BaseDataSet<DataRow>
>(
  url: URL | string | undefined,
  IndexerClass:
    | typeof IndexerStreamAccumulateSingleDataSet
    | typeof IndexerStreamAccumulateDualDataSet
): StaleWhileRevalidateState<DataSet | DataSet[]> {
  const [dataset, setDataSet] = useState<DataSet | DataSet[]>();
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [error, setError] = useState<Error>();

  // todo: use deep-compare effect to not cause unneccessary updates from url or opts
  useEffect(() => {
    if (url) {
      setIsValidating(true);
      const stream = new IndexerClass<DataRow>(url, {
        onAccumulated: (dataSet) => {
          // note: the TypeScript here is a bit hacky but this should be ok
          setDataSet(dataSet as unknown as DataSet | DataSet[]);
        },
        onCompleted: () => setIsValidating(false),
        onError: (error) => setError(error),
      });
      return () => {
        stream.unsubscribe();
      };
    }
  }, [IndexerClass, url]);

  return { data: dataset, isValidating, error };
}

// higher-level hook to stream real-time DataSet of Indexer URL
export function useIndexerStreamOfSingleDataSet<
  DataRow extends BaseDataRow,
  DataSet = BaseDataSet<DataRow>
>(url: URL | string | undefined) {
  return useIndexerStream<DataRow, DataSet>(
    url,
    IndexerStreamAccumulateSingleDataSet
  );
}

// higher-level hook to stream real-time DataSets of Indexer URL
export function useIndexerStreamOfDualDataSet<
  DataRow extends BaseDataRow,
  DataSet = BaseDataSet<DataRow>
>(url: URL | string | undefined, opts?: StreamOptions) {
  return useIndexerStream<DataRow, DataSet>(
    url,
    IndexerStreamAccumulateDualDataSet
  );
}

// add higher-level function to fetch multiple pages of data as "one request"
export async function fetchDataFromIndexer<DataRow extends BaseDataRow>(
  baseURL: URL | string,
  IndexerClass: typeof IndexerStreamAccumulateSingleDataSet,
  opts?: StreamOptions
): Promise<BaseDataSet<DataRow>>;
export async function fetchDataFromIndexer<DataRow extends BaseDataRow>(
  baseURL: URL | string,
  IndexerClass: typeof IndexerStreamAccumulateDualDataSet,
  opts?: StreamOptions
): Promise<BaseDataSet<DataRow>[]>;
export async function fetchDataFromIndexer<DataRow extends BaseDataRow>(
  baseURL: URL | string,
  IndexerClass:
    | typeof IndexerStreamAccumulateSingleDataSet
    | typeof IndexerStreamAccumulateDualDataSet,
  opts?: StreamOptions
): Promise<BaseDataSet<DataRow> | BaseDataSet<DataRow>[]> {
  return new Promise((resolve, reject) => {
    const url = new URL(baseURL, REACT_APP__INDEXER_API);
    // set max height to now, which will cause the request to end at now height
    const before = Date.now() / 1000;
    url.searchParams.append('pagination.before', before.toFixed(0));
    // add stream listener and resolve promise on completion
    const stream = new IndexerClass<DataRow>(
      url,
      {
        onCompleted: (data) => {
          stream.unsubscribe();
          resolve(data);
        },
        onError: reject,
      },
      opts
    );
    // allow mutation in this stream accumulator because we won't listen to
    // individual data updates
    stream.accumulateUpdates = accumulateUpdatesUsingMutation;
  });
}
