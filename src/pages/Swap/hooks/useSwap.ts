import { useState, useEffect } from 'react';
import { PairRequest, PairResult } from './index';

function sendSwap({
  token0,
  token1,
  value0,
}: PairRequest): Promise<PairResult> {
  return new Promise(function (resolve, reject) {
    if (!token0 || !token1 || !value0)
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
    const { token0, token1, value0 } = request;
    if (!token0 || !token1) return onError('Missing token pair');
    if (!value0) return onError('Missing value');
    setValidating(true);
    setError(undefined);
    setData(undefined);
    sendSwap(request)
      .then(function (result: PairResult) {
        setValidating(false);
        setData({
          token0: token0,
          token1: token1,
          value0: value0,
          value1: result.value1,
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
