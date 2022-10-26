import { useCallback, useState } from 'react';
import { assertIsDeliverTxSuccess, DeliverTxResponse } from '@cosmjs/stargate';
import { OfflineSigner } from '@cosmjs/proto-signing';
import { BigNumber } from 'bignumber.js';

import { useWeb3 } from '../../../lib/web3/useWeb3';
import { txClient } from '../../../lib/web3/generated/duality/nicholasdotsol.duality.router/module/index';

import {
  checkMsgErrorToast,
  checkMsgOutOfGasToast,
  checkMsgRejectedToast,
  checkMsgSuccessToast,
  createLoadingToast,
} from '../../../components/Notifications/common';

import {
  MsgSwap,
  MsgSwapResponse,
} from '../../../lib/web3/generated/duality/nicholasdotsol.duality.router/module/types/router/tx';

function sendSwap(
  wallet: OfflineSigner,
  { amountIn, tokenIn, tokenOut, minOut, creator }: MsgSwap
): Promise<MsgSwapResponse> {
  return new Promise(async function (resolve, reject) {
    if (
      !amountIn ||
      !amountIn ||
      !tokenIn ||
      !tokenOut ||
      !minOut ||
      !creator ||
      !creator
    )
      return reject(new Error('Invalid Input'));

    const totalBigInt = new BigNumber(amountIn);
    if (!totalBigInt.isGreaterThan(0))
      return reject(new Error('Invalid Input (0 value)'));

    const client = await txClient(wallet);
    // send message to chain

    const id = `${Date.now()}.${Math.random}`;

    createLoadingToast({ id, description: 'Executing your trade' });

    client
      .signAndBroadcast([
        client.msgSwap({ amountIn, tokenIn, tokenOut, minOut, creator }),
      ])
      .then(function (res) {
        if (!res) return reject('No response');
        const { code, gasUsed } = res;

        try {
          assertIsDeliverTxSuccess(res);
          checkMsgSuccessToast(res, { id });
        } catch {
          const error: Error & { response?: DeliverTxResponse } = new Error(
            `Tx error: ${code}`
          );
          error.response = res;
          throw error;
        }
        resolve({
          amountIn,
          tokenIn,
          tokenOut,
          minOut,
          creator,
          gas: gasUsed.toString(),
        });
      })
      .catch(function (err: Error & { response?: DeliverTxResponse }) {
        // catch transaction errors
        // chain toast checks so only one toast may be shown
        checkMsgRejectedToast(err, { id }) ||
          checkMsgOutOfGasToast(err, { id }) ||
          checkMsgErrorToast(err, { id });

        reject(err);
      });
  });
}

/**
 * Sends a transaction request
 * @param pairRequest the respective addresses and value
 * @returns tuple of request state and sendRequest callback
 */
export function useSwap(): [
  {
    data?: MsgSwapResponse;
    isValidating: boolean;
    error?: string;
  },
  (request: MsgSwap) => void
] {
  const [data, setData] = useState<MsgSwapResponse>();
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string>();
  const web3 = useWeb3();

  const sendRequest = useCallback(
    (request: MsgSwap) => {
      if (!request) return onError('Missing Tokens and value');
      if (!web3) return onError('Missing Provider');
      const { amountIn, tokenIn, tokenOut, minOut, creator } = request;
      if (!amountIn || !tokenIn || !tokenOut || !minOut || !creator)
        return onError('Invalid input');
      setValidating(true);
      setError(undefined);
      setData(undefined);

      const { wallet } = web3;
      if (!wallet) return onError('Client has no wallet');

      sendSwap(wallet, request)
        .then(function (result: MsgSwapResponse) {
          setValidating(false);
          setData(result);
        })
        .catch(function (err: Error) {
          onError(err?.message ?? 'Unknown error');
        });

      function onError(message?: string) {
        setValidating(false);
        setData(undefined);
        setError(message);
      }
    },
    [web3]
  );

  return [{ data, isValidating: validating, error }, sendRequest];
}
