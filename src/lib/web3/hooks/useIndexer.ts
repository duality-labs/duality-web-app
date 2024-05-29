import useSWR from 'swr';
import useSWRSubscription, { SWRSubscription } from 'swr/subscription';
import {
  EventStreamContentType,
  fetchEventSource,
} from '@microsoft/fetch-event-source';
import { useMemo } from 'react';
import { seconds } from '../../utils/time';

const { REACT_APP__INDEXER_API = '', REACT_APP__INDEXER_API_KEY = '' } =
  import.meta.env;

type Value = string | number;
type BlockTimestamp = number;
export type BaseTimeSeriesSSERow = {
  block_tmstmp: BlockTimestamp;
  block_hght: number;
};
export type BaseTimeSeriesSSEPage = { data: BaseTimeSeriesSSERow };
export type BaseLiquiditySSEPage = BaseTimeSeriesSSERow;
export type BaseStatsDataSSERow = { tmstmp: BlockTimestamp };
export type BaseStatsDataSSEPage = {
  current: BaseStatsDataSSERow;
  hour24: BaseStatsDataSSERow;
  hour48: BaseStatsDataSSERow;
};
type BaseDataRow =
  | BaseLiquiditySSEPage
  | BaseTimeSeriesSSEPage
  | BaseTimeSeriesSSERow
  | BaseStatsDataSSEPage;
type BaseDataSet<DataRow extends BaseDataRow> = Map<
  Value,
  DataRow | Value | Value[]
>;

export type IndexerPage<DataRow = BaseDataRow> = {
  shape:
    | [[string, string | string[]]]
    | [[[string, string | string[]]], [[string, string | string[]]]];
  data: Array<DataRow>;
  pagination?: {
    next_key?: string | null;
  };
  block_range?: {
    from_height: number;
    to_height: number;
  };
};

function getDataHeight<DataRow extends BaseDataRow>(
  dataUpdate: DataRow
): BlockTimestamp {
  return (
    (dataUpdate as BaseLiquiditySSEPage)?.block_tmstmp ??
    (dataUpdate as BaseTimeSeriesSSEPage)?.data?.block_tmstmp ??
    (dataUpdate as BaseStatsDataSSEPage)?.current?.tmstmp
  );
}

