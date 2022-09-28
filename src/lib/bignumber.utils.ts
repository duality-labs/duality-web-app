import BigNumber from 'bignumber.js';

/**
 * Format Price information nicely to a certain amount of significant digits
 * @param value BigNumber
 * @returns string
 */
export function formatPrice(value: BigNumber): string {
  return value
    .dp(Math.max(0, value.dp() - value.sd(true) + 3), BigNumber.ROUND_HALF_UP)
    .toFixed();
}
