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
  amount: number | string,
  {
    minimumSignificantDigits = 3,
    maximumSignificantDigits,
    ...numberFormatOptions
  }: Intl.NumberFormatOptions = {},
  // default small value reformatting to false to show all significant digits
  { reformatSmallValues = false, ...reformatOptions } = {}
) {
  const numericAmount = Number(amount);
  const orderOfMagnitude = Math.floor(Math.log10(Math.abs(numericAmount)));
  // control number of decimal places by enforcing significant digits
  const significantDigits = Math.max(
    orderOfMagnitude,
    minimumSignificantDigits
  );
  return formatAmount(
    numericAmount,
    {
      minimumSignificantDigits: significantDigits,
      maximumSignificantDigits: significantDigits,
      ...numberFormatOptions,
    },
    { reformatSmallValues, ...reformatOptions }
  );
}

// I think my final resolution is
// - put everything through formatAmount
// - if `minimumSignificantDigits` or `maximumSignificantDigits` are set then
// - call internal function formatMaximumSignificantDecimals to apply significant digit rounding first
//   - in the way that non-decimal digits are never changed to 0 due to maximumSignificantDigits
// - then apply `minimumFractionDigits` and `maximumFractionDigits` rounding

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
    maximumFractionDigits: givenMaximumFractionDigits = 6,
    ...numberFormatOptions
  }: Intl.NumberFormatOptions = {},
  { reformatSmallValues = true } = {}
) {
  const maximumFractionDigits = Math.max(
    minimumFractionDigits,
    givenMaximumFractionDigits
  );
  const numericAmount = Number(amount);
  // todo: call minimumSignificantDigits here?
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
  {
    minimumSignificantDigits,
    ...numberFormatOptions
  }: Intl.NumberFormatOptions = {}
) {
  const numericAmount = Number(amount) * 100;
  // only format significant decimals if asked to
  const roundedAmount = minimumSignificantDigits
    ? formatMaximumSignificantDecimals(numericAmount, {
        minimumSignificantDigits,
      })
    : numericAmount;
  return `${formatAmount(roundedAmount, {
    // add defaults
    useGrouping: true,
    // add user given options
    minimumSignificantDigits,
    ...numberFormatOptions,
  })}%`;
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
  return formatPrice(amount, {
    maximumSignificantDigits: 6,
    ...opts,
  });
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
    useGrouping: true,
    // add user given options
    minimumFractionDigits,
    maximumFractionDigits,
    ...numberFormatOptions,
  });
}
