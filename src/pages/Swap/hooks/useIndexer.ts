import getContract, { Contract } from '../../../lib/web3/getContract';
import { useWeb3 } from '../../../lib/web3/useWeb3';
import { useCallback, useEffect, useState } from 'react';
import { PairRequest, PairResult } from './index';
import { utils, BigNumber } from 'ethers';
import data from './data.json';

const cachedRequests: {
  [token0: string]: { [token1: string]: PairResult };
} = {};

const pairMap = data.reduce<{ [pairID: string]: typeof data[0] }>(function (
  result,
  pairInfo
) {
  const list = [pairInfo.token0, pairInfo.token1].sort();
  const pairID = utils.solidityKeccak256(['address[2]'], [list]);
  result[pairID] = pairInfo;
  return result;
},
{});

function useEvents() {
  const { provider } = useWeb3();
  const contract = provider
    ? getContract(Contract.DUALITY_CORE, provider)
    : null;
  useEffect(() => {
    contract?.on(
      'Swap0to1',
      function (
        pairID: string,
        [price0, price1]: Array<BigNumber>,
        amount: BigNumber
      ) {
        const pair = pairMap[pairID];
        if (!pair) return;
        pair.ticks[0].reserves0 -= Number(amount.toBigInt());
        pair.ticks[0].reserves1 += Number(
          (amount.toBigInt() * price0.toBigInt()) / price1.toBigInt()
        );
      }
    );
    contract?.on(
      'Swap1to0',
      function (pairID, [price0, price1]: Array<BigNumber>, amount: BigNumber) {
        const pair = pairMap[pairID];
        if (!pair) return;
        pair.ticks[0].reserves0 += Number(
          (amount.toBigInt() * price1.toBigInt()) / price0.toBigInt()
        );
        pair.ticks[0].reserves1 -= Number(amount.toBigInt());
      }
    );

    return () => {
      contract?.removeAllListeners();
    };
  }, [contract]);
}

function fetchEstimates({
  token0,
  token1,
  value0,
}: PairRequest): Promise<PairResult> {
  const averageDelay = 1e3,
    delayDiff = 0.5e3;
  return new Promise(function (resolve, reject) {
    if (!token0 || !token1 || !value0)
      return reject(new Error('Invalid Input'));

    setTimeout(function () {
      const sortedList = [token0, token1].sort();
      const pairInfo = data.find(
        (pairInfo) =>
          pairInfo.token0 === sortedList[0] && pairInfo.token1 === sortedList[1]
      );
      if (!pairInfo) return reject(new Error('Insufficient data'));
      const totalReserves = pairInfo.ticks.reduce(
        function (total, tick) {
          total.value0 += tick.reserves0;
          total.value1 += tick.reserves1;
          return total;
        },
        { value0: 0, value1: 0 }
      );
      const rate =
        token0 === sortedList[0]
          ? (totalReserves.value1 - Number(value0)) / totalReserves.value0
          : (totalReserves.value0 - Number(value0)) / totalReserves.value1;
      const safeRate = Math.max(rate, 0);
      const value1 = (Number(value0) * safeRate).toLocaleString('en-US', {
        maximumSignificantDigits: 6,
        useGrouping: false,
      });

      resolve({
        token0,
        token1,
        rate: `${safeRate}`,
        value0,
        value1,
        gas: '5',
      });
    }, Math.random() * delayDiff * 2 + (averageDelay - delayDiff));
  });
}

/**
 * Gets the estimated info of a swap transaction
 * @param pairRequest the respective addresses and value
 * @returns estimated info of swap, loading state and possible error
 */
export function useIndexer(pairRequest: PairRequest): {
  result?: PairResult;
  isValidating: boolean;
  error?: string;
} {
  const [result, setResult] = useState<PairResult>();
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string>();
  useEvents();

  const setSwappedResult = useCallback(
    (result: PairResult, originalToken0: string) => {
      if (result.token0 === originalToken0) return setResult(result);
      const { token0, token1, value0, value1 } = result;
      setResult({
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
    if (!pairRequest.token0 || !pairRequest.token1 || !pairRequest.value0)
      return;
    setIsValidating(true);
    setResult(undefined);
    setError(undefined);
    const [token0, token1] = [pairRequest.token0, pairRequest.token1].sort();
    const originalToken0 = pairRequest.token0;
    let cancelled = false;
    cachedRequests[token0] = cachedRequests[token0] || {};
    const cachedPairInfo = cachedRequests[token0][token1];
    if (cachedPairInfo) {
      if (originalToken0 === cachedPairInfo.token0) {
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

    fetchEstimates({
      token0: pairRequest.token0,
      token1: pairRequest.token1,
      value0: pairRequest.value0,
    })
      .then(function (result) {
        if (cancelled) return;
        cachedRequests[token0][token1] = result;
        setIsValidating(false);
        setSwappedResult(result, originalToken0);
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
    pairRequest.token0,
    pairRequest.token1,
    pairRequest.value0,
    setSwappedResult,
  ]);

  return { result, isValidating, error };
}
