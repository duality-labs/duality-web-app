import BigNumber from 'bignumber.js';
import { Token } from './tokens';

/**
 * TickMap contains a mapping from tickIDs to tick indexes inside poolsZeroToOne and poolsOneToZero
 */
export interface TickMap {
  [tickID: string]: PoolTicks;
}

type PoolTicks = [
  index0to1: TickInfo | undefined,
  index1to0: TickInfo | undefined
];

/**
 * TickInfo is a reflection of the backend structue "DexPool"
 * but utilising BigNumber type instead of BigNumberString type properties
 */
export interface TickInfo {
  token0: Token;
  token1: Token;
  reserve0: BigNumber;
  reserve1: BigNumber;
  fee: BigNumber;
  tickIndex: BigNumber; // tickIndex is the exact price ratio in the form: 1.0001^[tickIndex]
  price: BigNumber; // price is an approximate decimal (to 18 places) ratio of price1/price0
}

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
