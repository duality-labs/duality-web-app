import { PairMap } from '../../../lib/web3/indexerProvider';
import { RouterResult } from './index';
import { BigNumber } from 'ethers';

// TODO actually fix implementation
export function router(
  state: PairMap,
  token0: string,
  token1: string,
  value0: string
): RouterResult {
  return {
    amountIn: BigNumber.from(value0),
    tokens: [token0, token1],
    prices0: [[BigNumber.from(value0)]], // price
    prices1: [[BigNumber.from(value0)]],
    fees: [[BigNumber.from(0)]],
    jitProtectionArr: [[false]], // reserves
    useInternalAccounts: false,
    permitData: [],
  };
}

export function routerAsync(
  state: PairMap,
  token0: string,
  token1: string,
  value0: string
): Promise<RouterResult> {
  return new Promise(function (resolve) {
    resolve(router(state, token0, token1, value0));
  });
}

// TODO actually fix implementation
/**
 * Calculates the amountOut using the (amountIn * price0 * fee) / (10000 * price1) formula
 * for each tick, until the amountIn amount has been covered
 * @param data the RouteInput struct
 * @returns estimated value for amountOut
 */
export function calculateOut(data: RouterResult): BigNumber {
  return data.amountIn;
}

// TODO actually fix implementation + fix formula in comment
/**
 * Calculates the amountOut using the (amountIn * price0) / (price1) - (amountIn * price0 * fee) / (10000 * price1) formula
 * for each tick, until the amountIn amount has been covered
 * @param data the RouteInput struct
 * @returns estimated total fee for amountOut
 */
export function calculateFee(data: RouterResult): BigNumber {
  return data.amountIn;
}

export function useRouter(
  state: PairMap,
  token0: string,
  token1: string,
  value0: string
): RouterResult {
  return router(state, token0, token1, value0);
}
