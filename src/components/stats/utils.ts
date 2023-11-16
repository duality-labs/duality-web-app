import { formatCurrency, formatPercentage } from '../../lib/utils/number';
import { Token } from '../../lib/web3/utils/tokens';

// format a URL path part to reference a token on the indexer
export function getIndexerTokenPathPart(token: Token) {
  return encodeURIComponent(token.address);
}

export type TimeSeriesRow = [unixTime: number, values: number[]];
export type TimeSeriesPage = {
  shape: Array<string>;
  data: Array<TimeSeriesRow>;
  pagination?: {
    next_key?: string | null;
  };
  block_range: {
    from_height: number;
    to_height: number;
  };
};

export function getLastDataValue(
  data: TimeSeriesRow[] | undefined,
  // optional reducing function
  getValue: (values: number[]) => number = (values) =>
    values.reduce((acc, value) => acc + value, 0),
  index = 0
): [unixTime: number, value: number] | null | undefined {
  const lastDataValues = getLastDataValues(data, index);
  if (!lastDataValues) {
    return lastDataValues;
  }
  const [timeUnix, values] = lastDataValues;
  return [timeUnix, getValue(values)];
}
export function getLastDataValues(
  data: TimeSeriesRow[] | undefined,
  index = 0
): TimeSeriesRow | null | undefined {
  if (data === undefined) {
    return undefined;
  }
  // if data exists and there are values at the index then return them
  if (data[index]) {
    const [timeUnix, values] = data[index];
    // protect against non-numbers (such as null)
    if (values.length > 0 && values.every((value) => !isNaN(value))) {
      return [timeUnix, values];
    }
  }
  // consider existing timeseries data, but no data point to be an error state
  return null;
}
export function getLastDataChanges(data: TimeSeriesRow[] = []): number[] {
  const [, lastDataValues] = getLastDataValues(data) || [];
  const [, previousDataValues] = getLastDataValues(data, 1) || [];
  if (!lastDataValues || !previousDataValues) {
    return [];
  }
  return previousDataValues.length === lastDataValues.length
    ? previousDataValues.map((previousDataValue, index) => {
        return lastDataValues[index] - previousDataValue;
      })
    : [];
}

export type TokenValue = number | null | undefined;
export type TokenValuePair = [
  timeUnix: TokenValue,
  valueTotal: TokenValue,
  valueDiffTotal: TokenValue
];

export function formatStatTokenValue(value: TokenValue) {
  return typeof value === 'number' ? formatCurrency(value) : value;
}
export function formatStatPercentageValue(value: TokenValue) {
  return typeof value === 'number' ? formatPercentage(value) : value;
}
