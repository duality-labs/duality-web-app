import { useMemo } from 'react';
import { TickInfo, TickMap } from '../../lib/web3/indexerProvider';
import { TickGroup } from './LiquiditySelector';

function defaultTickFilter(tick: TickInfo | undefined) {
  return !!tick;
}

export default function useCurrentPriceFromTicks(
  ticks: TickMap = {},
  tickFilter = defaultTickFilter
) {
  // collect tick information in a more useable form
  const feeTicks: TickGroup = useMemo(() => {
    return Object.values(ticks)
      .map((poolTicks) => poolTicks[0] || poolTicks[1]) // read tick if it exists on either pool queue side
      .filter((tick): tick is TickInfo => tickFilter(tick)) // filter to relevant ticks
      .map((tick) => ({
        ...tick,
        virtualPrice: tick.price.multipliedBy(tick.fee.plus(1)),
      })) // add virtual price
      .sort((tick0, tick1) => tick0.virtualPrice.comparedTo(tick1.virtualPrice)) // sort by virtual price
      .map((tick) => [tick.virtualPrice, tick.reserve0, tick.reserve1]); // use virtual price always here
  }, [ticks, tickFilter]);

  // estimate current price from ticks
  const currentPriceFromTicks = useMemo(() => {
    if (!feeTicks.length) return;
    const remainingTicks = feeTicks.slice();
    const highTokenValueIndex = 2;
    const lowTokenValueIndex = 1;
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
  }, [feeTicks]);

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