interface StreamCallbacks<DataRow> {
  // onUpdate returns individual update chunks
  onUpdate?: (dataUpdates: DataRow[], height: number) => void;
  // onCompleted indicates when the data stream is finished
  onCompleted?: () => void;
  // allow errors to be seen and handled
  onError?: (error: Error) => void;
  // allow retriable errors to be seen
  onRetry?: (error: Error) => void;
}
interface StreamOptions {
  // optional single AbortController for all the requests
  abortController?: AbortController;
  // allow SSE requests to be disabled (they are slower to start)
  disableSSE?: boolean;
}
export interface AccumulatorOptions<DataRow extends BaseDataRow> {
  // define how the accumulator class should store the data
  getDataUpdateKey?: (dataRow: DataRow) => Value;
  getDataUpdateValue?: (dataRow: DataRow) => DataRow | Value | Value[];
  dataSetCount?: number;
  separateUpdates?: (dataUpdate: DataRow[]) => DataRow[][];
  // optional value to remove from accumulator maps
  // (0 values should be removed from liquidity maps)
  removeEntryMatch?: (dataRow: DataRow) => boolean;
  // optional initial setting of the accumulateUpdates function
  accumulateUpdates?: typeof accumulateUpdatesUsingMutation;
}
export class IndexerStream<DataRow extends BaseDataRow> {
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
    new Promise<void>((resolve, reject) => {
      if (!opts?.disableSSE) {
        resolve();
      } else {
        reject('skip SSE and go to fallback methods');
      }
    })
      // primarily attempt to use a SSE connection
      .then(() => this.subscribeToSSE(url, callbacks))
      .catch((e) => {
        // unsubscribe on failure of all methods
        this.unsubscribe();
        // eslint-disable-next-line no-console
        console.error(
          `Could not establish a connection to the indexer URL: ${url}`
        );
        // send error to be handled
        callbacks.onError?.(e instanceof Error ? e : new Error(`${e}`));
      });
  }

  private async subscribeToSSE(url: URL, callbacks: StreamCallbacks<DataRow>) {
    return await new Promise<void>((resolve, reject) => {
      // add "/sse" to get SSE endpoint of path
      const sseURL = new URL(`${url.pathname}/sse${url.search}`, url);

      // create cancellable SSE event source
      try {
        class RetriableError extends Error {}
        class FatalError extends Error {}
        let retryInterval: number = 0;

        // add event source connected to theinstance abortController
        fetchEventSource(sseURL.toString(), {
          headers: {
            auth_token: `${REACT_APP__INDEXER_API_KEY}`,
          },
          signal: this.abortController.signal,
          async onopen(response) {
            // content type might be "text/event-stream; charset=utf-8"
            const contentType = [
              ...(response.headers.get('content-type')?.split(';') ?? []),
            ];
            if (response.ok && contentType.includes(EventStreamContentType)) {
              // response is good: reset the retry interval
              retryInterval = 0;
            }
            // abort wrong type of request
            else if (!contentType.includes(EventStreamContentType)) {
              throw new FatalError(`Unexpected content type: ${contentType}`);
            }
            // client-side errors are usually non-retriable,
            // but allow HTTP 429 (too many requests) to be retryable
            else if (
              response.status >= 400 &&
              response.status < 500 &&
              response.status !== 429
            ) {
              throw new FatalError(`Unexpected status: ${response.status}`);
            }
            // retry other types of errors
            else {
              throw new RetriableError(`Unexpected status: ${response.status}`);
            }
          },
          // listen for updates and remove listener if aborted
          onmessage(ev) {
            // skip empty data
            if (!ev?.data) return;
            switch (ev.data) {
              case 'initial payload': {
                // there is no information here
                break;
              }
              default: {
                // assume the payload is a data update
                const dataUpdate = parseData<DataRow>(ev.data);
                const heightOfData = getDataHeight(dataUpdate);
                // todo: collect dataUpdates for each height to send onUpdate
                callbacks.onUpdate?.([dataUpdate], heightOfData);
              }
            }
            function parseData<DataRow>(data: string): DataRow {
              try {
                return JSON.parse(data);
              } catch (err) {
                // allow the subscription to be restarted on unexpected data
                throw new RetriableError(`Could not parse data: ${data}`, {
                  cause: err instanceof Error ? err : new Error(`${err}`),
                });
              }
            }
          },
          onclose() {
            // if the request was cancelled then don't retry
            if (this?.signal?.aborted) {
              throw new FatalError('Expected close (aborted)');
            }
            // if the server closes the connection unexpectedly, retry:
            else {
              throw new RetriableError('Unexpected close');
            }
          },
          onerror(err) {
            if (err instanceof FatalError || this?.signal?.aborted) {
              // send fatal error to parent
              callbacks.onError?.(err);
              // rethrow to stop the operation
              throw new Error(
                `SSE response was not ok for ${sseURL.toString()}`,
                { cause: err }
              );
            } else {
              // send non-fatal error to parent
              callbacks.onRetry?.(err);
              // return retry interval here (and increase the back-off linearly)
              return (retryInterval += 1 * seconds);
            }
          },
        }).then(resolve);
      } catch (e) {
        reject(
          new Error('SSE Error', {
            cause: e instanceof Error ? e : new Error(`${e}`),
          })
        );
      }
    });
  }

  // call to unsubscribe from any data stream
  unsubscribe() {
    // abort any current requests
    this.abortController.abort();
  }
}

// accumulation function that can be used to allow React to "react" to
// each data update as a new object (breaking referential-equality comparision)
function accumulateUpdatesToNewState<
  DataRow extends BaseDataRow,
  DataSet extends BaseDataSet<DataRow>
>(
  currentMaps: DataSet[],
  dataUpdatesForEachSet: DataRow[][],
  opts: AccumulatorOptions<DataRow>
) {
  // create new map: this will allow React hooks to function as expected,
  // each new update returns a new Map object (not the same but mutated object)
  const newMaps = currentMaps.map((map) => new Map(map) as DataSet);
  // add data updates to new map
  return accumulateUpdatesUsingMutation(newMaps, dataUpdatesForEachSet, opts);
}

// accumulation function that may be quicker than using non-mutation (for React)
function accumulateUpdatesUsingMutation<
  DataRow extends BaseDataRow,
  DataSet extends BaseDataSet<DataRow>
