import { useIndexerData, PairMap } from '../../../lib/web3/indexerProvider';
import { useCallback, useEffect, useState } from 'react';
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
  valueA: string
): Promise<PairResult> {
  const result = await routerAsync(state, tokenA, tokenB, valueA);
  const valueB = calculateOut(result);
  const rate = result.amountIn.dividedBy(valueB);
  const extraFee = calculateFee(result);
  return {
    tokenA,
    tokenB,
    rate: rate.toString(),
    valueA,
    valueB: valueB.toString(),
    gas: extraFee.toString(),
  };
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

  const setSwappedResult = useCallback(
    (result: PairResult, originalTokenA: string) => {
      if (result.tokenA === originalTokenA) return setData(result);
      const { tokenA, tokenB, valueA, valueB } = result;
      setData({
        ...result,
        tokenA: tokenA,
        tokenB: tokenB,
        valueA: valueA,
        valueB: valueB,
      });
    },
    []
  );

  useEffect(() => {
    if (
      !pairRequest.tokenA ||
      !pairRequest.tokenB ||
      !pairRequest.valueA ||
      !pairs
    )
      return;
    setIsValidating(true);
    setData(undefined);
    setError(undefined);
    if (pairRequest.valueA === '0') {
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
    const originalToken0 = pairRequest.tokenA;
    let cancelled = false;
    cachedRequests[token0] = cachedRequests[token0] || {};
    const cachedPairInfo = cachedRequests[token0][token1];
    if (cachedPairInfo) {
      if (originalToken0 === cachedPairInfo.tokenA) {
        const tempValue1 = new BigNumber(pairRequest.valueA).multipliedBy(
          cachedPairInfo.rate
        );
        setSwappedResult(
          { ...cachedPairInfo, valueA: tempValue1.toString() },
          originalToken0
        );
      } else {
        const tempValue1 = new BigNumber(pairRequest.valueA).dividedBy(
          cachedPairInfo.rate
        );
        setSwappedResult(
          { ...cachedPairInfo, valueA: tempValue1.toString() },
          originalToken0
        );
      }
    }

    fetchEstimates(
      pairs,
      pairRequest.tokenA,
      pairRequest.tokenB,
      pairRequest.valueA
    )
      .then(function (result) {
        if (cancelled) return;
        cachedRequests[token0][token1] = result;
        setIsValidating(false);
        setSwappedResult(result, originalToken0);
      })
      .catch(function (err: Error) {
        if (cancelled) return;
        setIsValidating(false);
        setError(err?.message ?? 'Unknown error');
      });

    return () => {
      cancelled = true;
    };
  }, [
    pairRequest.tokenA,
    pairRequest.tokenB,
    pairRequest.valueA,
    setSwappedResult,
    pairs,
  ]);

  return { data, isValidating, error };
}
