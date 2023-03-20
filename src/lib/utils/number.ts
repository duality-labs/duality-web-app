import BigNumber from 'bignumber.js';

const { REACT_APP__MAX_FRACTION_DIGITS = '' } = process.env;
const maxFractionDigits = parseInt(REACT_APP__MAX_FRACTION_DIGITS) || 20;

// format a special "significant decimals" function which means
// something different when above and below 0.
// eg. significant decimals of 3 can format 1,234,567 and 0.00000123
// it mainly prevents too many decimals like 1,234,567.8901 or 0.00000123456789
// the result should be somewhat easy to read across many orders of magnitude
// eg. starting from 123,456 and decreasing order of magnitude:
// 1234567
// 123456
// 12345
// 1234
// 123
// 12.3
// 1.23
// 0.123
// 0.0123
// 0.00123

// we name it inconsistently against Number.toLocaleString argument properties
// because it is not the same, it does not translate directly to that method
export function formatMaximumSignificantDecimals(
  value: BigNumber.Value,
  maximumSignificantDecimals = 3
) {
  const bigValue = new BigNumber(value);
  const orderOfMagnitude = Math.floor(Math.log10(bigValue.toNumber()));
  return bigValue.toFixed(
    Math.max(0, maximumSignificantDecimals - orderOfMagnitude - 1),
    BigNumber.ROUND_HALF_UP
  );
}

// format to a visually pleasing output
// should never be passed on to further calculations due to rounding
// it is intended that the amount passed here has no more decimal places
// than its denom exponent (eg. 18 set from a typical `getAmountInDenom()` call
// or had its digits restricted with `formatMaximumSignificantDecimals()`)
// this is because there is a conflict between setting fractionDigits and
// significantDigits at the same time (which isn't resolved in any browser yet)

// note: minimumFractionDigits and maximumFractionDigits are ignored here
// link: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat#roundingpriority
export function formatAmount(
  amount: number | string,
  opts: Intl.NumberFormatOptions = {}
) {
  const numericAmount = Number(amount);
  return !isNaN(numericAmount)
    ? numericAmount.toLocaleString('en-US', {
        maximumFractionDigits: maxFractionDigits,
        maximumSignificantDigits: 6,
        useGrouping: false,
        ...opts,
      })
    : '-';
}

export function formatPrice(
  amount: number | string,
  opts: Intl.NumberFormatOptions = {}
) {
  return formatAmount(amount, {
    maximumSignificantDigits: 3,
    ...opts,
  });
}

export function formatLongPrice(
  amount: number | string,
  opts: Intl.NumberFormatOptions = {}
) {
  return formatPrice(amount, { maximumSignificantDigits: 6, ...opts });
}

// format to a visually pleasing output of currency
// should never be passed on to further calculations due to rounding
// it is intended that the amount passed here has no more decimal places
// than its denom exponent (eg. it has come from `getAmountInDenom()`)
export function formatCurrency(amount: number | string, currency = 'USD') {
  return Number(amount).toLocaleString('en-US', {
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    currencyDisplay: 'symbol',
    style: 'currency',
  });
}