>(
  currentMaps: DataSet[],
  dataUpdatesForEachSet: DataRow[][],
  opts: AccumulatorOptions<DataRow>
) {
  // add data updates to current maps
  for (let i = 0; i < dataUpdatesForEachSet.length; i++) {
    const map = currentMaps[i];
    const dataUpdates = dataUpdatesForEachSet[i];
    if (map && dataUpdates) {
      for (const dataUpdate of dataUpdates) {
        const [key, value] = [
          opts.getDataUpdateKey?.(dataUpdate) || getDataHeight(dataUpdate),
          opts.getDataUpdateValue?.(dataUpdate) || (dataUpdate as DataRow),
        ];
        // remove keys if the data is defined as "empty"
        if (opts.removeEntryMatch?.(dataUpdate)) {
          map.delete(key);
        } else {
          map.set(key, value);
        }
      }
    }
  }
  return currentMaps;
}

// accumulation function that disregards state and returns only the last update
function accumulateLastUpdateOnlyToNewState<
  DataRow extends BaseDataRow,
  DataSet extends BaseDataSet<DataRow> = BaseDataSet<DataRow>
>(
  _currentMaps: DataSet[],
  dataUpdatesForEachSet: DataRow[][],
  opts: AccumulatorOptions<DataRow>
) {
  // add data updates to a new map (ignore previous state)
  const newMaps = Array.from({ length: opts?.dataSetCount || 1 }).map<DataSet>(
    () => new Map() as DataSet
  );
  return accumulateUpdatesUsingMutation(newMaps, dataUpdatesForEachSet, opts);
}

// todo: StreamSingleDataSetCallbacks could extend from StreamMultipleDataSetsCallbacks
interface StreamSingleDataSetCallbacks<
  DataRow extends BaseDataRow,
  DataSet extends BaseDataSet<DataRow> = BaseDataSet<DataRow>
> extends Omit<StreamCallbacks<DataRow>, 'onCompleted'> {
  // onCompleted indicates when the data stream is finished
  onCompleted?: (dataSet: DataSet, height: number) => void;
  // onAccumulated returns accumulated DataSet so far as a Map
  onAccumulated?: (dataSet: DataSet, height: number, update: DataRow[]) => void;
}
export class IndexerStreamAccumulateSingleDataSet<
  DataRow extends BaseDataRow,
  DataSet extends BaseDataSet<DataRow> = BaseDataSet<DataRow>
> {
  // store data in class instance
  private dataSet: DataSet = new Map() as DataSet;
  private dataHeight = 0;
  private stream?: IndexerStream<DataRow>;

  constructor(
    relativeURL: URL | string,
    callbacks: StreamSingleDataSetCallbacks<DataRow, DataSet>,
    opts?: AccumulatorOptions<DataRow> & StreamOptions
  ) {
    this.stream = new IndexerStream<DataRow>(
      relativeURL,
      {
        onUpdate: (update: DataRow[], dataHeight: number) => {
          callbacks.onUpdate?.(update, dataHeight);
          // update accumulated dataSet
          this.dataHeight = dataHeight;
          this.dataSet = this.accumulateDataSet([update], opts);
          // send updated dataSet to listener
          callbacks.onAccumulated?.(this.dataSet, this.dataHeight, update);
        },
        onError: callbacks.onError,
        onRetry: callbacks.onRetry,
        onCompleted: () =>
          callbacks.onCompleted?.(this.dataSet, this.dataHeight),
      },
      {
        abortController: opts?.abortController,
        disableSSE: opts?.disableSSE,
      }
    );
  }

  // abstracted method to update saved dataSet
  private accumulateDataSet = (
    dataUpdates: DataRow[][],
    opts: AccumulatorOptions<DataRow> = {}
  ) => {
    // save set to class instance and return
    this.dataSet = this.accumulateUpdates([this.dataSet], dataUpdates, opts)[0];
    return this.dataSet;
  };

  // add default accumulation function, but allow it to be replaced if needed
  public accumulateUpdates = accumulateUpdatesUsingMutation;

  // call to unsubscribe from any data stream
  unsubscribe() {
    // abort any current requests
    this.stream?.unsubscribe();
  }
}

interface StreamMultipleDataSetsCallbacks<
  DataRow extends BaseDataRow,
  DataSet extends BaseDataSet<DataRow> = BaseDataSet<DataRow>
