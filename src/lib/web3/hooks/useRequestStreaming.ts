import { useRequestLongPolling } from './useRequestLongPolling';

const canUseSSE = 'EventSource' in window;

export default function useStreaming<DataSet extends unknown[]>(
  path = '',
  options: {
    query: Record<string, string>;
    paginationLimit: number;
    combineDataSets: (dataset: DataSet, response: DataSet) => DataSet;
  }
) {
  // we split request type usage here based on the browser used
  // because this condition is constant, we don't violate the react-hooks rule
  if (canUseSSE) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useRequestLongPolling(path, options);
  } else {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useRequestLongPolling(path, options);
  }
}
