import { useMemo } from 'react';
import { TickGroup } from './LiquiditySelector';

export default function useCurrentPriceFromTicks(feeTicksBigNumber: TickGroup) {
  const feeTicks = useMemo(
    () =>
      feeTicksBigNumber.map(([price, amount0, amount1]) => [
        price.toNumber(),
        amount0.toNumber(),
        amount1.toNumber(),
      ]),
    [feeTicksBigNumber]
  );

  const invertTokenOrder = useMemo(() => {
    const { token0Count, token0Value, token1Count, token1Value } =
      feeTicks.reduce(
        (result, [price, token0Value, token1Value]) => {
          result.token0Value += price * token0Value;
          result.token0Count += token0Value;
          result.token1Value += price * token1Value;
          result.token1Count += token1Value;
          return result;
        },
        { token0Count: 0, token0Value: 0, token1Count: 0, token1Value: 0 }
      );
    const averageToken0Value = token0Value / token0Count;
    const averageToken1Value = token1Value / token1Count;
    return averageToken0Value > averageToken1Value;
  }, [feeTicks]);

  // estimate current price from ticks
  const currentPriceFromTicks = useMemo(() => {
    const remainingTicks = feeTicks.slice();
    const highTokenValueIndex = invertTokenOrder ? 2 : 1;
    const lowTokenValueIndex = invertTokenOrder ? 1 : 2;
    let highestLowTokenTickIndex = findLastIndex(
      remainingTicks,
      (tick) => tick[lowTokenValueIndex] > 0
    );
    let lowestHighTokenTickIndex = remainingTicks.findIndex(
      (tick) => tick[highTokenValueIndex] > 0
    );
    do {
      const highestLowTokenTick = remainingTicks[highestLowTokenTickIndex];
      const lowestHighTokenTick = remainingTicks[lowestHighTokenTickIndex];
      if (highestLowTokenTick && lowestHighTokenTick) {
        // check if prices are resolved and current price can be plain average of these values
        if (lowestHighTokenTick[0] >= highestLowTokenTick[0]) {
          return (lowestHighTokenTick[0] + highestLowTokenTick[0]) / 2;
        } else {
          const highestLowTokenTickValue =
            highestLowTokenTick[lowTokenValueIndex] * highestLowTokenTick[0];
          const lowestHighTokenTickValue =
            lowestHighTokenTick[highTokenValueIndex] * lowestHighTokenTick[0];
          if (highestLowTokenTickValue < lowestHighTokenTickValue) {
            remainingTicks.splice(highestLowTokenTickIndex, 1);
            highestLowTokenTickIndex = findLastIndex(
              remainingTicks,
              (tick) => tick[lowTokenValueIndex] > 0
            ); // todo: search from last known index here
            lowestHighTokenTickIndex = remainingTicks.indexOf(
              lowestHighTokenTick,
              lowestHighTokenTickIndex
            );
          } else {
            remainingTicks.splice(lowestHighTokenTickIndex, 1);
            lowestHighTokenTickIndex = remainingTicks.findIndex(
              (tick) => tick[highTokenValueIndex] > 0
            ); // todo: search from last known index here
            highestLowTokenTickIndex = remainingTicks.lastIndexOf(
              highestLowTokenTick,
              highestLowTokenTickIndex
            );
          }
        }
      } else {
        return undefined;
      }
    } while (remainingTicks.length > 0);
  }, [feeTicks, invertTokenOrder]);

  return currentPriceFromTicks;
}

/**
 * Returns the index of the last element in the array where predicate is true, and -1
 * otherwise.
 * @param array The source array to search in
 * @param predicate find calls predicate once for each element of the array, in descending
 * order, until it finds one where predicate returns true. If such an element is found,
 * findLastIndex immediately returns that element index. Otherwise, findLastIndex returns -1.
 */
export function findLastIndex<T>(
  array: Array<T>,
  predicate: (value: T, index: number, obj: T[]) => boolean
): number {
  let l = array.length;
  while (l--) {
    if (predicate(array[l], l, array)) return l;
  }
  return -1;
}
