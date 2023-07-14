import BigNumber from 'bignumber.js';
import { Token } from './tokens';

/**
 * price1To0:
 *
 * we center our definition of price1To0 from the chain definition
 * in link: https://github.com/duality-labs/duality/blob/v0.1.5/x/dex/keeper/core_helper.go#L148-L151
 * price1To0 helps use convert token1 amounts to equivalent token0 amounts
 * for relative value calculations, hence the name "1 to 0"
 * $ totalAmount0 = amount0 + amount1 * price1To0
 *
 * we can explain further with an example across a few orders of magnitude:
 *  - take token0 as ETH
 *  - take token1 as USDC
 *  - take price0 = 1000USD/ETH
 *  - take price1 = 1USD/USDC
 *
 * $ totalAmount0 = amount0 + amount1 * price1To0
 * $ totalAmountETH = amountETH + amountUSDC * priceUSDCToETH
 * $ totalAmountETH = amountETH + amountUSDC * (priceUSD/USDC / priceUSD/ETH)
 * $ totalAmountETH = amountETH + amountUSDC * (price1 / price0)ETH/USDC
 * $ totalAmountETH = amountETH + amountUSDC * 0.001ETH/USDC
 *
 * therefore: price1To0 = price1 / price0
 */
type Price = BigNumber;

/**
 * tickIndex1To0:
 *
 * tickIndex1To0 represents the tickIndex of the tokenPair 0<>1 at price1To0
 * price = 1.0001^[tickIndex] and
 * tickIndex = log(price) / log(1.0001)
 *  # for direction 1To0 that means:
 * price1To0 = 1.0001^[tickIndex1To0] and
 * tickIndex1To0 = log(price1To0) / log(1.0001)
 *  # from our example token pair ETH<>USDC:
 * tickIndex1To0 = log(0.001) / log(1.0001)
 * tickIndex1To0 = -69081 (always rounded to an integer)

 * importantly the API will usually return tickIndex1To0 as tickIndex
 */
type TickIndex = BigNumber;

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
  // price1To0 is an approximate decimal (to 18 places) ratio of price1/price0
  // see Price definition above
  price1To0: Price;
  // tickIndex1To0 is an integer representing price1To0 using the equation:
  //   price = 1.0001^[tickIndex]
  // see TickIndex definition above
  tickIndex1To0: TickIndex;
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
  price1To0,
  tickIndex1To0,
  reserve0 = bigZero,
  reserve1 = bigZero,
}: Partial<TickInfo> &
  // must include either price1To0 or tickIndex1To0
  (| {
        price1To0: TickInfo['price1To0'];
      }
    | {
        price1To0?: undefined;
        tickIndex1To0: TickInfo['tickIndex1To0'];
      }
  )): BigNumber {
  return reserve0.plus(
    reserve1.multipliedBy(price1To0 || tickIndexToPrice(tickIndex1To0))
  );
}
