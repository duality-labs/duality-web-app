import getContract, { Contract } from '../../../lib/web3/getContract';
import { useWeb3 } from '../../../lib/web3/useWeb3';
import { useState, useEffect } from 'react';
import { PairRequest, PairResult, ErrorMessage } from './index';
import { ethers, utils, BigNumber } from 'ethers';

function sendSwap(
  provider: ethers.providers.Web3Provider,
  { address0, address1, value0 }: PairRequest
): Promise<PairResult> {
  return new Promise(function (resolve, reject) {
    if (!address0 || !address1 || !value0)
      return reject(new Error('Invalid Input'));
    const contract = getContract(Contract.DUALITY_CORE, provider);
    contract
      .connect(provider.getSigner())
      .route({
        amountIn: utils.parseEther(`${value0}`),
        tokens: [address0, address1],
        prices0: [[100]],
        prices1: [[100]],
        fee: [[10000]],
        jitProtectionArr: [[false]],
        useInternalAccounts: false,
        permitData: [],
      })
      .then(function (res?: { gasPrice: BigNumber }) {
        resolve({
          address0: address0 ?? '??',
          address1: address1 ?? '??',
          value0: value0 ?? '??',
          value1: '??',
          rate: '??',
          gas: res?.gasPrice?.toString() ?? '??',
        });
      })
      .catch(function (err: ErrorMessage | Error) {
        reject(err);
      });
  });
}

export function useSwap(request?: PairRequest) {
  const [data, setData] = useState<PairResult>();
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string>();
  const { provider } = useWeb3();

  useEffect(() => {
    if (!request || !provider) return;
    const { address0, address1, value0 } = request;
    if (!address0 || !address1 || !value0) return;
    setValidating(true);
    setError(undefined);
    setData(undefined);
    sendSwap(provider, request)
      .then(function (result: PairResult) {
        setValidating(false);
        setData({
          address0: address0,
          address1: address1,
          value0: value0,
          value1: result.value1,
          rate: result.rate,
          gas: result.gas,
        });
      })
      .catch(function (err: ErrorMessage | Error) {
        setValidating(false);
        setError(err?.message ?? 'Unknown error');
      });
  }, [request, provider]);

  return { data, isValidating: validating, error };
}
