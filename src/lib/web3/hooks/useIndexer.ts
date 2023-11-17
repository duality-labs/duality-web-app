import { TimeSeriesRow } from '../../../components/stats/utils';

const { REACT_APP__INDEXER_API = '' } = process.env;

type FlattenSingularItems<T> = T extends [infer U] ? U : T;

type BaseDataRow = FlattenSingularItems<[id: number, values: number[]]>;

interface StreamCallbacks<
  DataRow extends BaseDataRow,
  DataSet = Map<DataRow['0'], DataRow>
> {
  // onUpdate returns individual update chunks
  onUpdate?: (dataSet: DataRow[]) => void;
  // onCompleted indicates when the data stream is finished
  onCompleted?: (dataSet: DataSet) => void;
  // onAccumulated returns accumulated DataSet so far as a Map
  onAccumulated?: (dataSet: DataSet) => void;
  // allow errors to be seen and handled
  onError?: (error: Error) => void;
}
export class IndexerStream<DataRow extends BaseDataRow> {
  // store data in class instance
  private dataSet: Map<DataRow['0'], DataRow> = new Map();

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

  // abstracted method to update saved dataSet
  private accumulateDataSet = (dataUpdate: DataRow[]) => {
    dataUpdate.forEach((row) => {
      this.dataSet.set(row[0], row);
    });
    return this.dataSet;
  };

  private async subscribeToSSE(url: URL, callbacks: StreamCallbacks<DataRow>) {
    return await new Promise((resolve, reject) => {
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
              // update accumulated dataSet
              const dataSet = this.accumulateDataSet(dataUpdates);
              // send updated dataSet to listener
              callbacks.onAccumulated?.(dataSet);
            }
          },
          listenerOptions
        );
        // 'end' message is sent if a data stream is complete
        eventSource.addEventListener(
          'end',
          () => {
            // send completed dataSet to listener
            callbacks.onCompleted?.(this.dataSet);
            // end promise with completed data
            resolve(this.dataSet);
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
    this.dataSet.clear();
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

// add time series extended classes
type TimeSeriesResolution = 'second' | 'minute' | 'hour' | 'day' | 'month';

export class IndexerTimeSeriesStream extends IndexerStream<TimeSeriesRow> {
  constructor(
    symbolA: string,
    symbolB: string,
    resolution: TimeSeriesResolution,
    callbacks: StreamCallbacks<TimeSeriesRow>
  ) {
    const relativeURL = `/timeseries/price/${symbolA}/${symbolB}${
      resolution ? `/${resolution}` : ''
    }`;
    super(relativeURL, callbacks);
    return this;
  }
}

// add higher-level method to fetch multiple pages of data as "one request"
export async function fetchTimeSeriesFromIndexer(
  symbolA: string,
  symbolB: string,
  resolution: TimeSeriesResolution
): Promise<Map<TimeSeriesRow['0'], TimeSeriesRow>> {
  return new Promise((resolve, reject) => {
    const stream = new IndexerTimeSeriesStream(symbolA, symbolB, resolution, {
      onCompleted: (timeSeries) => {
        stream.unsubscribe();
        resolve(timeSeries);
      },
      onError: reject,
    });
  });
}
