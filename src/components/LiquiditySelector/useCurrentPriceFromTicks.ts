import BigNumber from 'bignumber.js';
import { TickInfo, useIndexerPairData } from '../../lib/web3/indexerProvider';
import { tickIndexToPrice } from '../../lib/web3/utils/ticks';

// current price of A to B is given in price B/A
// eg. price of ATOM in USDC is given in USDC/ATOM units
export default function useCurrentPriceFromTicks(
  tokenA?: string,
  tokenB?: string
): number | undefined {
  const midIndex = useMidTickIndexFromTicks(tokenA, tokenB);
  return midIndex !== undefined
    ? tickIndexToPrice(new BigNumber(midIndex)).toNumber()
    : undefined;
}

function useMidTickIndexFromTicks(
  tokenA?: string,
  tokenB?: string
): number | undefined {
  const { data: { ticks = [], token0, token1 } = {} } = useIndexerPairData(
    tokenA,
    tokenB
  );

  // skip if there are no ticks to gain insight from
  if (!ticks.length) {
    return;
  }

  const forward = tokenA === token0 && tokenB === token1;
  const reverse = tokenA === token1 && tokenB === token0;

  // don't know how you got here
  if (!forward && !reverse) {
    return;
  }

  const sortedTicks = ticks
    // ignore irrelevant ticks
    .filter((tick) => !tick.reserve0.isZero() || !tick.reserve1.isZero())
    // ensure ticks are sorted
    .sort((a, b) => a.tickIndex.comparedTo(b.tickIndex));

  const highestTick0 = sortedTicks.reduceRight<TickInfo | undefined>(
    (result, tick) => {
      if (result === undefined && tick.reserve0.isGreaterThan(0)) {
        return tick;
      }
      return result;
    },
    undefined
  );

  const lowestTick1 = sortedTicks.reduce<TickInfo | undefined>(
    (result, tick) => {
      if (result === undefined && tick.reserve1.isGreaterThan(0)) {
        return tick;
      }
      return result;
    },
    undefined
  );

  const midTickIndex =
    highestTick0 && lowestTick1
      ? // calculate mid point
        getMidIndex(highestTick0, lowestTick1)
      : // or return only found side of liquidity
        highestTick0?.tickIndex ?? lowestTick1?.tickIndex;

  return (reverse ? midTickIndex?.negated() : midTickIndex)?.toNumber();

  function getMidIndex(
    highestTick0: TickInfo,
    lowestTick1: TickInfo
  ): BigNumber {
    // if they are the same tick, no need to interpolate
    if (highestTick0.tickIndex === lowestTick1.tickIndex) {
      return highestTick0.tickIndex;
    }
    // linearly interpolate an answer
    // get weights of each side in terms of token0 units
    const highestTick0Value = sortedTicks
      .filter((tick) => tick.tickIndex.isEqualTo(highestTick0.tickIndex))
      .reduce((result, tick) => {
        return result.plus(tick.reserve0);
      }, new BigNumber(0))
      .dividedBy(Math.pow(1.0001, highestTick0.tickIndex.toNumber()));
    const lowestTick1Value = sortedTicks
      .filter((tick) => tick.tickIndex.isEqualTo(lowestTick1.tickIndex))
      .reduce((result, tick) => {
        return result.plus(tick.reserve1);
      }, new BigNumber(0))
      .multipliedBy(Math.pow(1.0001, lowestTick1.tickIndex.toNumber()));
    // calculate the mid point
    const linearPercentage = lowestTick1Value.dividedBy(
      highestTick0Value.plus(lowestTick1Value)
    );
    return highestTick0.tickIndex.plus(
      linearPercentage.multipliedBy(
        lowestTick1.tickIndex.minus(highestTick0.tickIndex)
      )
    );
  }
}
