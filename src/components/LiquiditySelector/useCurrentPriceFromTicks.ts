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
    data: [token0Ticks = [], token1Ticks = []],
  } = useTokenPairTickLiquidity([token0, token1]);

  // skip if there are no ticks to gain insight from
  if (!token0Ticks.length && !token1Ticks.length) {
    return;
  }

  const forward = tokenA === token0 && tokenB === token1;
  const reverse = tokenA === token1 && tokenB === token0;

  // don't know how you got here
  if (!forward && !reverse) {
    return;
  }

  const midTickIndex =
    token0Ticks.length > 0 && token1Ticks.length > 0
      ? // calculate mid point
        getMidIndex(token0Ticks, token1Ticks)
      : // or return only found side of liquidity
        token0Ticks[0]?.tickIndex ?? token1Ticks[0]?.tickIndex;

  return (reverse ? midTickIndex?.negated() : midTickIndex)?.toNumber();

  function getMidIndex(
    token0Ticks: TickInfo[],
    token1Ticks: TickInfo[]
  ): BigNumber {
    let highestTick0Index = 0;
    let lowestTick1Index = 0;
    let highestTick0 = token0Ticks[highestTick0Index];
    let lowestTick1 = token1Ticks[lowestTick1Index];
    // let behindEnemyLinesValue0 = new BigNumber(0);
    // let behindEnemyLinesValue1 = new BigNumber(0);
    while (highestTick0.tickIndex.isGreaterThan(lowestTick1.tickIndex)) {
      const nextTick0 = token0Ticks[highestTick0Index + 1];
      const nextTick1 = token1Ticks[lowestTick1Index + 1];
      // if both tick sides have liquidity, figure out which one to isolate
      if (nextTick0 && nextTick1) {
        // while the edge prices overlap:
        // find the value of each reserves in the overlapped space
        // isolate the most outer tick of the minority overlapping value token
        // this will minimize the amount of value "behind enemy lines"

        // sum "behind enemy lines" of token0
        let behindEnemyLinesValue0 = new BigNumber(0);
        for (let i = highestTick0Index; i < token0Ticks.length; i++) {
          const token0Tick = token0Ticks[i];
          if (token0Tick.tickIndex.isGreaterThan(lowestTick1.tickIndex)) {
            behindEnemyLinesValue0 = behindEnemyLinesValue0.plus(
              // get value in units of reserve0
              token0Tick.reserve0
            );
          } else {
            break;
          }
        }

        // sum "behind enemy lines" of token1
        let behindEnemyLinesValue1 = new BigNumber(0);
        for (let i = lowestTick1Index; i < token1Ticks.length; i++) {
          const token1Tick = token1Ticks[i];
          if (token1Tick.tickIndex.isLessThan(highestTick0.tickIndex)) {
            behindEnemyLinesValue1 = behindEnemyLinesValue1.plus(
              // get value in units of reserve0
              token1Tick.reserve1.multipliedBy(
                tickIndexToPrice(token1Tick.tickIndex)
              )
            );
          } else {
            break;
          }
        }

        // isolate the outer tick of the token that has less "behind enemy lines" value
        if (behindEnemyLinesValue0.isLessThan(behindEnemyLinesValue1)) {
          highestTick0Index += 1;
        } else {
          lowestTick1Index += 1;
        }
      }
      // if only one side has liquidity left then iterate through remaining ticks
      else if (nextTick0) {
        highestTick0Index += 1;
      } else if (nextTick1) {
        lowestTick1Index += 1;
      }
      // if nothing else remains it looks like we've used all the ticks
      else {
        break;
      }

      // get next edge ticks
      highestTick0 = token0Ticks[highestTick0Index];
      lowestTick1 = token1Ticks[lowestTick1Index];
    }
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
