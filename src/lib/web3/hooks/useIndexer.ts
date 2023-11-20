import { TimeSeriesRow } from '../../../components/stats/utils';

const { REACT_APP__INDEXER_API = '' } = process.env;

type FlattenSingularItems<T> = T extends [infer U] ? U : T;

type BaseDataRow = FlattenSingularItems<[id: number, values: number[]]>;
type BaseDataSet<DataRow extends BaseDataRow> = Map<DataRow['0'], DataRow>;

interface StreamCallbacks<DataRow = BaseDataRow> {
  // onUpdate returns individual update chunks
  onUpdate?: (dataUpdates: DataRow[]) => void;
  // onCompleted indicates when the data stream is finished
  onCompleted?: () => void;
  // allow errors to be seen and handled
  onError?: (error: Error) => void;
}
export class IndexerStream<DataRow = BaseDataRow> {
  constructor(relativeURL: URL | string, callbacks: StreamCallbacks<DataRow>) {
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
      const abortController = this.getNewAbortController();
      const listenerOptions = { signal: abortController.signal };
      try {
        // subscribe to streaming version of URL
        const streamingURL = new URL(url);
        streamingURL.searchParams.append('stream', 'true');
        // add event source and add a cancellation listener
        const eventSource = new EventSource(streamingURL);
        abortController.signal.onabort = () => eventSource.close();
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

  // restrict class instance to single abort controller
  private _abortController: AbortController = new AbortController();
  private getNewAbortController() {
    // don't subscribe to multiple things at once
    this._abortController.abort();
    this._abortController = new AbortController();
    return this._abortController;
  }

  // call to unsubscribe from any data stream
  unsubscribe() {
    // abort any current requests
    this._abortController.abort();
  }
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
    callbacks: StreamSingleDataSetCallbacks<DataRow>
  ) {
    this.stream = new IndexerStream(relativeURL, {
      onUpdate: (dataUpdates: DataRow[]) => {
        callbacks.onUpdate?.(dataUpdates);
        // update accumulated dataSet
        const dataSet = this.accumulateDataSet(dataUpdates);
        // send updated dataSet to listener
        callbacks.onAccumulated?.(dataSet);
      },
      onError: callbacks.onError,
      onCompleted: () => callbacks.onCompleted?.(this.dataSet),
    });
  }

  // abstracted method to update saved dataSet
  private accumulateDataSet = (dataUpdate: DataRow[]) => {
    dataUpdate.forEach((row) => {
      this.dataSet.set(row[0], row);
    });
    return this.dataSet;
  };

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
    callbacks: StreamDualDataSetCallbacks<DataRow>
  ) {
    this.stream = new IndexerStream<DataRow[]>(relativeURL, {
      onUpdate: (dataUpdates: DataRow[][]) => {
        callbacks.onUpdate?.(dataUpdates);
        // update accumulated dataSet
        const dataSet = this.accumulateDataSet(dataUpdates);
        // send updated dataSet to listener
        callbacks.onAccumulated?.(dataSet);
      },
      onError: callbacks.onError,
      onCompleted: () => callbacks.onCompleted?.(this.dataSets),
    });
  }

  // abstracted method to update saved dataSet
  private accumulateDataSet = (dataUpdate: DataRow[][]) => {
    dataUpdate[0].forEach((row) => {
      this.dataSets[0].set(row[0], row);
    });
    return this.dataSets;
  };

  // call to unsubscribe from any data stream
  unsubscribe() {
    // abort any current requests
    this.stream?.unsubscribe();
  }
}

// add higher-level function to fetch multiple pages of data as "one request"
export async function fetchDataFromIndexer<DataRow extends BaseDataRow>(
  baseURL: URL | string,
  IndexerClass: typeof IndexerStreamAccumulateSingleDataSet
): Promise<BaseDataSet<DataRow>>;
export async function fetchDataFromIndexer<DataRow extends BaseDataRow>(
  baseURL: URL | string,
  IndexerClass: typeof IndexerStreamAccumulateDualDataSet
): Promise<BaseDataSet<DataRow>[]>;
export async function fetchDataFromIndexer<DataRow extends BaseDataRow>(
  baseURL: URL | string,
  IndexerClass:
    | typeof IndexerStreamAccumulateSingleDataSet
    | typeof IndexerStreamAccumulateDualDataSet
): Promise<BaseDataSet<DataRow> | BaseDataSet<DataRow>[]> {
  return new Promise((resolve, reject) => {
    const url = new URL(baseURL, REACT_APP__INDEXER_API);
    // set max height to now, which will cause the request to end at now height
    const before = Date.now() / 1000;
    url.searchParams.append('pagination.before', before.toFixed(0));
    // add stream listener and resolve promise on completion
    const stream = new IndexerClass<DataRow>(url, {
      onCompleted: (data) => {
        stream.unsubscribe();
        resolve(data);
      },
      onError: reject,
    });
  });
}

// add time series extended classes
type TimeSeriesResolution = 'second' | 'minute' | 'hour' | 'day' | 'month';

export class IndexerPriceTimeSeriesStream extends IndexerStreamAccumulateSingleDataSet<TimeSeriesRow> {
  constructor(
    symbolA: string,
    symbolB: string,
    resolution: TimeSeriesResolution,
    callbacks: StreamSingleDataSetCallbacks<TimeSeriesRow>
  ) {
    const relativeURL = `/timeseries/price/${symbolA}/${symbolB}${
      resolution ? `/${resolution}` : ''
    }`;
    super(relativeURL, callbacks);
    return this;
  }
}

// add higher-level method to fetch multiple pages of timeseries data
export async function fetchPriceTimeSeriesFromIndexer(
  symbolA: string,
  symbolB: string,
  resolution: TimeSeriesResolution
): Promise<BaseDataSet<TimeSeriesRow>> {
  const url = `/timeseries/price/${symbolA}/${symbolB}${
    resolution ? `/${resolution}` : ''
  }`;
  return await fetchDataFromIndexer(url, IndexerStreamAccumulateSingleDataSet);
}