> extends Omit<StreamCallbacks<DataRow>, 'onUpdate' | 'onCompleted'> {
  // onUpdate returns individual update chunks
  onUpdate?: (update: DataRow[][], height: number) => void;
  // onCompleted indicates when the data stream is finished
  onCompleted?: (dataSet: DataSet[], height: number) => void;
  // onAccumulated returns accumulated DataSet so far as a Map
  onAccumulated?: (
    dataSet: DataSet[],
    height: number,
    update: DataRow[][]
  ) => void;
}
export class IndexerStreamAccumulateMultipleDataSets<
  DataRow extends BaseDataRow,
  DataSet extends BaseDataSet<DataRow> = BaseDataSet<DataRow>
> {
  // store data in class instance
  private dataSets: DataSet[] = [];
  private dataHeight = 0;
  private stream?: IndexerStream<DataRow>;

  constructor(
    relativeURL: URL | string,
    callbacks: StreamMultipleDataSetsCallbacks<DataRow, DataSet>,
    opts: AccumulatorOptions<DataRow> &
      StreamOptions & {
        // enforce knowing the number of data sets: and it should be above 1
        dataSetCount: number;
      }
  ) {
    const dataSetCount = opts?.dataSetCount || 1;
    // ensure the instance has multiple data sets
    if (dataSetCount < 2) {
      throw new Error('Use a single dataset accumulator for a single dataset');
    }
    this.dataSets = Array.from({ length: dataSetCount }).map<DataSet>(
      () => new Map() as DataSet
    );
    this.stream = new IndexerStream<DataRow>(
      relativeURL,
      {
        onUpdate: (update: DataRow[], dataHeight: number) => {
          const dataUpdatesForEachSet = opts.separateUpdates?.(update) || [
            update,
          ];
          callbacks.onUpdate?.(dataUpdatesForEachSet, dataHeight);
          // update accumulated dataSet
          this.dataHeight = dataHeight;
          this.dataSets = this.accumulateDataSet(dataUpdatesForEachSet, opts);
          // send updated dataSet to listener
          callbacks.onAccumulated?.(
            this.dataSets,
            this.dataHeight,
            dataUpdatesForEachSet
          );
        },
        onError: callbacks.onError,
        onRetry: callbacks.onRetry,
        onCompleted: () =>
          callbacks.onCompleted?.(this.dataSets, this.dataHeight),
      },
      {
        abortController: opts?.abortController,
        disableSSE: opts?.disableSSE,
      }
    );
  }

  // abstracted method to update saved dataSet
  private accumulateDataSet = (
    dataUpdates: DataRow[][],
    opts: AccumulatorOptions<DataRow> = {}
  ) => {
    // save sets to class instance and return
    this.dataSets = this.accumulateUpdates(this.dataSets, dataUpdates, opts);
    return this.dataSets;
  };

  // add default accumulation function, but allow it to be replaced if needed
  public accumulateUpdates = accumulateUpdatesUsingMutation;

  // call to unsubscribe from any data stream
  unsubscribe() {
    // abort any current requests
    this.stream?.unsubscribe();
  }
}

export class IndexerStreamAccumulateDualDataSet<
  DataRow extends BaseDataRow,
  DataSet extends BaseDataSet<DataRow> = BaseDataSet<DataRow>
> extends IndexerStreamAccumulateMultipleDataSets<DataRow, DataSet> {
  constructor(
    relativeURL: URL | string,
    callbacks: StreamMultipleDataSetsCallbacks<DataRow>,
    opts?: Omit<AccumulatorOptions<DataRow> & StreamOptions, 'dataSetCount'>
  ) {
    super(relativeURL, callbacks, { ...opts, dataSetCount: 2 });
  }
}

interface StreamMetadata<DataRowOrDataRows> {
  height: number;
  update: DataRowOrDataRows[];
}
export interface StaleWhileRevalidateStreamState<
  DataRowOrDataRows,
  DataSetOrDataSets
> {
  data?: DataSetOrDataSets;
  meta?: StreamMetadata<DataRowOrDataRows>;
  error?: Error;
}
// add higher-level hook to stream real-time DataSet or DataSets of Indexer URL
function useIndexerStream<
  DataRow extends BaseDataRow,
  DataSet = BaseDataSet<DataRow>
>(
  url: URL | string | undefined,
  IndexerClass: typeof IndexerStreamAccumulateSingleDataSet,
  opts?: AccumulatorOptions<DataRow>
): StaleWhileRevalidateStreamState<DataRow, DataSet>;
function useIndexerStream<
  DataRow extends BaseDataRow,
  DataSet = BaseDataSet<DataRow>
