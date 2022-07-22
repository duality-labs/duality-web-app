import { useIndexerData, PairMap } from '../../../lib/web3/indexerProvider';
import { useCallback, useEffect, useState } from 'react';
import { PairRequest, PairResult } from './index';
import { routerAsync, calculateOut, calculateFee } from './useRouter';

const cachedRequests: {
  [token0: string]: { [token1: string]: PairResult };
} = {};

function fetchEstimates(
  state: PairMap,
  token0: string,
  token1: string,
  value0: string
): Promise<PairResult> {
  return new Promise(function (resolve, reject) {
    routerAsync(state, token0, token1, value0)
      .then(function (res) {
        const value1 = calculateOut(res);
        // TODO multiply by 10k for better accuracy
        const rate = res.amountIn.dividedBy(value1);
        const extraFee = calculateFee(res);
        resolve({
          token0,
          token1,
          rate: rate.toString(),
          value0,
          value1: value1.toString(),
          gas: extraFee.toString(),
        });
      })
      .catch(reject);
  });
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
  const { pairs } = useIndexerData();

  const setSwappedResult = useCallback(
    (result: PairResult, originalToken0: string) => {
      if (result.token0 === originalToken0) return setData(result);
      const { token0, token1, value0, value1 } = result;
      setData({
        ...result,
        token0: token1,
        token1: token0,
        value0: value1,
        value1: value0,
      });
    },
    []
  );

  useEffect(() => {
    if (
      !pairRequest.token0 ||
      !pairRequest.token1 ||
      !pairRequest.value0 ||
      !pairs
    )
      return;
    setIsValidating(true);
    setData(undefined);
    setError(undefined);
    if (pairRequest.value0 === '0') {
      setIsValidating(false);
      setData({
        value0: '0',
        value1: '0',
        rate: '0',
        gas: '0',
        token0: pairRequest.token0,
        token1: pairRequest.token1,
      });
      return;
    }
    const [token0, token1] = [pairRequest.token0, pairRequest.token1].sort();
    const originalToken0 = pairRequest.token0;
    let cancelled = false;
    cachedRequests[token0] = cachedRequests[token0] || {};
    const cachedPairInfo = cachedRequests[token0][token1];
    if (cachedPairInfo) {
      if (originalToken0 === cachedPairInfo.token0) {
        // TODO use bignumber
        const tempValue1 =
          Number(pairRequest.value0) * Number(cachedPairInfo.rate);
        setSwappedResult(
          { ...cachedPairInfo, value1: `${tempValue1}` },
          originalToken0
        );
      } else {
        const tempValue1 =
          Number(pairRequest.value0) / Number(cachedPairInfo.rate);
        setSwappedResult(
          { ...cachedPairInfo, value0: `${tempValue1}` },
          originalToken0
        );
      }
    }

    fetchEstimates(
      pairs,
      pairRequest.token0,
      pairRequest.token1,
      pairRequest.value0
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
    pairRequest.token0,
    pairRequest.token1,
    pairRequest.value0,
    setSwappedResult,
    pairs,
  ]);

  return { data, isValidating, error };
}
