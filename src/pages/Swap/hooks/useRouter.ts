import { useIndexerData, PairMap } from '../../../lib/web3/indexerProvider';
import { useEffect, useState } from 'react';
import { PairRequest, PairResult, RouterResult } from './index';
import { routerAsync, calculateFee, SwapError } from './router';
import { formatAmount } from '../../../lib/utils/number';

import BigNumber from 'bignumber.js';

const cachedRequests: {
  [token0: string]: { [token1: string]: PairResult };
} = {};

async function getRouterResult(
  state: PairMap,
  tokenA: string,
  tokenB: string,
  alteredValue: string,
  reverseSwap: boolean
): Promise<RouterResult> {
  if (reverseSwap) {
    // The router can't calculate the value of the buying token based on the value of the selling token (yet)
    throw new Error('Cannot calculate the reverse value');
  } else {
    return await routerAsync(state, tokenA, tokenB, alteredValue);
  }
}

/**
 * Gets the estimated info of a swap transaction
 * @param pairRequest the respective addresses and value
 * @returns estimated info of swap, loading state and possible error
 */
export function useRouterResult(pairRequest: PairRequest): {
  data?: RouterResult;
  isValidating: boolean;
  error?: SwapError;
} {
  const [data, setData] = useState<RouterResult>();
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<SwapError>();
  const { data: pairs } = useIndexerData();

  useEffect(() => {
    if (
      !pairRequest.tokenA ||
      !pairRequest.tokenB ||
      (!pairRequest.valueA && !pairRequest.valueB) ||
      !pairs
    ) {
      return;
    }
    if (pairRequest.tokenA === pairRequest.tokenB) {
      setData(undefined);
      setError(new Error('The tokens cannot be the same'));
      return;
    }
    if (pairRequest.valueA && pairRequest.valueB) {
      setData(undefined);
      setError(new Error('One value must be falsy'));
      return;
    }
    setIsValidating(true);
    setData(undefined);
    setError(undefined);
    const alteredValue = pairRequest.valueA ?? pairRequest.valueB;
    const reverseSwap = !!pairRequest.valueB;
    if (!alteredValue || alteredValue === '0') {
      setIsValidating(false);
      setData(undefined);
      return;
    }
    let cancelled = false;

    getRouterResult(
      pairs,
      pairRequest.tokenA,
      pairRequest.tokenB,
      alteredValue,
      reverseSwap
    )
      .then(function (result) {
        if (cancelled) return;
        setIsValidating(false);
        setData(result);
      })
      .catch(function (err: SwapError) {
        if (cancelled) return;
        setIsValidating(false);
        setError(err);
        setData(undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [
    pairRequest.tokenA,
    pairRequest.tokenB,
    pairRequest.valueA,
    pairRequest.valueB,
    pairs,
  ]);

  return { data, isValidating, error };
}

/**
 * Gets the estimated info of a swap transaction
 * @param pairRequest the respective addresses and value
 * @param routerResult the results of the router (if they exist)
 * @returns estimated info of swap
 */
export function getRouterEstimates(
  pairRequest: PairRequest,
  routerResult: RouterResult | undefined
): PairResult | undefined {
  const [token0, token1] = [pairRequest.tokenA, pairRequest.tokenB].sort();
  if (token0 && token1) {
    // return estimate from current result
    if (routerResult) {
      const rate = routerResult.amountOut.dividedBy(routerResult.amountIn);
      const extraFee = calculateFee(routerResult);
      const estimate = {
        tokenA: routerResult.tokenIn,
        tokenB: routerResult.tokenOut,
        rate: rate.toFixed(),
        valueA: formatAmount(routerResult.amountIn.toFixed()),
        valueB: formatAmount(routerResult.amountOut.toFixed()),
        gas: extraFee.toFixed(),
      };
      cachedRequests[token0] = cachedRequests[token0] || {};
      cachedRequests[token0][token1] = estimate;
      return estimate;
    }
    // if current result is not available, return cached value rough estimate
    else {
      cachedRequests[token0] = cachedRequests[token0] || {};
      const cachedPairInfo = cachedRequests[token0][token1];

      const alteredValue = pairRequest.valueA ?? pairRequest.valueB;
      const reverseSwap = !!pairRequest.valueB;
      if (
        cachedPairInfo &&
        pairRequest.tokenA &&
        pairRequest.tokenB &&
        alteredValue
      ) {
        const { rate, gas } = cachedPairInfo;
        const convertedRate =
          pairRequest.tokenA === cachedPairInfo.tokenA
            ? new BigNumber(rate)
            : new BigNumber(1).dividedBy(rate);
        const roughEstimate = formatAmount(
          new BigNumber(alteredValue).multipliedBy(convertedRate).toFixed()
        );
        return {
          tokenA: pairRequest.tokenA,
          tokenB: pairRequest.tokenB,
          rate: formatAmount(convertedRate.toFixed()),
          valueA: reverseSwap ? roughEstimate : alteredValue,
          valueB: reverseSwap ? alteredValue : roughEstimate,
          gas,
        };
      }
    }
  }
}

/**
 * Gets the estimated info of a swap transaction
 * @param pairRequest the respective addresses and value
 * @returns estimated info of swap, loading state and possible error
 */
export function useRouterEstimates(pairRequest: PairRequest): {
  data?: PairResult;
  isValidating: boolean;
  error?: SwapError;
} {
  const { data, error, isValidating } = useRouterResult(pairRequest);
  return { data: getRouterEstimates(pairRequest, data), isValidating, error };
}