>(
  url: URL | string | undefined,
  IndexerClass: typeof IndexerStreamAccumulateDualDataSet,
  opts?: AccumulatorOptions<DataRow>
): StaleWhileRevalidateStreamState<DataRow[], DataSet[]>;
function useIndexerStream<
  DataRow extends BaseDataRow,
  DataSet = BaseDataSet<DataRow>
>(
  url: URL | string = '',
  IndexerClass:
    | typeof IndexerStreamAccumulateSingleDataSet
    | typeof IndexerStreamAccumulateDualDataSet,
  opts?: AccumulatorOptions<DataRow>
): StaleWhileRevalidateStreamState<DataRow | DataRow[], DataSet | DataSet[]> {
  // define subscription callback which may or may not be used in this component
  // it is passed to useSWRSubscription to handle if the subscription should be
  // created/held/destroyed as multiple components may listen for the same data
  const subscribe: SWRSubscription<
    string[],
    [DataSet | DataSet[], StreamMetadata<DataRow | DataRow[]>],
    Error
  > = ([url], { next }) => {
    // if URL is undefined or an empty string, do not stream it
    if (!url) {
      return () => undefined;
    }
    const stream = new IndexerClass<DataRow>(
      url,
      {
        // note: dataSet may be empty on return of an initial "no rows" payload
        onAccumulated: (dataSetOrSets, height, update) => {
          next(null, [
            // note: the TypeScript here is a bit hacky but this should be ok
            dataSetOrSets as DataSet | DataSet[],
            {
              height,
              update: update as unknown as (DataRow | DataRow[])[],
            },
          ]);
        },
        onError: (error) => next(error),
      },
      // we could pass abortController from StreamOptions here but it gets messy
      // so this has been restricted through types
      opts
    );
    // allow custom accumulator but default to React-friendly accumulator
    stream.accumulateUpdates =
      opts?.accumulateUpdates || accumulateUpdatesToNewState;
    return () => stream.unsubscribe();
  };

  // return cached subscription data
  const streamState = useSWRSubscription<
    [DataSet | DataSet[], StreamMetadata<DataRow | DataRow[]>]
  >(
    // create key from URL and options
    [`${url}`, IndexerClass, ...Object.entries(opts || {}).flat()],
    // the subscription object will differ for any given options
    subscribe
  );

  // extract out meta data into an additional property
  return useMemo<
    StaleWhileRevalidateStreamState<DataRow | DataRow[], DataSet | DataSet[]>
  >(
    () => ({
      ...streamState,
      data: streamState.data?.[0],
      meta: streamState.data?.[1],
    }),
    [streamState]
  );
}

// higher-level hook to stream real-time DataSet of Indexer URL
export function useIndexerStreamOfSingleDataSet<
  DataRow extends BaseDataRow,
  DataSet = BaseDataSet<DataRow>
>(url: URL | string | undefined, opts?: AccumulatorOptions<DataRow>) {
  return useIndexerStream<DataRow, DataSet>(
    url,
    IndexerStreamAccumulateSingleDataSet,
    opts
  );
}

// higher-level hook to stream real-time DataSets of Indexer URL
export function useIndexerStreamOfDualDataSet<
  DataRow extends BaseDataRow,
  DataSet = BaseDataSet<DataRow>
>(url: URL | string | undefined, opts?: AccumulatorOptions<DataRow>) {
  return useIndexerStream<DataRow, DataSet>(
    url,
    IndexerStreamAccumulateDualDataSet,
    opts
  ) as StaleWhileRevalidateStreamState<[DataRow, DataRow], [DataSet, DataSet]>;
}

function useIndexerStreamLastUpdate<
  DataRow extends BaseDataRow,
  DataSet = BaseDataSet<DataRow>
>(
  url: URL | string | undefined,
  IndexerClass:
    | typeof IndexerStreamAccumulateSingleDataSet
    | typeof IndexerStreamAccumulateDualDataSet,
  opts?: AccumulatorOptions<DataRow>
): StaleWhileRevalidateStreamState<
  DataRow | [DataRow, DataRow],
  DataSet | [DataSet, DataSet]
> {
  // return cached subscription data
  const hook =
    IndexerClass === IndexerStreamAccumulateDualDataSet
      ? useIndexerStreamOfDualDataSet
      : useIndexerStreamOfSingleDataSet;
  return hook<DataRow, DataSet>(url, {
    accumulateUpdates: accumulateLastUpdateOnlyToNewState,
    ...opts,
  });
}

