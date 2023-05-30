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
import {
  mapEventAttributes,
  CoinReceivedEvent,
} from '../../../lib/web3/utils/events';
import rpcClient from '../../../lib/web3/rpcMsgClient';
import { dualitylabs } from '@duality-labs/dualityjs';
import {
  MsgPlaceLimitOrderResponseSDKType,
  MsgPlaceLimitOrder,
} from '@duality-labs/dualityjs/types/codegen/duality/dex/tx';

async function sendSwap(
  {
    wallet,
    address,
  }: {
    wallet: OfflineSigner;
    address: string;
  },
  {
    orderType,
    tickIndex,
    amountIn,
    tokenIn,
    tokenOut,
    creator,
    receiver,
  }: MsgPlaceLimitOrder,
  gasEstimate: number
): Promise<void> {
  if (!amountIn || !orderType || !tokenIn || !tokenOut || !creator) {
    throw new Error('Invalid Input');
  }

  if (!new BigNumber(amountIn).isGreaterThan(0)) {
    throw new Error('Invalid Input (0 value)');
  }

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
        dualitylabs.duality.dex.MessageComposer.withTypeUrl.placeLimitOrder({
          orderType,
          tickIndex,
          amountIn,
          tokenIn,
          tokenOut,
          creator,
          receiver,
        }),
      ],
      {
        gas: gasEstimate.toFixed(0),
        amount: [{ amount: (gasEstimate * 0.025).toFixed(0), denom: 'token' }],
      }
    )
    .then(function (res): void {
      if (!res) {
        throw new Error('No response');
      }
      const { code } = res;

      const amountOut = res.events.reduce<BigNumber>((result, event) => {
        if (
          event.type === 'coin_received' &&
          event.attributes.find(
            ({ key, value }) => key === 'receiver' && value === address
          )
        ) {
          // collect into more usable format for parsing
          const { attributes } = mapEventAttributes<CoinReceivedEvent>(event);
          // parse coin string for matching tokens
          const [, amount, denom] =
            attributes.amount.match(/^(\d+)(.*)$/) || [];
          if (denom === tokenOut) {
            return result.plus(amount);
          }
        }
        return result;
      }, new BigNumber(0));

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
    data?: MsgPlaceLimitOrderResponseSDKType;
    isValidating: boolean;
    error?: string;
  },
  (request: MsgPlaceLimitOrder, gasEstimate: number) => void
] {
  const [data, setData] = useState<MsgPlaceLimitOrderResponseSDKType>();
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string>();
  const web3 = useWeb3();

  const sendRequest = useCallback(
    (request: MsgPlaceLimitOrder, gasEstimate: number) => {
      if (!request) return onError('Missing Tokens and value');
      if (!web3) return onError('Missing Provider');
      const {
        orderType,
        tickIndex,
        amountIn,
        tokenIn,
        tokenOut,
        creator,
        receiver,
      } = request;
      if (
        !orderType ||
        !tickIndex ||
        !amountIn ||
        !tokenIn ||
        !tokenOut ||
        !creator ||
        !receiver
      )
        return onError('Invalid input');
      setValidating(true);
      setError(undefined);
      setData(undefined);

      const { wallet, address } = web3;
      if (!wallet || !address) return onError('Client has no wallet');

      sendSwap({ wallet, address }, request, gasEstimate)
        .then(function () {
          setValidating(false);
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
