import { useCallback, useState } from 'react';
import { DeliverTxResponse } from '@cosmjs/stargate';
import { OfflineSigner, parseCoins } from '@cosmjs/proto-signing';
import { BigNumber } from 'bignumber.js';

import { formatAmount } from '../../../lib/utils/number';
import { useWeb3 } from '../../../lib/web3/useWeb3';

import { createTransactionToasts } from '../../../components/Notifications/common';

import { getDisplayDenomAmount } from '../../../lib/web3/utils/tokens';
import useTokens, {
  matchTokenByAddress,
  useTokensWithIbcInfo,
} from '../../../lib/web3/hooks/useTokens';
import {
  mapEventAttributes,
  CoinReceivedEvent,
} from '../../../lib/web3/utils/events';
import rpcClient from '../../../lib/web3/rpcMsgClient';
import { dualitylabs } from '@duality-labs/dualityjs';
import {
  MsgPlaceLimitOrderResponse,
  MsgPlaceLimitOrder,
} from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/dex/tx';

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
    expirationTime,
    tokenIn,
    tokenOut,
    creator,
    receiver,
  }: MsgPlaceLimitOrder,
  gasEstimate: number
): Promise<DeliverTxResponse> {
  if (
    orderType === undefined ||
    !tickIndex ||
    !amountIn ||
    !tokenIn ||
    !tokenOut ||
    !creator ||
    !receiver
  ) {
    throw new Error('Invalid Input');
  }

  if (!new BigNumber(amountIn).isGreaterThan(0)) {
    throw new Error('Invalid Input (0 value)');
  }

  // send message to chain
  const client = await rpcClient(wallet);
  return client.signAndBroadcast(
    address,
    [
      dualitylabs.duality.dex.MessageComposer.withTypeUrl.placeLimitOrder({
        orderType,
        tickIndex,
        amountIn,
        maxAmountOut,
        expirationTime,
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
}

/**
 * Sends a transaction request
 * @param pairRequest the respective addresses and value
 * @returns tuple of request state and sendRequest callback
 */
export function useSwap(): [
  {
    data?: MsgPlaceLimitOrderResponse;
    isValidating: boolean;
    error?: string;
  },
  (request: MsgPlaceLimitOrder, gasEstimate: number) => void
] {
  const [data, setData] = useState<MsgPlaceLimitOrderResponse>();
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string>();
  const web3 = useWeb3();

  const tokens = useTokensWithIbcInfo(useTokens());

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
        orderType === undefined ||
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
      if (!tokens) return onError('Send not ready: token list not ready');
      // check for not well defined tick index
      const tickNumber = tickIndex.toNumber();
      if (Number.isNaN(tickNumber) || !Number.isFinite(tickNumber)) {
        return onError('Limit Price is not defined');
      }

      const tokenOutToken = tokens.find(matchTokenByAddress(tokenOut));
      if (!tokenOutToken) return onError('Token out was not found');

      createTransactionToasts(
        () => {
          return sendSwap({ wallet, address }, request, gasEstimate);
        },
        {
          onLoadingMessage: 'Executing your trade',
          onSuccess(res) {
            const amountOut = res.events.reduce<BigNumber>((result, event) => {
              if (
                event.type === 'coin_received' &&
                event.attributes.find(
                  ({ key, value }) => key === 'receiver' && value === address
                )
              ) {
                // collect into more usable format for parsing
                const { attributes } =
                  mapEventAttributes<CoinReceivedEvent>(event);
                // parse coin string for matching tokens
                const coin = parseCoins(attributes.amount)[0];
                if (coin?.denom === tokenOut) {
                  return result.plus(coin?.amount || 0);
                }
              }
              return result;
            }, new BigNumber(0));

            const description = amountOut
              ? `Received ${formatAmount(
                  getDisplayDenomAmount(
                    tokenOutToken,
                    amountOut?.toFixed() || '0'
                  ) || '0'
                )} ${tokenOutToken.symbol} (click for more details)`
              : undefined;
            return { description };
          },
        }
      )
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
    [tokens, web3]
  );

  return [{ data, isValidating: validating, error }, sendRequest];
}
