import { useEffect, useRef, useState } from 'react';
import {
  assertIsDeliverTxSuccess,
  SigningStargateClient,
} from '@cosmjs/stargate';

import { currency, useWeb3, Web3ContextValue } from '../../../lib/web3/useWeb3';
import { PairRequest, PairResult } from './index';

function sendSwap(
  client: SigningStargateClient,
  fromAddress: string,
  { token0, token1, value0 }: PairRequest
): Promise<PairResult> {
  return new Promise(async function (resolve, reject) {
    if (!token0 || !token1 || !value0)
      return reject(new Error('Invalid Input'));

    const value0Int = parseInt(value0);
    if (!value0Int) return reject(new Error('Invalid Input (0 value)'));

    // TODO: calculate fees from router ticks
    const fee = '0x0';
    client
      .signAndBroadcast(
        fromAddress,
        [
          {
            typeUrl: '/duality.custom.MsgSwap',
            value: {
              token0,
              token1,
              value0,
            },
          },
        ],
        {
          amount: [
            {
              denom: currency.coinMinimalDenom,
              amount: `${Math.ceil((parseInt(fee) / 10000) * value0Int)}`,
            },
          ],
          gas: `${Math.ceil(0.001 * value0Int)}`,
        }
      )
      .then(function (res) {
        if (!res) return reject('No response');
        assertIsDeliverTxSuccess(res);
        const { code, gasUsed, rawLog } = res;

        if (code === 0) {
          resolve({
            token0: token0,
            token1: token1,
            value0: value0,
            value1: '??',
            rate: '??',
            gas: gasUsed.toString(),
          });
        } else {
          // eslint-disable-next-line
          console.warn(`Failed to send tx (code: ${code}): ${rawLog}`);
          return reject(new Error(`Tx error: ${code}`));
        }
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
  const web3Ref = useRef<Web3ContextValue>();
  const web3 = useWeb3();

  useEffect(() => {
    web3Ref.current = web3 ?? undefined;
  }, [web3]);

  useEffect(() => {
    if (!request) return onError('Missing Tokens and value');
    if (!web3Ref.current) return onError('Missing Provider');
    const { token0, token1, value0 } = request;
    if (!token0 || !token1) return onError('Missing token pair');
    if (!value0) return onError('Missing value');
    setValidating(true);
    setError(undefined);
    setData(undefined);

    (async () => {
      if (!web3Ref.current) return onError('Missing Provider');
      const address = web3Ref.current.address;
      if (!address) return onError('Client has no address');
      const client = await web3Ref.current.getSigningClient?.();
      if (!client) return onError('Client not signed');

      sendSwap(client, address, request)
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
    })();

    function onError(message?: string) {
      setValidating(false);
      setData(undefined);
      setError(message);
    }
  }, [request]);

  return { data, isValidating: validating, error };
}
