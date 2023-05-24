import { useEffect, useState } from 'react';
import { PairRequest, PairResult, RouterResult } from './index';
import { routerAsync, calculateFee, SwapError } from './router';
import { formatAmount } from '../../../lib/utils/number';

import BigNumber from 'bignumber.js';
import { getAmountInDenom } from '../../../lib/web3/utils/tokens';
import { addressableTokenMap } from '../../../lib/web3/hooks/useTokens';

import { useTokenPairTickLiquidity } from '../../../lib/web3/hooks/useTickLiquidity';
import { useOrderedTokenPair } from '../../../lib/web3/hooks/useTokenPairs';
import { TickInfo } from '../../../lib/web3/utils/ticks';
import { getPairID } from '../../../lib/web3/utils/pairs';

const cachedRequests: {
  [token0: string]: { [token1: string]: PairResult };
} = {};

async function getRouterResult(
  alteredValue: string,
  tokenA: string,
  tokenB: string,
  token0: string,
  token0Ticks: TickInfo[] = [],
  token1Ticks: TickInfo[] = [],
  reverseSwap: boolean
): Promise<RouterResult> {
  if (reverseSwap) {
    // The router can't calculate the value of the buying token based on the value of the selling token (yet)
    throw new Error('Cannot calculate the reverse value');
  } else {
    return await routerAsync(
      alteredValue,
      tokenA,
      tokenB,
      token0,
      token0Ticks,
      token1Ticks
    );
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

  const [token0, token1] =
    useOrderedTokenPair([pairRequest.tokenA, pairRequest.tokenB]) || [];

  const pairId = token0 && token1 ? getPairID(token0, token1) : null;
  const {
    data: [token0Ticks, token1Ticks],
  } = useTokenPairTickLiquidity([token0, token1]);

  useEffect(() => {
    if (
      !pairRequest.tokenA ||
      !pairRequest.tokenB ||
      (!pairRequest.valueA && !pairRequest.valueB) ||
      !token0 ||
      !token1 ||
      !pairId
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
    const tokenA = addressableTokenMap[pairRequest.tokenA];
    const tokenB = addressableTokenMap[pairRequest.tokenB];
    // convert token request down into base denom
    const alteredValue = getAmountInDenom(
      tokenA,
      pairRequest.valueA || 0,
      tokenA.display
    );
    const reverseSwap = !!pairRequest.valueB;
    if (!alteredValue || alteredValue === '0') {
      setIsValidating(false);
      setData(undefined);
      return;
    }
    let cancelled = false;

    // this could be useRouterResult for much better usage
    // replacing the above useEffect with probably a useMemo
    getRouterResult(
      alteredValue,
      pairRequest.tokenA,
      pairRequest.tokenB,
      token0,
      token0Ticks,
      token1Ticks,
      reverseSwap
    )
      .then(function (result) {
        if (cancelled) return;
        setIsValidating(false);
        // convert token result back into display denom
        setData({
          ...result,
          amountIn: new BigNumber(pairRequest.valueA || 0),
          amountOut: new BigNumber(
            getAmountInDenom(
              tokenB,
              result.amountOut.decimalPlaces(0, BigNumber.ROUND_DOWN),
              tokenB.address,
              tokenB.display
            ) || 0
          ),
        });
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
    pairId,
    token0,
    token1,
    token0Ticks,
    token1Ticks,
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
  // note: this sorting on the frontend may differ from the sorting on the backend
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
