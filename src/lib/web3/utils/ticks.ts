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
  price,
  tickIndex,
  reserve0 = bigZero,
  reserve1 = bigZero,
}: (
  | {
      price: TickInfo['price'];
      tickIndex?: undefined;
    }
  | {
      price?: undefined;
      tickIndex: TickInfo['tickIndex'];
    }
) & {
  reserve0?: TickInfo['reserve0'];
  reserve1?: TickInfo['reserve1'];
}): BigNumber {
  return reserve0.plus(
    reserve1.multipliedBy(price || tickIndexToPrice(tickIndex))
  );
}
