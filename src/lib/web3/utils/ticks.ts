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

const bigZero = new BigNumber(0);
export function calculateShares({
  reserve0 = bigZero,
  reserve1 = bigZero,
  price,
}: {
  reserve0?: TickInfo['reserve0'];
  reserve1?: TickInfo['reserve1'];
  price: TickInfo['price'];
}): BigNumber {
  return reserve0.plus(reserve1.dividedBy(price));
}
