import { TimeSeriesRow } from '../../../components/stats/utils';

const { REACT_APP__INDEXER_API = '' } = process.env;

type TimeSeries = Map<TimeSeriesRow['0'], TimeSeriesRow>;
interface StreamCallbacks {
  // onUpdate returns individual update chunks
  onUpdate?: (dataset: TimeSeriesRow[]) => void;
  // onCompleted indicates when the data stream is finished
  onCompleted?: (dataset: TimeSeries) => void;
  // onAccumulated returns accumulated TimeSeries so far as a Map
  onAccumulated?: (dataset: TimeSeries) => void;
  // allow errors to be seen and handled
  onError?: (error: Error) => void;
}
export class IndexerTimeSeriesStream {
  // store data in class instance
  private timeseries: TimeSeries = new Map();

  constructor(relativeURL: URL | string, callbacks: StreamCallbacks) {
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

  // abstracted method to update saved timeseries
  private accumulateTimeSeries = (dataUpdate: TimeSeriesRow[]): TimeSeries => {
    dataUpdate.forEach((row) => {
      this.timeseries.set(row[0], row);
    });
    return this.timeseries;
  };

  private async subscribeToSSE(url: URL, callbacks: StreamCallbacks) {
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
            let timeseriesUpdates: TimeSeriesRow[] | undefined;
            if (e.data) {
              try {
                timeseriesUpdates = JSON.parse(e.data) as TimeSeriesRow[];
              } catch (err) {
                reject(
                  new Error(`Could not parse data: ${e.data}`, {
                    cause: err instanceof Error ? err : new Error(`${err}`),
                  })
                );
              }
            }
            if (timeseriesUpdates) {
              // send update directly to listener
              callbacks.onUpdate?.(timeseriesUpdates);
              // update accumulated timeseries
              const timeseries = this.accumulateTimeSeries(timeseriesUpdates);
              // send updated timeseries to listener
              callbacks.onAccumulated?.(timeseries);
            }
          },
          listenerOptions
        );
        // 'end' message is sent if a data stream is complete
        eventSource.addEventListener(
          'end',
          () => {
            // send completed timeseries to listener
            callbacks.onCompleted?.(this.timeseries);
            // end promise with completed data
            resolve(this.timeseries);
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

  private async subscribeToLongPolling(url: URL, callbacks: StreamCallbacks) {
    this.timeseries.clear();
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

// add higher-level method to fetch multiple pages of data as "one request"
export async function fetchFromIndexer(url: URL | string): Promise<TimeSeries> {
  return new Promise((resolve, reject) => {
    const stream = new IndexerTimeSeriesStream(url, {
      onCompleted: (timeSeries) => {
        stream.unsubscribe();
        resolve(timeSeries);
      },
      onError: reject,
    });
  });
}
