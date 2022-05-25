import { useWeb3 } from '../../../lib/web3/useWeb3';
import { useState, useEffect } from 'react';
import { PairRequest, PairResult, ErrorMessage } from './index';
import { ethers } from 'ethers';

function sendSwap(
  signer: ethers.providers.JsonRpcSigner,
  { address0, address1, value0 }: PairRequest
): Promise<PairResult> {
  return new Promise(function (resolve, reject) {
    if (!address0 || !address1 || !value0)
      return reject(Error('Invalid Input'));
    reject(Error('Not implemented yet'));
  });
}

export function useSwap(request?: PairRequest) {
  const [data, setData] = useState<PairResult>();
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string>();
  const { provider } = useWeb3();

  useEffect(() => {
    if (
      !request?.address0 ||
      !request?.address1 ||
      !request?.value0 ||
      !provider
    )
      return;
    setValidating(true);
    setError(undefined);
    setData(undefined);
    sendSwap(provider.getSigner(), request)
      .then(function (result?: PairResult) {
        setValidating(false);
        setData({
          address0: request.address0 ?? '??',
          address1: request.address1 ?? '??',
          value0: request.value0 ?? '??',
          value1: result?.value1 ?? '??',
          rate: result?.rate ?? '??',
          gas: result?.gas ?? '??',
        });
      })
      .catch(function (err: ErrorMessage | Error) {
        setValidating(false);
        setError(err?.message ?? 'Unknown error');
      });
  }, [request, provider]);

  return { data, isValidating: validating, error };
}
