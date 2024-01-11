import { roundToSignificantDigits } from '../../lib/utils/number';

export function getRangeIndexes(
  currentPriceIndex: number | undefined,
  fractionalRangeMinIndex: number,
  fractionalRangeMaxIndex: number
) {
  const roundedCurrentPriceIndex =
    currentPriceIndex && Math.round(currentPriceIndex);
  const rangeMinIndex = roundToSignificantDigits(fractionalRangeMinIndex);
  const rangeMaxIndex = roundToSignificantDigits(fractionalRangeMaxIndex);
  // align fractional index positions to whole tick index positions
  // for the min and max cases
  if (roundedCurrentPriceIndex === undefined) {
    return [rangeMinIndex - 0.5, rangeMaxIndex + 0.5];
  }
  return [
    Math.ceil(rangeMinIndex) +
      (rangeMinIndex >= roundedCurrentPriceIndex ? -1 : 0),
    Math.floor(rangeMaxIndex) +
      (rangeMaxIndex <= roundedCurrentPriceIndex ? +1 : 0),
  ];
}
