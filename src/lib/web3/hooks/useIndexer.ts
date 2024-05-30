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

type BaseTimeSeriesDataRow = {
  block_tmstmp: BlockTimestamp;
  block_hght: number;
};
export type BaseTimeSeriesSSERow = BaseTimeSeriesDataRow;
export type BaseTimeSeriesSSEPage = { data: BaseTimeSeriesSSERow };
export type TimeSeriesPage<
  TimeSeriesDataRow extends BaseTimeSeriesDataRow = BaseTimeSeriesDataRow
> = { data: TimeSeriesDataRow[]; total: number };

export type BaseLiquidityDataRow = {
  tick_index: number;
  reserves: string;
};
export interface BaseLiquiditySSEPage extends BaseLiquidityDataRow {
  block_tmstmp: BlockTimestamp;
}
export type LiquidityPage<
  LiquidityDataRow extends BaseLiquidityDataRow = BaseLiquidityDataRow
> = {
  data: { reserves_b_a: LiquidityDataRow[]; reserves_a_b?: LiquidityDataRow[] };
  total: number;
};

type BaseLiquidityPairsDataRow = {
  token_a: string;
  token_b: string;
  tvl_a: string;
  tvl_b: string;
};
export interface BaseLiquidityPairsSSEPage extends BaseLiquidityPairsDataRow {
  block_tmstmp: BlockTimestamp;
}
type LiquidityPairsPage<
  LiquidityPairsDataRow extends BaseLiquidityPairsDataRow = BaseLiquidityPairsDataRow
> = { data: LiquidityPairsDataRow[]; total: number };

type BaseStatsDataRow = { tmstmp: BlockTimestamp };
export type BaseStatsDataPage<DataRow extends BaseStatsDataRow> = {
  current: DataRow;
  hour24: DataRow;
  hour48: DataRow;
};
export type BaseStatsDataSSERow = BaseStatsDataRow;
export type BaseStatsDataSSEPage<
  DataRow extends BaseStatsDataRow = BaseStatsDataRow
> = BaseStatsDataPage<DataRow>;
export type StatsPage<
  StatsDataRow extends BaseStatsDataRow = BaseStatsDataRow
> = { data: BaseStatsDataPage<StatsDataRow> };

export type BaseDataPage =
  | TimeSeriesPage
  | LiquidityPage
  | LiquidityPairsPage
  | StatsPage;

type BaseDataRow =
  | BaseLiquiditySSEPage
  | BaseLiquidityPairsSSEPage
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

const defaultHeaders = {
  auth_token: `${REACT_APP__INDEXER_API_KEY}`,
};
const defaultFetchOptions = {
  headers: defaultHeaders,
};

function getDataHeight<DataRow extends BaseDataRow>(
  dataUpdate: DataRow
): BlockTimestamp {
  return (
    (dataUpdate as BaseLiquiditySSEPage)?.block_tmstmp ??
    (dataUpdate as BaseLiquidityPairsSSEPage)?.block_tmstmp ??
    (dataUpdate as BaseTimeSeriesSSEPage)?.data?.block_tmstmp ??
    (dataUpdate as BaseStatsDataSSEPage)?.current?.tmstmp
  );
}

