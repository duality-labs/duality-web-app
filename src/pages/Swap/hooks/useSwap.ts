import { useEffect, useRef, useState } from 'react';
import { assertIsDeliverTxSuccess, GasPrice } from '@cosmjs/stargate';
import { OfflineSigner } from '@cosmjs/proto-signing';
import { BigNumber } from 'bignumber.js';

import { useWeb3, Web3ContextValue } from '../../../lib/web3/useWeb3';
import { txClient } from '../../../lib/web3/api';
import {
  MsgSwapTicks,
  MsgSwapTicksResponse,
} from '../../../lib/web3/generated/duality/duality.duality/module/types/duality/tx';

// standard error codes can be found in https://github.com/cosmos/cosmos-sdk/blob/v0.45.4/types/errors/errors.go
// however custom modules may register additional error codes
const REQUEST_SUCCESS = 0;

function sendSwap(
  wallet: OfflineSigner,
  { amountIn, tokens, prices0, prices1, fees, creator }: MsgSwapTicks
): Promise<MsgSwapTicksResponse> {
  return new Promise(async function (resolve, reject) {
    if (!amountIn || !tokens || !prices0 || !prices1 || !fees || !creator)
      return reject(new Error('Invalid Input'));

    const totalBigInt = new BigNumber(amountIn);
    if (!totalBigInt.isGreaterThan(0))
      return reject(new Error('Invalid Input (0 value)'));

    const client = await txClient(wallet, {
      // gas price here is the default base price of the client and is
      // overridden by the signAndBroadcast method with value of 'auto'
      // TODO: base price may need to vary with transaction complexity
      //       eg. a certain rate of tokens per ticks used in the route
      gasPrice: GasPrice.fromString('0token'),
    });
    // send message to chain
    client
      .signAndBroadcast([
        client.msgSwapTicks({
          amountIn,
          tokens,
          prices0,
          prices1,
          fees,
          creator,
        }),
      ])
      .then(function (res) {
        if (!res) return reject('No response');
        assertIsDeliverTxSuccess(res);
        const { code, gasUsed, rawLog } = res;
        if (code === REQUEST_SUCCESS) {
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
  const web3 = useWeb3();
  const web3Ref = useRef<Web3ContextValue>(web3);

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

    const { wallet } = web3Ref.current;
    if (!wallet) return onError('Client has no wallet');

    sendSwap(wallet, request)
      .then(function (result: MsgSwapTicksResponse) {
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
  }, [request]);

  return { data, isValidating: validating, error };
}
