import BigNumber from 'bignumber.js';
import { TickInfo } from '../indexerProvider';

export function tickIndexToPrice(tickIndex: BigNumber): BigNumber {
  return new BigNumber(Math.pow(1.0001, tickIndex.toNumber()));
}

export function priceToTickIndex(
  price: BigNumber,
  roundingMethod = 'none' as 'round' | 'ceil' | 'floor' | 'none'
): BigNumber {
  const roundingFunction =
    roundingMethod !== 'none' ? Math[roundingMethod] : (v: number) => v;
  return new BigNumber(
    roundingFunction(Math.log(price.toNumber()) / Math.log(1.0001))
  );
}

const bigZero = new BigNumber(0);
export function calculateShares({
  price,
  tickIndex,
  reserve0 = bigZero,
  reserve1 = bigZero,
}: Partial<TickInfo> &
  // must include either price or tickIndex
  (| {
        price: TickInfo['price'];
      }
    | {
        price?: undefined;
        tickIndex: TickInfo['tickIndex'];
      }
  )): BigNumber {
  return reserve0.plus(
    reserve1.multipliedBy(price || tickIndexToPrice(tickIndex))
  );
}
