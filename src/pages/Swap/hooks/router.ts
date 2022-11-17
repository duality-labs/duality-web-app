import {
  getPairID,
  hasMatchingPairOfOrder,
  PairMap,
  TickInfo,
} from '../../../lib/web3/indexerProvider';
import { tickIndexToPrice } from '../../../lib/web3/utils/ticks';
import { RouterResult } from './index';
import { BigNumber } from 'bignumber.js';

export type SwapError = Error & {
  insufficientLiquidity?: boolean;
  insufficientLiquidityIn?: boolean;
  insufficientLiquidityOut?: boolean;
};

// mock implementation of router (no hop)
export function router(
  state: PairMap,
  tokenA: string,
  tokenB: string,
  valueA: string
): RouterResult {
  let error: SwapError | false = false;

  // find pair by searching both directions in the current state
  // the pairs are sorted by the backend not here
  const [forward, reverse] = hasMatchingPairOfOrder(state, tokenA, tokenB);

  if (!forward && !reverse) {
    error = new Error('There are no ticks for the supplied token pair');
    error.insufficientLiquidity = true;
    throw error;
  } else {
    const exactPair = forward
      ? state[getPairID(tokenA, tokenB)]
      : state[getPairID(tokenB, tokenA)];
    // note: sorting can be done earlier check this commit description
    const sortedTicks = exactPair.ticks
      .slice()
      .sort(
        forward
          ? (a, b) => Number(a.tickIndex) - Number(b.tickIndex)
          : (a, b) => Number(b.tickIndex) - Number(a.tickIndex)
      )
      .map((tick) => {
        const tickIndex = tick.tickIndex.negated();
        const price = tickIndexToPrice(tickIndex);
        return {
          ...tick,
          price,
          tickIndex,
        };
      });
    const amountIn = new BigNumber(valueA);

    try {
      const amountOut = calculateOut({
        tokenIn: tokenA,
        tokenOut: tokenB,
        amountIn: amountIn,
        sortedTicks,
      });
      const maxOut = sortedTicks.reduce((result, tick) => {
        return result.plus(reverse ? tick.reserve0 : tick.reserve1);
      }, new BigNumber(0));

      if (amountOut.isGreaterThan(maxOut)) {
        if (!error) {
          error = new Error('Not enough tick liquidity found to match trade');
        }
        error.insufficientLiquidity = true;
        error.insufficientLiquidityOut = true;
      }

      if (error) {
        throw error;
      }

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
    } catch (err) {
      throw err;
    }
  }
}

export async function routerAsync(
  state: PairMap,
  tokenA: string,
  tokenB: string,
  valueA: string
): Promise<RouterResult> {
  return await router(state, tokenA, tokenB, valueA);
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
        if (amountLeft.isLessThan(0)) {
          const error: SwapError = new Error(
            'Error while calculating amount out (negative amount)'
          );
          error.insufficientLiquidity = true;
          error.insufficientLiquidityIn = true;
          throw error;
        }
      } else {
        return amountOut.plus(maxOut);
      }
    }
  }
  // if there is still tokens left to be traded the liquidity must have been exhausted
  if (amountLeft.isGreaterThan(0)) {
    const error: SwapError = new Error('Could not swap all tokens given');
    error.insufficientLiquidity = true;
    error.insufficientLiquidityOut = true;
    throw error;
  }
  return amountOut;
}

// mock implementation of fee calculation
export function calculateFee(data: RouterResult): BigNumber {
  return new BigNumber(0);
}
