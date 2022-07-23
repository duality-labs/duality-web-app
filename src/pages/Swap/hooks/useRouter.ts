import { PairMap } from '../../../lib/web3/indexerProvider';
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
  const exactPair = Object.values(state).find(
    (pairInfo) => pairInfo.token0 === token0 && pairInfo.token1 === token1
  );
  if (!exactPair) {
    return {
      amountIn: new BigNumber(value0),
      tokens: [tokenA, tokenB],
      prices0: [],
      prices1: [],
      fees: [],
      reserves0: [],
      reserves1: [],
    };
  } else {
    const sortMultiplier = token1 === tokenA ? -1 : 1;
    const sortedTicks = Object.values(exactPair.ticks).sort(
      (tick0, tick1) =>
        sortMultiplier *
        tick0.price0
          .dividedBy(tick0.price1)
          .comparedTo(tick1.price0.dividedBy(tick1.price1))
    );
    return {
      amountIn: new BigNumber(value0),
      tokens: [tokenA, tokenB],
      prices0: [sortedTicks.map((tickInfo) => tickInfo.price0)], // price
      prices1: [sortedTicks.map((tickInfo) => tickInfo.price1)],
      fees: [sortedTicks.map((tickInfo) => tickInfo.fee)],
      reserves0: [sortedTicks.map((tickInfo) => tickInfo.reserves0)], // reserves
      reserves1: [sortedTicks.map((tickInfo) => tickInfo.reserves1)],
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
export function calculateOut(data: RouterResult): BigNumber {
  let amountLeft = data.amountIn;
  let amountOut = new BigNumber(0);
  for (let pairIndex = 0; pairIndex < data.tokens.length - 1; pairIndex++) {
    const tokens = [data.tokens[pairIndex], data.tokens[pairIndex + 1]].sort();
    for (
      let tickIndex = 0;
      tickIndex < data.prices0[pairIndex].length;
      tickIndex++
    ) {
      const isSameOrder = tokens[0] === data.tokens[pairIndex];
      const priceIn = isSameOrder
        ? data.prices0[pairIndex][tickIndex]
        : data.prices1[pairIndex][tickIndex];
      const priceOut = isSameOrder
        ? data.prices1[pairIndex][tickIndex]
        : data.prices0[pairIndex][tickIndex];
      const reservesOut = isSameOrder
        ? data.reserves1[pairIndex][tickIndex]
        : data.reserves0[pairIndex][tickIndex];
      const maxOut = amountLeft.multipliedBy(priceIn).dividedBy(priceOut);

      if (reservesOut.isLessThan(maxOut)) {
        const amountInTraded = reservesOut
          .multipliedBy(priceOut)
          .dividedBy(priceIn);
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
  return data.fees[0][0];
}

export function useRouter(
  state: PairMap,
  token0: string,
  token1: string,
  value0: string
): RouterResult {
  return router(state, token0, token1, value0);
}
