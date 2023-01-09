import BigNumber from 'bignumber.js';
import { TickInfo } from '../indexerProvider';

export function tickIndexToPrice(tickIndex: BigNumber): BigNumber {
  return new BigNumber(Math.pow(1.0001, tickIndex.toNumber()));
}

export function priceToTickIndex(price: BigNumber): BigNumber {
  return new BigNumber(
    Math.round(Math.log(price.toNumber()) / Math.log(1.0001))
  );
}

export function calculateShares({
  reserve0,
  reserve1,
  price,
}: TickInfo): BigNumber {
  return reserve0.plus(reserve1.dividedBy(price));
}
