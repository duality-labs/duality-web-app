import BigNumber from 'bignumber.js';

// rounding to 6 significant figures will guarantee a unique index
// for all tick indexes using the basis of price = 1.0001^index
export function roundToSignificantDigits(
  value: number,
  significantDigits = 8
): number {
  if (value === 0) return 0;
  const orderOfMagnitude = Math.floor(Math.log10(Math.abs(value)));
  const factor = Math.pow(10, significantDigits - orderOfMagnitude - 1);
  return Math.round(value * factor) / factor;
}

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
  const roundingFunction = BigNumber.ROUND_HALF_UP;
  const roundedValue = bigValue.abs().toPrecision(6, roundingFunction);
  const roundedOrderOfMagnitude = Math.floor(
    Math.log10(Number(roundedValue) || 1)
  );
  return bigValue.toFixed(
    Math.max(0, maximumSignificantDecimals - roundedOrderOfMagnitude - 1),
    roundingFunction
  );
}

// format to a visually pleasing output
// should never be passed on to further calculations due to rounding
// it is intended that the amount passed here has no more decimal places
// than its denom exponent (eg. 18 set from a typical `getDisplayDenomAmount()`
// or had its digits restricted with `formatMaximumSignificantDecimals()`)
// this is because there is a conflict between setting fractionDigits and
// significantDigits at the same time (which isn't resolved in any browser yet)

// note: minimumFractionDigits and maximumFractionDigits are ignored here
// link: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat#roundingpriority
export function formatAmount(
  amount: number | string,
  {
    minimumFractionDigits = 0,
    // avoid rendering very long fractional values with a practical limit
    maximumFractionDigits = Math.max(minimumFractionDigits, 6),
    ...numberFormatOptions
  }: Intl.NumberFormatOptions = {},
  { reformatSmallValues = true } = {}
) {
  const numericAmount = Number(amount);
  // use passed limits to determine when we show a small value (eg. <0.001)
  const minimumValue = Math.pow(10, -maximumFractionDigits);
  const isSmallValue =
    reformatSmallValues && numericAmount > 0 && numericAmount < minimumValue;
  const stringAmount = (
    isSmallValue ? minimumValue : !isNaN(numericAmount) ? numericAmount : '-'
  ).toLocaleString('en-US', {
    // add defaults
    useGrouping: false,
    // add user given options
    minimumFractionDigits,
    maximumFractionDigits,
    ...numberFormatOptions,
  });
  // add "less than" indicator for small (non-zero) amounts
  return `${isSmallValue ? '<' : ''}${stringAmount}`;
}

export function formatPercentage(
  amount: number | string,
  opts: Intl.NumberFormatOptions = {},
  maximumSignificantDecimals = opts.maximumSignificantDigits ?? 3
) {
  const percentage = Number(amount) * 100;
  const roundedAmount = formatMaximumSignificantDecimals(
    percentage,
    maximumSignificantDecimals
  );
  const numericAmount = Number(roundedAmount);
  return !isNaN(numericAmount)
    ? `${formatAmount(numericAmount, {
        useGrouping: true,
        ...opts,
      })}%`
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

// format to a visually pleasing output of currency eg. $1,234.00 / <$0.01 / $0
// should never be passed on to further calculations due to rounding
// it is intended that the amount passed here has no more decimal places
// than its denom exponent (eg. it has come from `getDisplayDenomAmount()`)
export function formatCurrency(
  amount: number | string,
  {
    minimumFractionDigits = 2,
    maximumFractionDigits = minimumFractionDigits,
    ...numberFormatOptions
  }: Intl.NumberFormatOptions = {}
) {
  return formatAmount(amount, {
    // add defaults
    currency: 'USD',
    currencyDisplay: 'symbol',
    style: 'currency',
    // add user given options
    minimumFractionDigits,
    maximumFractionDigits,
    ...numberFormatOptions,
  });
}