function getDataRows<DataPage, DataRow>(restResponse: DataPage): DataRow[] {
  return (
    // LiquidityPage getDataRowsFromResponse should be replaced with custom token_in logic
    ((restResponse as LiquidityPage).data.reserves_b_a ??
      (restResponse as TimeSeriesPage | TimeSeriesPage | StatsPage)
        .data) as DataRow[]
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
interface QueryOptions<RestPageResponse, DataRow> {
  // get data rows out of the REST endpoint response
  getDataRowsFromResponse?: (restResponse: RestPageResponse) => DataRow[];
  ignoreInitialData404s?: boolean;
  // allow REST requests to be disabled (sometimes you don't need initial data)
  disableREST?: boolean;
}
interface StreamOptions {
  // optional single AbortController for all the requests
  abortController?: AbortController;
  // allow SSE requests to be disabled (sometimes you don't need a subscription)
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
export class IndexerStream<RestPageResponse, DataRow extends BaseDataRow> {
  // use single AbortController for all the requests
  private abortController = new AbortController();

  constructor(
    relativeURL: URL | string,
    callbacks: StreamCallbacks<DataRow>,
    opts?: StreamOptions & QueryOptions<RestPageResponse, DataRow>
  ) {
    // replace abortController if one is given
    this.abortController = opts?.abortController ?? this.abortController;
    const url = new URL(relativeURL, REACT_APP__INDEXER_API);

    // attempt to subscribe to Server-Sent Events for this endpoint
    new Promise<void>((resolve, reject) => {
      // primarily attempt to use a SSE connection
      if (!opts?.disableSSE) {
        // defined initial response
        let hasInitalResponse: boolean = false;
        // store SSE updates until they can be applied over the inital query
        const dataUpdatesFromSSE: DataRow[] = [];
        this.subscribeToSSE(url, {
          ...callbacks,
          onUpdate(dataUpdates, height) {
            // if the initial response has been found already then pass through
            if (hasInitalResponse) {
              callbacks.onUpdate?.(dataUpdates, height);
            }
            // otherwise collect the data so it can be applied later
            else {
              dataUpdatesFromSSE.push(...dataUpdates);
            }
          },
        })
          .then(() =>
            !opts?.disableREST ? this.getInitialData(url, opts) : []
          )
          .then((dataUpdates) => {
            // sent initial updates and any queued SSE updates to parent
            const combinedDataUpdates = [...dataUpdates, ...dataUpdatesFromSSE];
            const lastDataUpdate = combinedDataUpdates.at(-1);
            const lastDataHeight =
              lastDataUpdate && getDataHeight(lastDataUpdate);
            callbacks.onUpdate?.(combinedDataUpdates, lastDataHeight ?? 0);
            // remove stored updates from memory
            dataUpdatesFromSSE.splice(0, dataUpdatesFromSSE.length);
            // set initial response as found
            hasInitalResponse = true;
            // finish promise
            resolve();
          })
          .catch(reject);
      } else {
        // fetch the historical data of the original URL
        this.getInitialData(url, opts)
          .then((dataRows) => {
            const dataRow = dataRows?.at(-1);
            if (dataRow) {
              callbacks.onUpdate?.(dataRows, getDataHeight(dataRow));
            }
          })
          .then(resolve)
          .catch(reject);
      }
    })
      .then(() => callbacks.onCompleted?.())
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
      // ensure that SSE query params do not contain pagination query params
      const queryParams = new URLSearchParams(url.search);
      const paginationQueryParams = [
        'from_block_hght',
        'to_block_hght',
        'from_block_tmstmp',
        'to_block_tmstmp',
        'offset',
        'limit',
      ];
      const filteredQueryParams = new URLSearchParams(
        Array.from(queryParams.entries()).filter(
          ([key]) => !paginationQueryParams.includes(key)
        )
      );
      // add "/sse" to get SSE endpoint of path
      const sseURL = new URL(`${url.pathname}/sse?${filteredQueryParams}`, url);

      // create cancellable SSE event source
      try {
        class RetriableError extends Error {}
        class FatalError extends Error {}
        let retryInterval: number = 0;

        // add event source connected to theinstance abortController
        fetchEventSource(sseURL.toString(), {
          headers: defaultHeaders,
          signal: this.abortController.signal,
          async onopen(response) {
            // content type might be "text/event-stream; charset=utf-8"
            const contentType = [
              ...(response.headers.get('content-type')?.split(';') ?? []),
            ];
            if (response.ok && contentType.includes(EventStreamContentType)) {
              // response is good: reset the retry interval
              retryInterval = 0;
              // allow parent to continue
              resolve();
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

  // get the matching
  private async getInitialData(
    url: URL,
    opts?: QueryOptions<RestPageResponse, DataRow>
  ): Promise<DataRow[]> {
    // get all pages of data:
    let itemsTotal: number = 0;
    let itemsCount: number = 0;
    const dataRows: DataRow[] = [];
    do {
      const loopURL = new URL(url);
      loopURL.searchParams.set('offset', itemsCount.toFixed(0));
      const restResponse: RestPageResponse = await fetch(
        loopURL.toString(),
        defaultFetchOptions
      ).then((res) => {
        if (res.status === 200) {
          return res.json();
        }
        // replace 404s with an empty page
        else if (opts?.ignoreInitialData404s && res.status === 404) {
          return { data: [], total: 0 };
        }
        throw new Error('Unexpected response', { cause: res });
      });

      // accumulate data rows
      const newDataRows = opts?.getDataRowsFromResponse
        ? opts.getDataRowsFromResponse(restResponse)
        : getDataRows<RestPageResponse, DataRow>(restResponse);
      if (!newDataRows?.length || this.abortController.signal.aborted) {
        break;
      }
      // accumulate state
      itemsCount += newDataRows.length;
      itemsTotal = (restResponse as TimeSeriesPage).total;
      dataRows.push(...newDataRows);
    } while (itemsTotal && itemsCount < itemsTotal);
    return dataRows;
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
  RestPageResponse,
  DataRow extends BaseDataRow,
  DataSet extends BaseDataSet<DataRow> = BaseDataSet<DataRow>
> {
  // store data in class instance
  private dataSet: DataSet = new Map() as DataSet;
  private dataHeight = 0;
  private stream?: IndexerStream<RestPageResponse, DataRow>;

  constructor(
    relativeURL: URL | string,
    callbacks: StreamSingleDataSetCallbacks<DataRow, DataSet>,
    opts?: AccumulatorOptions<DataRow> &
      StreamOptions &
      QueryOptions<RestPageResponse, DataRow>
  ) {
    this.stream = new IndexerStream<RestPageResponse, DataRow>(
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
        disableREST: opts?.disableREST,
        ignoreInitialData404s: opts?.ignoreInitialData404s,
        getDataRowsFromResponse: opts?.getDataRowsFromResponse,
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
  RestPageResponse,
  DataRow extends BaseDataRow,
  DataSet extends BaseDataSet<DataRow> = BaseDataSet<DataRow>
> {
  // store data in class instance
  private dataSets: DataSet[] = [];
  private dataHeight = 0;
  private stream?: IndexerStream<RestPageResponse, DataRow>;

  constructor(
    relativeURL: URL | string,
    callbacks: StreamMultipleDataSetsCallbacks<DataRow, DataSet>,
    opts: AccumulatorOptions<DataRow> &
      QueryOptions<RestPageResponse, DataRow> &
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
    this.stream = new IndexerStream<RestPageResponse, DataRow>(
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
        disableREST: opts?.disableREST,
        ignoreInitialData404s: opts?.ignoreInitialData404s,
        getDataRowsFromResponse: opts.getDataRowsFromResponse,
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
  RestPageResponse,
  DataRow extends BaseDataRow,
  DataSet extends BaseDataSet<DataRow> = BaseDataSet<DataRow>
> extends IndexerStreamAccumulateMultipleDataSets<
  RestPageResponse,
  DataRow,
  DataSet
> {
  constructor(
    relativeURL: URL | string,
    callbacks: StreamMultipleDataSetsCallbacks<DataRow>,
    opts?: Omit<
      AccumulatorOptions<DataRow> &
        StreamOptions &
        QueryOptions<RestPageResponse, DataRow>,
      'dataSetCount'
    >
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
  RestPageResponse,
  DataRow extends BaseDataRow,
  DataSet = BaseDataSet<DataRow>
>(
  url: URL | string | undefined,
  IndexerClass: typeof IndexerStreamAccumulateSingleDataSet,
  opts?: AccumulatorOptions<DataRow> & QueryOptions<RestPageResponse, DataRow>
): StaleWhileRevalidateStreamState<DataRow, DataSet>;
function useIndexerStream<
  RestPageResponse,
  DataRow extends BaseDataRow,
  DataSet = BaseDataSet<DataRow>
>(
  url: URL | string | undefined,
  IndexerClass: typeof IndexerStreamAccumulateDualDataSet,
  opts?: AccumulatorOptions<DataRow> & QueryOptions<RestPageResponse, DataRow>
): StaleWhileRevalidateStreamState<DataRow[], DataSet[]>;
function useIndexerStream<
  RestPageResponse,
  DataRow extends BaseDataRow,
  DataSet = BaseDataSet<DataRow>
>(
  url: URL | string = '',
  IndexerClass:
    | typeof IndexerStreamAccumulateSingleDataSet
    | typeof IndexerStreamAccumulateDualDataSet,
  opts?: AccumulatorOptions<DataRow> & QueryOptions<RestPageResponse, DataRow>
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
    const stream = new IndexerClass<RestPageResponse, DataRow>(
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
  RestPageResponse,
  DataRow extends BaseDataRow,
  DataSet = BaseDataSet<DataRow>
>(
  url: URL | string | undefined,
  opts?: AccumulatorOptions<DataRow> & QueryOptions<RestPageResponse, DataRow>
) {
  return useIndexerStream<RestPageResponse, DataRow, DataSet>(
    url,
    IndexerStreamAccumulateSingleDataSet,
    opts
  );
}

// higher-level hook to stream real-time DataSets of Indexer URL
export function useIndexerStreamOfDualDataSet<
  RestPageResponse,
  DataRow extends BaseDataRow,
  DataSet = BaseDataSet<DataRow>
>(
  url: URL | string | undefined,
  opts?: AccumulatorOptions<DataRow> & QueryOptions<RestPageResponse, DataRow>
) {
  return useIndexerStream<RestPageResponse, DataRow, DataSet>(
    url,
    IndexerStreamAccumulateDualDataSet,
    opts
  ) as StaleWhileRevalidateStreamState<[DataRow, DataRow], [DataSet, DataSet]>;
}

function useIndexerStreamLastUpdate<
  RestPageResponse,
  DataRow extends BaseDataRow,
  DataSet = BaseDataSet<DataRow>
>(
  url: URL | string | undefined,
  IndexerClass:
    | typeof IndexerStreamAccumulateSingleDataSet
    | typeof IndexerStreamAccumulateDualDataSet,
  opts?: AccumulatorOptions<DataRow> & QueryOptions<RestPageResponse, DataRow>
): StaleWhileRevalidateStreamState<
  DataRow | [DataRow, DataRow],
  DataSet | [DataSet, DataSet]
> {
  // return cached subscription data
  const hook =
    IndexerClass === IndexerStreamAccumulateDualDataSet
      ? useIndexerStreamOfDualDataSet
      : useIndexerStreamOfSingleDataSet;
  return hook<RestPageResponse, DataRow, DataSet>(url, {
    accumulateUpdates: accumulateLastUpdateOnlyToNewState,
    ...opts,
  });
}

// higher-level hook to stream real-time last update of a DataSet of Indexer URL
export function useIndexerStreamLastUpdateOfSingleDataSet<
  RestPageResponse,
  DataRow extends BaseDataRow,
  DataSet = BaseDataSet<DataRow>
>(
  url: URL | string | undefined,
  opts?: AccumulatorOptions<DataRow> & QueryOptions<RestPageResponse, DataRow>
): StaleWhileRevalidateStreamState<DataRow, DataSet> {
  // return cached subscription data
  return useIndexerStreamLastUpdate<RestPageResponse, DataRow, DataSet>(
    url,
    IndexerStreamAccumulateSingleDataSet,
    {
      accumulateUpdates: accumulateLastUpdateOnlyToNewState,
      ...opts,
    }
  ) as StaleWhileRevalidateStreamState<DataRow, DataSet>;
}
export function useIndexerStreamLastUpdateOfDualDataSet<
  RestPageResponse,
  DataRow extends BaseDataRow,
  DataSet = BaseDataSet<DataRow>
>(
  url: URL | string | undefined,
  opts?: AccumulatorOptions<DataRow> & QueryOptions<RestPageResponse, DataRow>
): StaleWhileRevalidateStreamState<[DataRow, DataRow], [DataSet, DataSet]> {
  // return cached subscription data
  return useIndexerStreamLastUpdate<RestPageResponse, DataRow, DataSet>(
    url,
    IndexerStreamAccumulateDualDataSet,
    {
      accumulateUpdates: accumulateLastUpdateOnlyToNewState,
      ...opts,
    }
  ) as StaleWhileRevalidateStreamState<[DataRow, DataRow], [DataSet, DataSet]>;
}

// add higher-level functions to fetch multiple pages of data as "one request"
async function fetchDataFromIndexer<
  RestPageResponse,
  DataRow extends BaseDataRow,
  DataSet extends BaseDataSet<DataRow>
>(
  baseURL: URL | string,
  IndexerClass: typeof IndexerStreamAccumulateSingleDataSet,
  opts?: AccumulatorOptions<DataRow> &
    StreamOptions &
    QueryOptions<RestPageResponse, DataRow>
): Promise<DataSet>;
async function fetchDataFromIndexer<
  RestPageResponse,
  DataRow extends BaseDataRow,
  DataSet extends BaseDataSet<DataRow>
>(
  baseURL: URL | string,
  IndexerClass: typeof IndexerStreamAccumulateDualDataSet,
  opts?: AccumulatorOptions<DataRow> &
    StreamOptions &
    QueryOptions<RestPageResponse, DataRow>
): Promise<DataSet[]>;
async function fetchDataFromIndexer<
  RestPageResponse,
  DataRow extends BaseDataRow,
  DataSet extends BaseDataSet<DataRow>
>(
  baseURL: URL | string,
  IndexerClass:
    | typeof IndexerStreamAccumulateSingleDataSet
    | typeof IndexerStreamAccumulateDualDataSet,
  opts?: AccumulatorOptions<DataRow> &
    StreamOptions &
    QueryOptions<RestPageResponse, DataRow>
): Promise<DataSet | DataSet[]> {
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
    const stream = new IndexerClass<RestPageResponse, DataRow, DataSet>(
      url,
      {
        onCompleted: (data) => {
          stream.unsubscribe();
          resolve(data as DataSet | DataSet[]);
        },
        onError: reject,
      },
      {
        disableSSE: true,
        ...opts,
      }
    );
    // allow mutation in this stream accumulator because we won't listen to
    // individual data updates
    stream.accumulateUpdates = accumulateUpdatesUsingMutation;
  });
}

export function fetchSingleDataSetFromIndexer<
  RestPageResponse,
  DataRow extends BaseDataRow,
  DataSet extends BaseDataSet<DataRow>
>(
  url: URL | string,
  opts?: AccumulatorOptions<DataRow> &
    StreamOptions &
    QueryOptions<RestPageResponse, DataRow>
): Promise<DataSet> {
  return fetchDataFromIndexer(url, IndexerStreamAccumulateSingleDataSet, opts);
}

export function fetchDualDataSetFromIndexer<
  RestPageResponse,
  DataRow extends BaseDataRow,
  DataSet extends BaseDataSet<DataRow>
>(
  url: URL | string,
  opts?: AccumulatorOptions<DataRow> &
    StreamOptions &
    QueryOptions<RestPageResponse, DataRow>
): Promise<DataSet[]> {
  return fetchDataFromIndexer(url, IndexerStreamAccumulateDualDataSet, opts);
}

export function useFetchSingleDataSetFromIndexer<
  RestPageResponse,
  DataRow extends BaseDataRow,
  DataSet extends BaseDataSet<DataRow>
>(
  url: URL | string | undefined = '',
  opts?: AccumulatorOptions<DataRow> &
    StreamOptions &
    QueryOptions<RestPageResponse, DataRow>
) {
  return useSWR(url ? [url.toString(), opts, 'fetch'] : null, () =>
    fetchSingleDataSetFromIndexer<RestPageResponse, DataRow, DataSet>(url, opts)
  );
}

export function useFetchDualDataSetFromIndexer<
  RestPageResponse,
  DataRow extends BaseDataRow,
  DataSet extends BaseDataSet<DataRow>
>(
  url: URL | string | undefined = '',
  opts?: AccumulatorOptions<DataRow> &
    StreamOptions &
    QueryOptions<RestPageResponse, DataRow>
) {
  return useSWR(url ? [url.toString(), opts, 'fetch'] : null, () =>
    fetchDualDataSetFromIndexer<RestPageResponse, DataRow, DataSet>(url, opts)
  );
}

export async function fetchMostRecentDataRowFromTimeseries<
  TimeSeriesDataRow extends BaseTimeSeriesDataRow,
  RestPageResponse extends TimeSeriesPage<TimeSeriesDataRow> = TimeSeriesPage<TimeSeriesDataRow>
>(url: URL | string): Promise<TimeSeriesDataRow | undefined> {
  // create a short query that can read the total items of the main query
  // this is because the timeseries are in chronological order so we need to know
  // the number of items to get an offset to return the last data item
  const query = new URL(url, `${REACT_APP__INDEXER_API}`);
  query.searchParams.set('limit', '1');

  const initialResponse: RestPageResponse = await fetch(
    query,
    defaultFetchOptions
  ).then((res) => (res.status === 200 ? res.json() : { data: [], total: 0 }));

  // check if data is the only response
  if (initialResponse.total === 1) {
    return initialResponse.data[0];
  }
  // fetch data from another request
  if (initialResponse.total) {
    query.searchParams.set('offset', (initialResponse.total - 1).toFixed(0));
    query.searchParams.set('limit', '10');

    const secondResponse: RestPageResponse = await fetch(
      query,
      defaultFetchOptions
    ).then((res) => (res.status === 200 ? res.json() : { data: [], total: 0 }));

    // return the most recent data row
    const dataRows = secondResponse.data
      .slice()
      .sort((a, b) => a.block_tmstmp - b.block_tmstmp);
    return dataRows.at(-1);
  }
}
