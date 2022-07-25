import { useIndexerData, PairMap } from '../../../lib/web3/indexerProvider';
import { useEffect, useState } from 'react';
import { PairRequest, PairResult } from './index';
import { routerAsync, calculateOut, calculateFee } from './useRouter';
import BigNumber from 'bignumber.js';

const cachedRequests: {
  [token0: string]: { [token1: string]: PairResult };
} = {};

async function fetchEstimates(
  state: PairMap,
  tokenA: string,
  tokenB: string,
  alteredValue: string,
  reverseSwap: boolean
): Promise<PairResult> {
  if (reverseSwap) {
    // The router can't calculate the value of the buying token based on the value of the selling token (yet)
    throw new Error('Cannot calculate the reverse value');
  } else {
    const result = await routerAsync(state, tokenA, tokenB, alteredValue);
    const valueB = calculateOut(result);
    const rate = result.amountIn.dividedBy(valueB);
    const extraFee = calculateFee(result);
    return {
      tokenA,
      tokenB,
      rate: rate.toString(),
      valueA: alteredValue,
      valueB: valueB.toString(),
      gas: extraFee.toString(),
    };
  }
}

/**
 * Gets the estimated info of a swap transaction
 * @param pairRequest the respective addresses and value
 * @returns estimated info of swap, loading state and possible error
 */
export function useIndexer(pairRequest: PairRequest): {
  data?: PairResult;
  isValidating: boolean;
  error?: string;
} {
  const [data, setData] = useState<PairResult>();
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string>();
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
      setError('The tokens cannot be the same');
      return;
    }
    if (pairRequest.valueA && pairRequest.valueB) {
      setData(undefined);
      setError('One value must be falsy');
      return;
    }
    setIsValidating(true);
    setData(undefined);
    setError(undefined);
    const alteredValue = pairRequest.valueA ?? pairRequest.valueB;
    const reverseSwap = !!pairRequest.valueB;
    if (!alteredValue || alteredValue === '0') {
      setIsValidating(false);
      setData({
        valueA: '0',
        valueB: '0',
        rate: '0',
        gas: '0',
        tokenA: pairRequest.tokenA,
        tokenB: pairRequest.tokenB,
      });
      return;
    }
    const [token0, token1] = [pairRequest.tokenA, pairRequest.tokenB].sort();
    let cancelled = false;
    cachedRequests[token0] = cachedRequests[token0] || {};
    const cachedPairInfo = cachedRequests[token0][token1];
    if (cachedPairInfo) {
      const { rate, gas } = cachedPairInfo;
      const convertedRate =
        pairRequest.tokenA === cachedPairInfo.tokenA
          ? new BigNumber(rate)
          : new BigNumber(1).dividedBy(rate);
      const roughEstimate = new BigNumber(alteredValue)
        .multipliedBy(convertedRate)
        .toString();
      setData({
        tokenA: pairRequest.tokenA,
        tokenB: pairRequest.tokenB,
        rate: convertedRate.toString(),
        valueA: reverseSwap ? roughEstimate : alteredValue,
        valueB: reverseSwap ? alteredValue : roughEstimate,
        gas,
      });
    }

    fetchEstimates(
      pairs,
      pairRequest.tokenA,
      pairRequest.tokenB,
      alteredValue,
      reverseSwap
    )
      .then(function (result) {
        if (cancelled) return;
        cachedRequests[token0][token1] = result;
        setIsValidating(false);
        setData(result);
      })
      .catch(function (err: Error) {
        if (cancelled) return;
        setIsValidating(false);
        setError(err?.message ?? 'Unknown error');
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
