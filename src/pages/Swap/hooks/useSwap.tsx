import { useCallback, useState } from 'react';
import { DeliverTxResponse } from '@cosmjs/stargate';
import { OfflineSigner } from '@cosmjs/proto-signing';
import { BigNumber } from 'bignumber.js';
import invariant from 'invariant';

import { dualitylabs } from '@duality-labs/dualityjs';
import {
  MsgPlaceLimitOrder,
  MsgPlaceLimitOrderResponse,
} from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/dex/tx';

import { formatAmount } from '../../../lib/utils/number';
import { useWeb3 } from '../../../lib/web3/useWeb3';

import { createTransactionToasts } from '../../../components/Notifications/common';

import { addressableTokenMap } from '../../../lib/web3/hooks/useTokens';
import { getAmountInDenom } from '../../../lib/web3/utils/tokens';
import rpcClient from '../../../lib/web3/rpcMsgClient';
import { coerceError } from '../../../lib/utils/error';

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
    maxAmountOut,
    tokenIn,
    tokenOut,
    creator,
    receiver,
  }: MsgPlaceLimitOrder,
  gasEstimate: number
): Promise<MsgPlaceLimitOrderResponse> {
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
  const client = await rpcClient(wallet);
  const request = () => {
    return client.signAndBroadcast(
      address,
      [
        dualitylabs.duality.dex.MessageComposer.withTypeUrl.placeLimitOrder({
          orderType,
          tickIndex,
          amountIn,
          maxAmountOut,
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
    );
  };

  function getMsgPlaceLimitOrderResponse(
    response: DeliverTxResponse | undefined
  ): MsgPlaceLimitOrderResponse {
    const value = response?.msgResponses.at(0)?.value;
    if (value) {
      return dualitylabs.duality.dex.MsgPlaceLimitOrderResponse.decode(value);
    } else {
      throw new Error('Could not read PlaceLimitOrder response');
    }
  }

  const response = await createTransactionToasts(request, {
    onLoadingMessage: 'Executing your trade',
    // find the received amount to put in the success toast
    onSuccess(res) {
      const { takerCoinOut } = getMsgPlaceLimitOrderResponse(res);
      return !isNaN(Number(takerCoinOut.amount)) && takerCoinOut.denom
        ? {
            description: `Received ${formatAmount(
              getAmountInDenom(
                tokenOutToken,
                takerCoinOut.amount,
                takerCoinOut.denom,
                tokenOutToken.display
              ) || '0'
            )} ${tokenOutToken.symbol} (click for more details)`,
          }
        : undefined;
    },
  });
  // get expected response type
  return getMsgPlaceLimitOrderResponse(response);
}

/**
 * Sends a transaction request
 * @param pairRequest the respective addresses and value
 * @returns tuple of request state and sendRequest callback
 */
export function useSwap(): [
  {
    data?: DeliverTxResponse;
    isValidating: boolean;
    error?: string;
  },
  (request: MsgPlaceLimitOrder, gasEstimate: number) => void
] {
  const [data, setData] = useState<DeliverTxResponse>();
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string>();
  const web3 = useWeb3();

  const sendRequest = useCallback(
    async (request: MsgPlaceLimitOrder, gasEstimate: number) => {
      try {
        // asset sync conditions
        invariant(request, 'Missing Tokens and value');
        invariant(web3, 'Missing Provider');
        invariant(web3.wallet && web3.address, 'Client has no wallet');

        // set loading state
        setValidating(true);
        setError(undefined);
        setData(undefined);

        // send request
        const { wallet, address } = web3;
        await sendSwap({ wallet, address }, request, gasEstimate);

        // exit loading state
        setValidating(true);
        setError(undefined);
        setData(undefined);
      } catch (maybeError: unknown) {
        const err = coerceError(maybeError);

        // set error state
        setValidating(false);
        setData(undefined);
        setError(err.message);
      }
    },
    [web3]
  );

  return [{ data, isValidating: validating, error }, sendRequest];
}
