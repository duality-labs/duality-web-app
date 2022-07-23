import { useState, useEffect } from 'react';
import { PairRequest, PairResult } from './index';

function sendSwap({
  tokenA,
  tokenB,
  valueA,
}: PairRequest): Promise<PairResult> {
  return new Promise(function (resolve, reject) {
    if (!tokenA || !tokenB || !valueA)
      return reject(new Error('Invalid Input'));
    reject('Not yet implemented');
  });
}

/**
 * Sends a transaction request
 * @param pairRequest the respective addresses and value
 * @returns result of request, loading state and possible error
 */
export function useSwap(request?: PairRequest): {
  data?: PairResult;
  isValidating: boolean;
  error?: string;
} {
  const [data, setData] = useState<PairResult>();
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!request) return onError('Missing Tokens and value');
    const { tokenA, tokenB, valueA } = request;
    if (!tokenA || !tokenB) return onError('Missing token pair');
    if (!valueA) return onError('Missing value');
    setValidating(true);
    setError(undefined);
    setData(undefined);
    sendSwap(request)
      .then(function (result: PairResult) {
        setValidating(false);
        setData({
          tokenA: tokenA,
          tokenB: tokenB,
          valueA: valueA,
          valueB: result.valueB,
          rate: result.rate,
          gas: result.gas,
        });
      })
      .catch(function (err: Error) {
        onError(err?.message ?? 'Unknown error');
      });

    function onError(message?: string) {
      setValidating(false);
      setData(undefined);
      setError(message);
    }
  }, [request]);

  return { data, isValidating: validating, error };
}
