import BigNumber from 'bignumber.js';
import { TickInfo, useIndexerPairData } from '../../lib/web3/indexerProvider';

// current price of A to B is given in price B/A
// eg. price of ATOM in USDC is given in USDC/ATOM units
export default function useCurrentPriceFromTicks(
  tokenA?: string,
  tokenB?: string
): number | undefined {
  const midIndex = useMidTickIndexFromTicks(tokenA, tokenB);
  return midIndex !== undefined ? Math.pow(1.0001, midIndex) : undefined;
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

  const sortedTicks = ticks.sort((a, b) => a.tickIndex.comparedTo(b.tickIndex));

  const highestTick1 = sortedTicks.reduceRight<TickInfo | undefined>(
    (result, tick) => {
      if (result === undefined && tick.reserve1.isGreaterThan(0)) {
        return tick;
      }
      return result;
    },
    undefined
  );

  const lowestTick0 = sortedTicks.reduce<TickInfo | undefined>(
    (result, tick) => {
      if (result === undefined && tick.reserve0.isGreaterThan(0)) {
        return tick;
      }
      return result;
    },
    undefined
  );

  const midTickIndex =
    highestTick1 && lowestTick0
      ? // calculate mid point
        getMidIndex(highestTick1, lowestTick0)
      : // or return only found side of liquidity
        highestTick1?.tickIndex ?? lowestTick0?.tickIndex;

  // you may think reverse is wrong here, but it is not
  // remember we are returning the ratio of tokenB/tokenA
  return (reverse ? midTickIndex : midTickIndex?.negated())?.toNumber();

  function getMidIndex(
    highestTick1: TickInfo,
    lowestTick0: TickInfo
  ): BigNumber {
    // linearly interpolate an answer
    // get weights of each side in terms of token0 units
    const highestTick1Reserves = sortedTicks
      .filter((tick) => tick.tickIndex.isEqualTo(highestTick1.tickIndex))
      .reduce((result, tick) => {
        return result.plus(tick.reserve1);
      }, new BigNumber(0))
      .dividedBy(Math.pow(1.0001, highestTick1.tickIndex.toNumber()));
    const lowestTick0Reserves = sortedTicks
      .filter((tick) => tick.tickIndex.isEqualTo(lowestTick0.tickIndex))
      .reduce((result, tick) => {
        return result.plus(tick.reserve0);
      }, new BigNumber(0));
    // calculate the mid point
    const linearPercentage = highestTick1Reserves.dividedBy(
      highestTick1Reserves.plus(lowestTick0Reserves)
    );
    return highestTick1.tickIndex.plus(
      linearPercentage.multipliedBy(
        lowestTick0.tickIndex.minus(highestTick1.tickIndex)
      )
    );
  }
}
