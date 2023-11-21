import { TimeSeriesRow } from '../../../components/stats/utils';
import {
  BaseDataSet,
  IndexerStreamAccumulateSingleDataSet,
  StreamOptions,
  StreamSingleDataSetCallbacks,
  fetchDataFromIndexer,
} from './useIndexer';

// add time series extended classes
type TimeSeriesResolution = 'second' | 'minute' | 'hour' | 'day' | 'month';

export class IndexerPriceTimeSeriesStream extends IndexerStreamAccumulateSingleDataSet<TimeSeriesRow> {
  constructor(
    symbolA: string,
    symbolB: string,
    resolution: TimeSeriesResolution,
    callbacks: StreamSingleDataSetCallbacks<TimeSeriesRow>,
    opts?: StreamOptions
  ) {
    const relativeURL = `/timeseries/price/${symbolA}/${symbolB}${
      resolution ? `/${resolution}` : ''
    }`;
    super(relativeURL, callbacks, opts);
    return this;
  }
}

// add higher-level method to fetch multiple pages of timeseries data
export async function fetchPriceTimeSeriesFromIndexer(
  symbolA: string,
  symbolB: string,
  resolution: TimeSeriesResolution,
  opts?: StreamOptions
): Promise<BaseDataSet<TimeSeriesRow>> {
  const url = `/timeseries/price/${symbolA}/${symbolB}${
    resolution ? `/${resolution}` : ''
  }`;
  return await fetchDataFromIndexer(
    url,
    IndexerStreamAccumulateSingleDataSet,
    opts
  );
}
