import getContract, { Contract } from '../../../lib/web3/getContract';
import { useWeb3 } from '../../../lib/web3/useWeb3';
import { useState, useEffect, useRef } from 'react';
import { PairRequest, PairResult } from './index';
import { ethers, utils, BigNumber } from 'ethers';

function sendSwap(
  provider: ethers.providers.Web3Provider,
  { token0, token1, value0 }: PairRequest
): Promise<PairResult> {
  return new Promise(function (resolve, reject) {
    if (!token0 || !token1 || !value0)
      return reject(new Error('Invalid Input'));
    const contract = getContract(Contract.DUALITY_CORE, provider);
    contract
      .connect(provider.getSigner())
      .route({
        amountIn: utils.parseEther(`${value0}`),
        tokens: [token0, token1],
        prices0: [[100]],
        prices1: [[100]],
        fee: [[10000]],
        jitProtectionArr: [[false]],
        useInternalAccounts: false,
        permitData: [],
      })
      .then(function (res?: { gasPrice: BigNumber }) {
        if (!res) return reject('No response');
        resolve({
          token0: token0,
          token1: token1,
          value0: value0,
          value1: '??',
          rate: '??',
          gas: res.gasPrice.toString(),
        });
      })
      .catch(function (err: Error) {
        reject(err);
      });
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
  const providerRef = useRef<ethers.providers.Web3Provider>();
  const { provider } = useWeb3();

  useEffect(() => {
    providerRef.current = provider ?? undefined;
  }, [provider]);

  useEffect(() => {
    if (!request) return onError('Missing Tokens and value');
    if (!providerRef.current) return onError('Missing Provider');
    const { token0, token1, value0 } = request;
    if (!token0 || !token1) return onError('Missing token pair');
    if (!value0) return onError('Missing value');
    setValidating(true);
    setError(undefined);
    setData(undefined);
    sendSwap(providerRef.current, request)
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
