import { PairMap, TickInfo } from '../../../lib/web3/indexerProvider';
import { RouterResult } from './index';
import { BigNumber } from 'bignumber.js';

// mock implementation of router (no hop)
export function router(
  state: PairMap,
  tokenA: string,
  tokenB: string,
  value0: string
): RouterResult {
  const [token0, token1] = [tokenA, tokenB].sort();
  // find pair by searching both directions in the current state
  const exactPair = Object.values(state).find(
    (pairInfo) =>
      (pairInfo.token0 === token0 && pairInfo.token1 === token1) ||
      (pairInfo.token0 === token1 && pairInfo.token1 === token0)
  );
  if (!exactPair) {
    throw new Error('There are no ticks for the supplied token pair');
  } else {
    const sortedTicks =
      token1 === tokenA ? exactPair.poolsZeroToOne : exactPair.poolsOneToZero;
    const amountIn = new BigNumber(value0);
    return {
      amountIn: amountIn,
      tokenIn: tokenA,
      tokenOut: tokenB,
      amountOut: calculateOut({
        tokenIn: tokenA,
        tokenOut: tokenB,
        amountIn: amountIn,
        sortedTicks,
      }),
    };
  }
}

export async function routerAsync(
  state: PairMap,
  token0: string,
  token1: string,
  value0: string
): Promise<RouterResult> {
  return await router(state, token0, token1, value0);
}

/**
 * Calculates the amountOut using the (amountIn * price0) / (price1) formula
 * for each tick, until the amountIn amount has been covered
 * @param data the RouteInput struct
 * @returns estimated value for amountOut
 */
export function calculateOut({
  tokenIn,
  tokenOut,
  amountIn,
  sortedTicks,
}: {
  tokenIn: string; // address
  tokenOut: string; // address
  amountIn: BigNumber;
  sortedTicks: Array<TickInfo>;
}): BigNumber {
  let amountLeft = amountIn;
  let amountOut = new BigNumber(0);
  // TODO: handle more than the 1 hop path
  const tokenPath = [tokenIn, tokenOut];
  for (let pairIndex = 0; pairIndex < tokenPath.length - 1; pairIndex++) {
    const tokens = [tokenPath[pairIndex], tokenPath[pairIndex + 1]].sort();
    for (let tickIndex = 0; tickIndex < sortedTicks.length; tickIndex++) {
      const isSameOrder = tokens[0] === tokenPath[pairIndex];
      const price = isSameOrder
        ? sortedTicks[tickIndex].price
        : new BigNumber(1).dividedBy(sortedTicks[tickIndex].price);
      const reservesOut = isSameOrder
        ? sortedTicks[tickIndex].reserve1
        : sortedTicks[tickIndex].reserve0;
      const maxOut = amountLeft.multipliedBy(price);

      if (reservesOut.isLessThan(maxOut)) {
        const amountInTraded = reservesOut.multipliedBy(price);
        amountLeft = amountLeft.minus(amountInTraded);
        amountOut = amountOut.plus(reservesOut);
        if (amountLeft.isEqualTo(0)) return amountOut;
        if (amountLeft.isLessThan(0))
          throw new Error(
            'Error while calculating amount out (negative amount)'
          );
      } else {
        return amountOut.plus(maxOut);
      }
    }
  }
  return amountOut;
}

// mock implementation of fee calculation
export function calculateFee(data: RouterResult): BigNumber {
  return new BigNumber(0);
}
