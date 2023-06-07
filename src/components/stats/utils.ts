export type TimeSeriesRow = [unixTime: number, values: number[]];
export type TimeSeriesPage = {
  shape: Array<string>;
  data: Array<TimeSeriesRow>;
  pagination?: {
    next_key?: string | null;
  };
};

export function getLastDataValues(
  data: TimeSeriesRow[] = [],
  index = 0
): number[] {
  // if data exists and there are values at the index then return them
  if (data?.[index]) {
    const [, values] = data[index];
    // protect against non-numbers (such as null)
    if (values.every((value) => !isNaN(value))) {
      return values;
    }
  }
  return [];
}
export function getLastDataChanges(data: TimeSeriesRow[] = []): number[] {
  const lastDataValues = getLastDataValues(data);
  const previousDataValues = getLastDataValues(data, 1);
  return lastDataValues &&
    previousDataValues &&
    previousDataValues.length === lastDataValues.length &&
    previousDataValues.length > 0
    ? previousDataValues.map((previousDataValue, index) => {
        return lastDataValues[index] - previousDataValue;
      })
    : [];
}
