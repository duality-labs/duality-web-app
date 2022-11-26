import { useCallback, useState } from 'react';
import { DeliverTxResponse } from '@cosmjs/stargate';
import { OfflineSigner } from '@cosmjs/proto-signing';
import { BigNumber } from 'bignumber.js';

import { formatAmount } from '../../../lib/utils/number';
import { useWeb3 } from '../../../lib/web3/useWeb3';
import { txClient } from '../../../lib/web3/generated/duality/nicholasdotsol.duality.dex/module/index';

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
} from '../../../lib/web3/generated/duality/nicholasdotsol.duality.dex/module/types/dex/tx';
import { addressableTokenMap } from '../../../components/TokenPicker/hooks';
import { getAmountInDenom } from '../../../lib/web3/utils/tokens';

async function sendSwap(
  wallet: OfflineSigner,
  { amountIn, tokenIn, tokenA, tokenB, minOut, creator, receiver }: MsgSwap
): Promise<MsgSwapResponse> {
  if (
    !amountIn ||
    !amountIn ||
    !tokenIn ||
    !tokenA ||
    !tokenB ||
    !minOut ||
    !creator ||
    !creator
  ) {
    throw new Error('Invalid Input');
  }

  const totalBigInt = new BigNumber(amountIn);
  if (!totalBigInt.isGreaterThan(0)) {
    throw new Error('Invalid Input (0 value)');
  }

  const tokenOut = tokenIn === tokenA ? tokenB : tokenA;
  const tokenOutToken = addressableTokenMap[tokenOut];
  if (!tokenOutToken) {
    throw new Error('Invalid Output (token address not found)');
  }

  const client = await txClient(wallet);
  // send message to chain

  const id = `${Date.now()}.${Math.random}`;

  createLoadingToast({ id, description: 'Executing your trade' });

  return client
    .signAndBroadcast([
      client.msgSwap({
        amountIn,
        tokenIn,
        tokenA,
        tokenB,
        minOut,
        creator,
        receiver,
      }),
    ])
    .then(function (res): MsgSwapResponse {
      if (!res) {
        throw new Error('No response');
      }
      const { code } = res;

      const amountOut = JSON.parse(res.rawLog || '[]')?.[0]
        ?.events?.find(({ type }: { type: string }) => type === 'message')
        ?.attributes?.reduceRight(
          (
            result: BigNumber,
            { key, value }: { key: string; value: string }
          ) => {
            if (result.isZero() && key === 'AmountOut') {
              return result.plus(value);
            }
            return result;
          },
          new BigNumber(0)
        ) as BigNumber | undefined;
      const description = amountOut
        ? `Received ${formatAmount(
            amountOut.toFixed()
          )} ${tokenOut} (click for more details)`
        : undefined;

      if (!checkMsgSuccessToast(res, { id, description })) {
        const error: Error & { response?: DeliverTxResponse } = new Error(
          `Tx error: ${code}`
        );
        error.response = res;
        throw error;
      }
      return {
        coinOut: {
          amount:
            getAmountInDenom(
              tokenOutToken,
              amountOut?.toFixed() || '0',
              tokenOutToken.display
            ) || '0',
          denom: tokenOutToken.display,
        },
      };
    })
    .catch(function (err: Error & { response?: DeliverTxResponse }) {
      // catch transaction errors
      // chain toast checks so only one toast may be shown
      checkMsgRejectedToast(err, { id }) ||
        checkMsgOutOfGasToast(err, { id }) ||
        checkMsgErrorToast(err, { id });

      // rethrow error
      throw err;
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
      const { amountIn, tokenIn, tokenA, tokenB, minOut, creator, receiver } =
        request;
      if (
        !amountIn ||
        !tokenIn ||
        !tokenA ||
        !tokenB ||
        !minOut ||
        !creator ||
        !receiver
      )
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
