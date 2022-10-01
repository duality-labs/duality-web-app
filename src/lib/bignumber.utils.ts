import BigNumber from 'bignumber.js';

/**
 * Format Price information nicely to a certain amount of significant digits
 * @param value BigNumber
 * @param significantDigits number
 * @param removeTrailingZeros boolean
 * @returns string
 */
export function formatPrice(
  value: BigNumber,
  significantDigits = 3,
  removeTrailingZeros = true
): string {
  const decimalPlaces = Math.max(
    0,
    value.dp() - value.sd(true) + significantDigits
  );
  return removeTrailingZeros
    ? value.dp(decimalPlaces, BigNumber.ROUND_HALF_UP).toFixed()
    : value.toFixed(decimalPlaces, BigNumber.ROUND_HALF_UP);
}
