import BigNumber from 'bignumber.js';

export function tickIndexToPrice(tickIndex: BigNumber): BigNumber {
  return new BigNumber(Math.pow(1.0001, tickIndex.toNumber()));
}

export function priceToTickIndex(price: BigNumber): BigNumber {
  return new BigNumber(
    Math.round(Math.log(price.toNumber()) / Math.log(1.0001))
  );
}
