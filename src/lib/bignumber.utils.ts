import BigNumber from 'bignumber.js';

/**
 * Format Price information nicely to a certain amount of significant digits
 * @param value BigNumber
 * @param significantDigits number
 * @returns string
 */
export function formatPrice(value: BigNumber, significantDigits = 3): string {
  return value
    .dp(
      Math.max(0, value.dp() - value.sd(true) + significantDigits),
      BigNumber.ROUND_HALF_UP
    )
    .toFixed();
}
