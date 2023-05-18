import { useCallback, useState } from 'react';
import { DeliverTxResponse } from '@cosmjs/stargate';
import { OfflineSigner } from '@cosmjs/proto-signing';
import { BigNumber } from 'bignumber.js';

import { formatAmount } from '../../../lib/utils/number';
import { useWeb3 } from '../../../lib/web3/useWeb3';

import {
  checkMsgErrorToast,
  checkMsgOutOfGasToast,
  checkMsgRejectedToast,
  checkMsgSuccessToast,
  createLoadingToast,
} from '../../../components/Notifications/common';

import { addressableTokenMap } from '../../../lib/web3/hooks/useTokens';
import { getAmountInDenom } from '../../../lib/web3/utils/tokens';
import { readEvents } from '../../../lib/web3/utils/txs';
import rpcClient from '../../../lib/web3/rpcMsgClient';
import { dualitylabs } from '@duality-labs/dualityjs';
import {
  MsgSwapResponseSDKType,
  MsgSwapSDKType,
} from '@duality-labs/dualityjs/types/codegen/duality/dex/tx';

async function sendSwap(
  {
    wallet,
    address,
  }: {
    wallet: OfflineSigner;
    address: string;
  },
  { amountIn, tokenIn, tokenA, tokenB, creator, receiver }: MsgSwapSDKType,
  gasEstimate: number
): Promise<MsgSwapResponseSDKType> {
  if (!amountIn || !amountIn || !tokenIn || !tokenA || !tokenB || !creator) {
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

  // send message to chain

  const id = `${Date.now()}.${Math.random}`;

  createLoadingToast({ id, description: 'Executing your trade' });

  const client = await rpcClient(wallet);
  return client
    .signAndBroadcast(
      address,
      [
        dualitylabs.duality.dex.MessageComposer.withTypeUrl.swap({
          amountIn,
          tokenIn,
          tokenA,
          tokenB,
          creator,
          receiver,
        }),
      ],
      {
        gas: gasEstimate.toFixed(0),
        amount: [{ amount: (gasEstimate * 0.025).toFixed(0), denom: 'token' }],
      }
    )
    .then(function (res): MsgSwapResponseSDKType {
      if (!res) {
        throw new Error('No response');
      }
      const { code } = res;

      const amountOut = readEvents(res.rawLog)
        ?.find(({ type }: { type: string }) => type === 'message')
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
            getAmountInDenom(
              tokenOutToken,
              amountOut?.toFixed() || '0',
              tokenOutToken.address,
              tokenOutToken.display
            ) || '0'
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
              tokenOutToken.address,
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
    data?: MsgSwapResponseSDKType;
    isValidating: boolean;
    error?: string;
  },
  (request: MsgSwapSDKType, gasEstimate: number) => void
] {
  const [data, setData] = useState<MsgSwapResponseSDKType>();
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string>();
  const web3 = useWeb3();

  const sendRequest = useCallback(
    (request: MsgSwapSDKType, gasEstimate: number) => {
      if (!request) return onError('Missing Tokens and value');
      if (!web3) return onError('Missing Provider');
      const { amountIn, tokenIn, tokenA, tokenB, creator, receiver } = request;
      if (!amountIn || !tokenIn || !tokenA || !tokenB || !creator || !receiver)
        return onError('Invalid input');
      setValidating(true);
      setError(undefined);
      setData(undefined);

      const { wallet, address } = web3;
      if (!wallet || !address) return onError('Client has no wallet');

      sendSwap({ wallet, address }, request, gasEstimate)
        .then(function (result: MsgSwapResponseSDKType) {
          setValidating(false);
          setData(result);
        })
        .catch(function (err: Error) {
          onError(err?.message ?? 'Unknown error');
          // pass error to console for developer
          // eslint-disable-next-line no-console
          console.error(err);
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
