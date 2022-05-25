import { useCallback, useEffect, useState } from 'react';
import { PairRequest, PairResult } from './index';

const cachedRequests: {
  [address0: string]: { [address1: string]: PairResult };
} = {};

function fetchEstimates({
  address0,
  address1,
  value0,
}: PairRequest): Promise<PairResult> {
  return new Promise(function (resolve, reject) {
    if (!address0 || !address1 || !value0)
      return reject(Error('Invalid Input'));
    reject(Error('Not implemented yet'));
  });
}

/**
 * Gets the estimated info of a swap transaction
 * @param {PairRequest} pairRequest the respective addresses and value
 * @returns {{ result?: PairResult, isValidating: boolean, error: string }} estimated info of swap, loading state and possible error
 */
export function useIndexer(pairRequest: PairRequest) {
  const [result, setResult] = useState<PairResult>();
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string>();

  const setSwappedResult = useCallback(
    (result: PairResult, originalAddress0: string) => {
      if (result.address0 === originalAddress0) return setResult(result);
      const { address0, address1, value0, value1 } = result;
      setResult({
        ...result,
        address0: address1,
        address1: address0,
        value0: value1,
        value1: value0,
      });
    },
    []
  );

  useEffect(() => {
    if (!pairRequest.address0 || !pairRequest.address1 || !pairRequest.value0)
      return;
    setIsValidating(true);
    setResult(undefined);
    setError(undefined);
    const [address0, address1] = [
      pairRequest.address0,
      pairRequest.address1,
    ].sort();
    const originalAddress0 = pairRequest.address0;
    let cancelled = false;
    cachedRequests[address0] = cachedRequests[address0] || {};
    const cachedPairInfo = cachedRequests[address0][address1];
    if (cachedPairInfo) {
      if (originalAddress0 === cachedPairInfo.address0) {
        const tempValue1 =
          Number(pairRequest.value0) * Number(cachedPairInfo.rate);
        setSwappedResult(
          { ...cachedPairInfo, value1: `${tempValue1}` },
          originalAddress0
        );
      } else {
        const tempValue1 =
          Number(pairRequest.value0) / Number(cachedPairInfo.rate);
        setSwappedResult(
          { ...cachedPairInfo, value0: `${tempValue1}` },
          originalAddress0
        );
      }
    }

    fetchEstimates({
      address0: pairRequest.address0,
      address1: pairRequest.address1,
      value0: pairRequest.value0,
    })
      .then(function (result) {
        if (cancelled) return;
        cachedRequests[address0][address1] = result;
        setIsValidating(false);
        setSwappedResult(result, originalAddress0);
      })
      .catch(function (err) {
        if (cancelled) return;
        setIsValidating(false);
        setError(err);
      });

    return () => {
      cancelled = true;
    };
  }, [
    pairRequest.address0,
    pairRequest.address1,
    pairRequest.value0,
    setSwappedResult,
  ]);

  return { result, isValidating, error };
}
