// format to a visually pleasing output
// should never be passed on to further calculations due to rounding
// it is intended that the amount passed here has no more decimal places
// than its denom exponent (eg. it has come from `getAmountInDenom()`)
export function formatAmount(
  amount: number | string,
  opts: Intl.NumberFormatOptions = {}
) {
  const numericAmount = Number(amount);
  return !isNaN(numericAmount)
    ? numericAmount.toLocaleString('en-US', {
        maximumSignificantDigits: 6,
        minimumFractionDigits: 0,
        ...opts,
      })
    : '-';
}

// format to a visually pleasing output of currency
// should never be passed on to further calculations due to rounding
// it is intended that the amount passed here has no more decimal places
// than its denom exponent (eg. it has come from `getAmountInDenom()`)
export function formatCurrency(amount: number | string, currency = 'USD') {
  return formatAmount(amount, {
    currency,
    maximumSignificantDigits: 2,
    currencyDisplay: 'symbol',
    style: 'currency',
  });
}
