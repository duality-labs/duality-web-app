import BigNumber from 'bignumber.js';
import { useMemo } from 'react';

import { useOrderedTokenPair } from '../../lib/web3/hooks/useTokenPairs';
import { useTokenPairTickLiquidity } from '../../lib/web3/hooks/useTickLiquidity';
import { TickInfo, tickIndexToPrice } from '../../lib/web3/utils/ticks';

// current price of A to B is given in price B/A
// eg. price of ATOM in USDC is given in USDC/ATOM units
export function useCurrentPriceFromTicks(
  tokenA?: string,
  tokenB?: string
): BigNumber | undefined {
  const midIndex = useMidTickIndexFromTicks(tokenA, tokenB);
  return useMemo(() => {
    return midIndex !== undefined
      ? tickIndexToPrice(new BigNumber(midIndex))
      : undefined;
  }, [midIndex]);
}

export default function useMidTickIndexFromTicks(
  tokenA?: string,
  tokenB?: string
): number | undefined {
  const [token0, token1] = useOrderedTokenPair([tokenA, tokenB]) || [];
  const {
    data: [[token0Tick] = [], [token1Tick] = []],
  } = useTokenPairTickLiquidity([token0, token1]);

  // skip if there are no ticks to gain insight from
  if (!token0Tick && !token1Tick) {
    return;
  }

  const forward = tokenA === token0 && tokenB === token1;
  const reverse = tokenA === token1 && tokenB === token0;

  // don't know how you got here
  if (!forward && !reverse) {
    return;
  }

  const midTickIndex =
    token0Tick && token1Tick
      ? // calculate mid point
        getMidIndex(token0Tick, token1Tick)
      : // or return only found side of liquidity
        token0Tick?.tickIndex ?? token1Tick?.tickIndex;

  return (reverse ? midTickIndex?.negated() : midTickIndex)?.toNumber();

  function getMidIndex(
    highestTick0: TickInfo,
    lowestTick1: TickInfo
  ): BigNumber {
    // if they are the same tick, no need to interpolate
    if (highestTick0.tickIndex === lowestTick1.tickIndex) {
      return highestTick0.tickIndex;
    }
    // linearly interpolate an answer based off value (in reserveA units)
    const highestTick0Value = highestTick0.reserve0;
    const lowestTick1Value = lowestTick1.reserve1.multipliedBy(
      tickIndexToPrice(highestTick0.tickIndex)
    );
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
