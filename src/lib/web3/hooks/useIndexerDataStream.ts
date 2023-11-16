import { useEffect, useState } from 'react';
import { TimeSeriesRow } from '../../../components/stats/utils';

const { REACT_APP__INDEXER_API = '', NODE_ENV = 'production' } = process.env;

// define payload
// note: easily check if the data state is the first payload by testing
//       currentDataState === lastDataStateUpdate
type DataStreamState<DataState> = [
  currentDataState: DataState | undefined,
  lastDataStateUpdate: DataState | undefined,
  lastDataStateUpdateID: string | undefined
];

interface DataStreamOptions {
  allowPartialIdUpdates?: boolean;
}

export default function useIndexerDataStream(
  relativeURL: string,
  opts?: DataStreamOptions
) {
  // call the correct method for the browser
  return 'EventSource' in window
    ? // eslint-disable-next-line react-hooks/rules-of-hooks
      useServerSentEventStream(`${REACT_APP__INDEXER_API}${relativeURL}`, opts)
    : // eslint-disable-next-line react-hooks/rules-of-hooks
      useLongPollingDataStream(`${REACT_APP__INDEXER_API}${relativeURL}`, opts);
}

function useServerSentEventStream<Data>(
  urlString: string,
  opts?: DataStreamOptions
) {
  const [response, setResponse] = useState<DataStreamState<Data> | undefined>();

  useEffect(() => {
    const url = new URL(urlString);
    url.searchParams.append('stream', 'true');
    const eventSource = new EventSource(url);
    const update = (e: MessageEvent<Data>) => {
      console.log('e.data', e.data);
    };

    // listen for updates
    eventSource.addEventListener('update', update);

    return () => {
      eventSource.removeEventListener('update', update);
      eventSource.close();
    };
  }, [urlString]);

  return [undefined, undefined];
}

function getServerSentEvents(id: string, callback: () => void) {
  const target = new EventTarget();
  target.addEventListener(id, callback);
  return [target, () => target.removeEventListener(id, callback)];
}

function useLongPollingDataStream(url: string, opts?: DataStreamOptions) {
  return [undefined, undefined];
}

function useDataPacking(urlString: string) {
  const [eventSource] = useState(() => new EventTarget());
  useEffect(() => {
    const url = new URL(urlString);
    url.searchParams.append('stream', 'true');
    const eventSource = new EventSource(url);
    const update = (e: MessageEvent<TimeSeriesRow>) => {
      console.log('e.data', e.data);
    };

    // listen for updates
    eventSource.addEventListener('update', update);

    return () => {
      eventSource.removeEventListener('update', update);
      eventSource.close();
    };
  }, [urlString]);
}
