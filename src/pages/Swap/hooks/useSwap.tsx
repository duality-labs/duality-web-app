import { useCallback, useState } from 'react';
import { DeliverTxResponse } from '@cosmjs/stargate';
import { OfflineSigner, parseCoins } from '@cosmjs/proto-signing';
import { BigNumber } from 'bignumber.js';
import invariant from 'invariant';

import { dualitylabs } from '@duality-labs/dualityjs';
import { MsgPlaceLimitOrder } from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/dex/tx';

import { formatAmount } from '../../../lib/utils/number';
import { useWeb3 } from '../../../lib/web3/useWeb3';

import { createTransactionToasts } from '../../../components/Notifications/common';

import { addressableTokenMap } from '../../../lib/web3/hooks/useTokens';
import { getAmountInDenom } from '../../../lib/web3/utils/tokens';
import {
  mapEventAttributes,
  CoinReceivedEvent,
} from '../../../lib/web3/utils/events';
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
): Promise<DeliverTxResponse | undefined> {
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
  const response = await createTransactionToasts(request, {
    onLoadingMessage: 'Executing your trade',
    // find the received amount to put in the success toast
    onSuccess(res) {
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
          const coin = parseCoins(attributes.amount)[0];
          if (coin?.denom === tokenOut) {
            return result.plus(coin?.amount || 0);
          }
        }
        return result;
      }, new BigNumber(0));

      return amountOut
        ? {
            description: `Received ${formatAmount(
              getAmountInDenom(
                tokenOutToken,
                amountOut?.toFixed() || '0',
                tokenOutToken.address,
                tokenOutToken.display
              ) || '0'
            )} ${tokenOutToken.symbol} (click for more details)`,
          }
        : undefined;
    },
  });
  return response;
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
