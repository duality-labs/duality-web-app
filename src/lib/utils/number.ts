// format to a visually pleasing output
// should never be passed on to further calculations due to rounding
// it is intended that the amount passed here has no more decimal places
// than its denom exponent (eg. it has come from `getAmountInDenom()`)
export function formatAmount(
  amount: number | string,
  opts: Intl.NumberFormatOptions = {}
) {
  return Number(amount).toLocaleString('en-US', {
    maximumSignificantDigits: 6,
    minimumFractionDigits: 0,
    ...opts,
  });
}
