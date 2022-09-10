import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import { TickGroup } from './LiquiditySelector';

export default function useCurrentPriceFromTicks(feeTicks: TickGroup) {
  const invertTokenOrder = useMemo(() => {
    const { token0Count, token0Value, token1Count, token1Value } =
      feeTicks.reduce(
        (result, [price, token0Value, token1Value]) => {
          result.token0Value = result.token0Value.plus(
            token0Value.multipliedBy(price)
          );
          result.token0Count = result.token0Count.plus(token0Value);
          result.token1Value = result.token1Value.plus(
            token1Value.multipliedBy(price)
          );
          result.token1Count = result.token1Count.plus(token1Value);
          return result;
        },
        {
          token0Count: new BigNumber(0),
          token0Value: new BigNumber(0),
          token1Count: new BigNumber(0),
          token1Value: new BigNumber(0),
        }
      );
    const averageToken0Value = token0Value.dividedBy(token0Count);
    const averageToken1Value = token1Value.dividedBy(token1Count);
    return averageToken0Value > averageToken1Value;
  }, [feeTicks]);

  // estimate current price from ticks
  const currentPriceFromTicks = useMemo(() => {
    const remainingTicks = feeTicks.slice();
    const highTokenValueIndex = invertTokenOrder ? 2 : 1;
    const lowTokenValueIndex = invertTokenOrder ? 1 : 2;
    let highestLowTokenTickIndex = findLastIndex(remainingTicks, (tick) =>
      tick[lowTokenValueIndex].isGreaterThan(0)
    );
    let lowestHighTokenTickIndex = remainingTicks.findIndex((tick) =>
      tick[highTokenValueIndex].isGreaterThan(0)
    );
    do {
      const highestLowTokenTick = remainingTicks[highestLowTokenTickIndex];
      const lowestHighTokenTick = remainingTicks[lowestHighTokenTickIndex];
      if (highestLowTokenTick && lowestHighTokenTick) {
        // check if prices are resolved and current price can be plain average of these values
        const comparison = lowestHighTokenTick[0].comparedTo(
          highestLowTokenTick[0]
        );
        // return found middle point
        if (comparison === 0) {
          return lowestHighTokenTick[0];
        }
        // return average between middle points
        else if (comparison === 1) {
          return lowestHighTokenTick[0]
            .plus(highestLowTokenTick[0])
            .dividedBy(2);
        }
        // continue looping through but with one less tick:
        // attempt to remove the most "out of place" looking tick as an outlier
        else {
          const highestLowTokenTickValue = highestLowTokenTick[
            lowTokenValueIndex
          ].multipliedBy(highestLowTokenTick[0]);
          const lowestHighTokenTickValue = lowestHighTokenTick[
            highTokenValueIndex
          ].multipliedBy(lowestHighTokenTick[0]);
          if (highestLowTokenTickValue.isLessThan(lowestHighTokenTickValue)) {
            remainingTicks.splice(highestLowTokenTickIndex, 1);
            highestLowTokenTickIndex = findLastIndex(remainingTicks, (tick) =>
              tick[lowTokenValueIndex].isGreaterThan(0)
            ); // todo: search from last known index here
            lowestHighTokenTickIndex = remainingTicks.indexOf(
              lowestHighTokenTick,
              lowestHighTokenTickIndex
            );
          } else {
            remainingTicks.splice(lowestHighTokenTickIndex, 1);
            lowestHighTokenTickIndex = remainingTicks.findIndex((tick) =>
              tick[highTokenValueIndex].isGreaterThan(0)
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
