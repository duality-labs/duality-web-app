import { useEffect, useRef, useState } from 'react';
import {
  assertIsDeliverTxSuccess,
  SigningStargateClient,
  StdFee,
} from '@cosmjs/stargate';
import { BigNumber } from 'bignumber.js';

import { currency, useWeb3, Web3ContextValue } from '../../../lib/web3/useWeb3';
import {
  MsgSwapTicks,
  MsgSwapTicksResponse,
} from '../../../lib/web3/generated/duality/duality.duality/module/types/duality/tx';

function sendSwap(
  client: SigningStargateClient,
  fromAddress: string,
  { amountIn, tokens, prices0, prices1, fees, creator }: MsgSwapTicks
): Promise<MsgSwapTicksResponse> {
  return new Promise(async function (resolve, reject) {
    if (!amountIn || !tokens || !prices0 || !prices1 || !fees || !creator)
      return reject(new Error('Invalid Input'));

    const totalBigInt = new BigNumber(amountIn);
    if (!totalBigInt.isGreaterThan(0))
      return reject(new Error('Invalid Input (0 value)'));

    // TODO: calculate fees from router ticks
    const feeBigNum = new BigNumber('0x0').dividedBy(10000);
    const message = {
      typeUrl: '/duality.duality.MsgSwapTicks',
      value: MsgSwapTicks.fromPartial({
        amountIn,
        tokens,
        prices0,
        prices1,
        fees,
        creator,
      }),
    };
    const tokenFee: StdFee = {
      amount: [
        {
          denom: currency.coinMinimalDenom,
          amount: totalBigInt
            .multipliedBy(feeBigNum)
            .integerValue(BigNumber.ROUND_UP)
            .toString(),
        },
      ],
      gas: totalBigInt
        .multipliedBy(0.001)
        .integerValue(BigNumber.ROUND_UP)
        .toString(),
    };

    // send message to chain
    client
      .signAndBroadcast(fromAddress, [message], tokenFee)
      .then(function (res) {
        if (!res) return reject('No response');
        assertIsDeliverTxSuccess(res);
        const { code, gasUsed, rawLog } = res;

        if (code === 0) {
          resolve({
            amountIn,
            tokens,
            prices0,
            prices1,
            fees,
            creator,
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
export function useSwap(request?: MsgSwapTicks): {
  data?: MsgSwapTicksResponse;
  isValidating: boolean;
  error?: string;
} {
  const [data, setData] = useState<MsgSwapTicksResponse>();
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
    const { amountIn, tokens, prices0, prices1, fees, creator } = request;
    if (!amountIn || !tokens || !prices0 || !prices1 || !fees || !creator)
      return onError('Invalid input');
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
        .then(function (result: MsgSwapTicksResponse) {
          setValidating(false);
          setData(result);
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
