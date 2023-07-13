import { TickInfo } from '../../../lib/web3/utils/ticks';
import { RouterResult } from './index';
import { BigNumber } from 'bignumber.js';

export type SwapError = Error & {
  insufficientLiquidity?: boolean;
  insufficientLiquidityIn?: boolean;
  insufficientLiquidityOut?: boolean;
  result?: RouterResult;
};

// mock implementation of router (no hop)
export function router(
  valueA: string,
  tokenA: string,
  tokenB: string,
  token0: string,
  token0Ticks: TickInfo[] = [],
  token1Ticks: TickInfo[] = []
): RouterResult {
  let error: SwapError | false = false;

  // find pair by searching both directions in the current state
  const forward = token0 === tokenA;
  const reverse = !forward;

  if (!(token0Ticks.length + token1Ticks.length > 0)) {
    error = new Error('There are no ticks for the supplied token pair');
    error.insufficientLiquidity = true;
    throw error;
  } else {
    // todo: the calculateOut can be done more efficiently using separated tick lists
    const sortedTicks = token0Ticks
      .concat(token1Ticks)
      .filter((tick) => !tick.reserve0.isZero() || !tick.reserve1.isZero())
      .sort(
        forward
          ? (a, b) => Number(a.tickIndex) - Number(b.tickIndex)
          : (a, b) => Number(b.tickIndex) - Number(a.tickIndex)
      );
    const amountIn = new BigNumber(valueA);

    try {
      const { amountOut, priceIn, priceOut, tickIndexIn, tickIndexOut } =
        calculateOut({
          tokenIn: tokenA,
          tokenOut: tokenB,
          amountIn: amountIn,
          sortedTicks,
        });
      const ticksOut = reverse ? token0Ticks : token1Ticks;
      const maxOut = ticksOut.reduce((result, tick) => {
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
        amountIn,
        tokenIn: tokenA,
        tokenOut: tokenB,
        amountOut,
        priceIn,
        priceOut,
        tickIndexIn,
        tickIndexOut,
      };
    } catch (err) {
      throw err;
    }
  }
}

export async function routerAsync(
  valueA: string,
  tokenA: string,
  tokenB: string,
  token0: string,
  token0Ticks: TickInfo[] = [],
  token1Ticks: TickInfo[] = []
): Promise<RouterResult> {
  return router(valueA, tokenA, tokenB, token0, token0Ticks, token1Ticks);
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
  amountIn: BigNumber; // amount in (in minimum denom)
  sortedTicks: Array<TickInfo>;
}): {
  amountOut: BigNumber;
  priceIn: BigNumber | undefined;
  priceOut: BigNumber | undefined;
  tickIndexIn: BigNumber | undefined;
  tickIndexOut: BigNumber | undefined;
} {
  // amountLeft is the amount of tokenIn left to be swapped
  let amountLeft = amountIn;
  // amountOut is the amount of tokenOut accumulated by the swap
  let amountOut = new BigNumber(0);
  // priceOut will be the first liquidity price touched by the swap
  let priceIn: BigNumber | undefined;
  // priceOut will be the last liquidity price touched by the swap
  let priceOut: BigNumber | undefined;
  // tickIndexIn will be the first liquidity index touched by the swap
  let tickIndexIn: BigNumber | undefined;
  // tickIndexOut will be the last liquidity index touched by the swap
  let tickIndexOut: BigNumber | undefined;
  // tokenPath is the route used to swap as an array
  // eg. tokenIn -> something -> something else -> tokenOut
  // as: [tokenIn, something, somethingElse, tokenOut]
  // TODO: handle more than the 1 hop path
  const tokenPath = [tokenIn, tokenOut];
  // loop through token path pairs
  for (let pairIndex = 0; pairIndex < tokenPath.length - 1; pairIndex++) {
    const tokens = [tokenPath[pairIndex], tokenPath[pairIndex + 1]].sort();
    // loop through the ticks of the current token pair
    for (let tickIndex = 0; tickIndex < sortedTicks.length; tickIndex++) {
      // find price in the right direction
      const isSameOrder = tokens[0] === tokenPath[pairIndex];
      const price = isSameOrder
        ? sortedTicks[tickIndex].price
        : new BigNumber(1).dividedBy(sortedTicks[tickIndex].price);
      // the reserves of tokenOut available at this tick
      const reservesOut = isSameOrder
        ? sortedTicks[tickIndex].reserve1
        : sortedTicks[tickIndex].reserve0;
      if (reservesOut.isGreaterThan(0)) {
        priceIn = priceIn || price;
        priceOut = price;
        tickIndexIn = tickIndexIn || sortedTicks[tickIndex].tickIndex;
        tickIndexOut = sortedTicks[tickIndex].tickIndex;
      }
      // the reserves of tokenOut available at this tick
      const maxOut = amountLeft
        .multipliedBy(price)
        .decimalPlaces(0, BigNumber.ROUND_DOWN);

      // if there is enough liquidity in this tick, then exit with this amount
      if (reservesOut.isGreaterThanOrEqualTo(maxOut)) {
        amountOut = amountOut.plus(maxOut);
        amountLeft = new BigNumber(0);
      }
      // if not add what is available
      else {
        amountOut = amountOut.plus(reservesOut);
        // calculate how much amountIn is still needed to be satisfied
        const amountInTraded = reservesOut
          .dividedBy(price)
          .decimalPlaces(0, BigNumber.ROUND_UP);
        amountLeft = amountLeft.minus(amountInTraded);
      }
      // if amount in has all been swapped, the exit successfully
      if (amountLeft.isZero()) {
        return { amountOut, priceIn, priceOut, tickIndexIn, tickIndexOut };
      }
      // if somehow the amount left to take out is over-satisfied the error
      else if (amountLeft.isLessThan(0)) {
        const error: SwapError = new Error(
          'Error while calculating amount out (negative amount)'
        );
        error.insufficientLiquidity = true;
        error.insufficientLiquidityIn = true;
        error.result = getLastState();
        throw error;
      }
      // if amountLeft is greater that zero then proceed to next tick
    }
  }
  // if there is still tokens left to be traded the liquidity must have been exhausted
  if (amountLeft.isGreaterThan(0)) {
    const error: SwapError = new Error('Could not swap all tokens given');
    error.insufficientLiquidity = true;
    error.insufficientLiquidityOut = true;
    error.result = getLastState();
    throw error;
  }
  // somehow we have looped through all ticks and exactly satisfied the needed swap
  // yet did not match the positive exiting condition
  // this can happen if the amountIn is zero and there are no ticks in the pair
  return { amountOut, priceIn, priceOut, tickIndexIn, tickIndexOut };

  function getLastState(): RouterResult {
    return {
      amountIn,
      tokenIn,
      tokenOut,
      amountOut,
      priceIn,
      priceOut,
      tickIndexIn,
      tickIndexOut,
    };
  }
}

// mock implementation of fee calculation
export function calculateFee(data: RouterResult): BigNumber {
  return new BigNumber(0);
}