// higher-level hook to stream real-time last update of a DataSet of Indexer URL
export function useIndexerStreamLastUpdateOfSingleDataSet<
  DataRow extends BaseDataRow,
  DataSet = BaseDataSet<DataRow>
>(
  url: URL | string | undefined,
  opts?: AccumulatorOptions<DataRow>
): StaleWhileRevalidateStreamState<DataRow, DataSet> {
  // return cached subscription data
  return useIndexerStreamLastUpdate<DataRow, DataSet>(
    url,
    IndexerStreamAccumulateSingleDataSet,
    {
      accumulateUpdates: accumulateLastUpdateOnlyToNewState,
      ...opts,
    }
  ) as StaleWhileRevalidateStreamState<DataRow, DataSet>;
}
export function useIndexerStreamLastUpdateOfDualDataSet<
  DataRow extends BaseDataRow,
  DataSet = BaseDataSet<DataRow>
>(
  url: URL | string | undefined,
  opts?: AccumulatorOptions<DataRow>
): StaleWhileRevalidateStreamState<[DataRow, DataRow], [DataSet, DataSet]> {
  // return cached subscription data
  return useIndexerStreamLastUpdate<DataRow, DataSet>(
    url,
    IndexerStreamAccumulateDualDataSet,
    {
      accumulateUpdates: accumulateLastUpdateOnlyToNewState,
      ...opts,
    }
  ) as StaleWhileRevalidateStreamState<[DataRow, DataRow], [DataSet, DataSet]>;
}

// add higher-level functions to fetch multiple pages of data as "one request"
async function fetchDataFromIndexer<DataRow extends BaseDataRow>(
  baseURL: URL | string,
  IndexerClass: typeof IndexerStreamAccumulateSingleDataSet,
  opts?: AccumulatorOptions<DataRow> & StreamOptions
): Promise<BaseDataSet<DataRow>>;
async function fetchDataFromIndexer<DataRow extends BaseDataRow>(
  baseURL: URL | string,
  IndexerClass: typeof IndexerStreamAccumulateDualDataSet,
  opts?: AccumulatorOptions<DataRow> & StreamOptions
): Promise<BaseDataSet<DataRow>[]>;
async function fetchDataFromIndexer<DataRow extends BaseDataRow>(
  baseURL: URL | string,
  IndexerClass:
    | typeof IndexerStreamAccumulateSingleDataSet
    | typeof IndexerStreamAccumulateDualDataSet,
  opts?: AccumulatorOptions<DataRow> & StreamOptions
): Promise<BaseDataSet<DataRow> | BaseDataSet<DataRow>[]> {
  return new Promise((resolve, reject) => {
    const url = new URL(baseURL, REACT_APP__INDEXER_API);
    // limit max height to stop the request from streaming realtime updates
    const isRealtimeRequest = !(
      Number(url.searchParams.get('pagination.before')) ||
      Number(url.searchParams.get('block_range.to_height'))
    );
    if (isRealtimeRequest) {
      const before = Date.now() / 1000;
      url.searchParams.append('pagination.before', before.toFixed(0));
    }
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

export function fetchSingleDataSetFromIndexer<DataRow extends BaseDataRow>(
  url: URL | string,
  opts?: AccumulatorOptions<DataRow> & StreamOptions
): Promise<BaseDataSet<DataRow>> {
  return fetchDataFromIndexer(url, IndexerStreamAccumulateSingleDataSet, opts);
}

export function fetchDualDataSetFromIndexer<DataRow extends BaseDataRow>(
  url: URL | string,
  opts?: AccumulatorOptions<DataRow> & StreamOptions
): Promise<BaseDataSet<DataRow>[]> {
  return fetchDataFromIndexer(url, IndexerStreamAccumulateDualDataSet, opts);
}

export function useFetchSingleDataSetFromIndexer<DataRow extends BaseDataRow>(
  url: URL | string,
  opts?: AccumulatorOptions<DataRow> & StreamOptions
) {
  return useSWR([url.toString(), opts, 'fetch'], () =>
    fetchSingleDataSetFromIndexer<DataRow>(url, opts)
  );
}

export function useFetchDualDataSetFromIndexer<DataRow extends BaseDataRow>(
  url: URL | string,
  opts?: AccumulatorOptions<DataRow> & StreamOptions
) {
  return useSWR([url.toString(), opts, 'fetch'], () =>
    fetchDualDataSetFromIndexer<DataRow>(url, opts)
  );
}
