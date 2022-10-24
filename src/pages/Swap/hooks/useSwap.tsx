import { useCallback, useState } from 'react';
import { assertIsDeliverTxSuccess, DeliverTxResponse } from '@cosmjs/stargate';
import { OfflineSigner } from '@cosmjs/proto-signing';
import { BigNumber } from 'bignumber.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheckCircle,
  faCircleNotch,
  faGasPump,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';

import { toast } from '../../../components/Notifications';

import { useWeb3 } from '../../../lib/web3/useWeb3';
import { txClient } from '../../../lib/web3/generated/duality/nicholasdotsol.duality.router/module/index';
import {
  MsgSwap,
  MsgSwapResponse,
} from '../../../lib/web3/generated/duality/nicholasdotsol.duality.router/module/types/router/tx';

const { REACT_APP__REST_API } = process.env;

// standard error codes can be found in https://github.com/cosmos/cosmos-sdk/blob/v0.45.4/types/errors/errors.go
// however custom modules may register additional error codes
const REQUEST_SUCCESS = 0;
const ERROR_OUT_OF_GAS = 11;

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

    toast.loading('Loading', {
      id,
      description: 'Executing your trade',
      icon: <FontAwesomeIcon icon={faCircleNotch} spin />,
      duration: Infinity,
      dismissable: true,
    });

    client
      .signAndBroadcast([
        client.msgSwap({ amountIn, tokenIn, tokenOut, minOut, creator }),
      ])
      .then(function (res) {
        if (!res) return reject('No response');

        try {
          assertIsDeliverTxSuccess(res);
        } catch {
          const error: Error & { response?: DeliverTxResponse } = new Error(
            `Tx error: ${res.code}`
          );
          error.response = res;
          throw error;
        }
        const { code, gasUsed, rawLog, transactionHash } = res;
        if (code === REQUEST_SUCCESS) {
          resolve({
            amountIn,
            tokenIn,
            tokenOut,
            minOut,
            creator,
            gas: gasUsed.toString(),
          });

          toast.success('Transaction Successful', {
            id,
            description: 'View more details',
            descriptionLink: `${REACT_APP__REST_API}/cosmos/tx/v1beta1/txs/${transactionHash}`,
            icon: <FontAwesomeIcon icon={faCheckCircle} color="#5bc7b7" />,
            duration: 15e3,
            dismissable: true,
          });
        } else {
          // eslint-disable-next-line
          console.warn(`Failed to send tx (code: ${code}): ${rawLog}`);
          const error: Error & { response?: DeliverTxResponse } = new Error(
            `Tx error: ${code}`
          );
          error.response = res;
          throw error;
        }
      })
      .catch(function (err: Error & { response?: DeliverTxResponse }) {
        if (!err.response && err?.message.includes('rejected')) {
          toast.error('Transaction Rejected', {
            id,
            description: 'You declined the transaction',
            icon: <FontAwesomeIcon icon={faXmark} color="red" />,
            duration: 5e3,
            dismissable: true,
          });
        } else if (err?.response?.code === ERROR_OUT_OF_GAS) {
          const { gasUsed, gasWanted, transactionHash } = err?.response;
          toast.error('Transaction Failed', {
            id,
            description: `Out of gas (used: ${gasUsed.toLocaleString(
              'en-US'
            )} wanted: ${gasWanted.toLocaleString('en-US')})`,
            descriptionLink: `${REACT_APP__REST_API}/cosmos/tx/v1beta1/txs/${transactionHash}`,
            icon: <FontAwesomeIcon icon={faGasPump} color="var(--error)" />,
            duration: Infinity,
            dismissable: true,
          });
        } else {
          const { transactionHash } = err?.response || {};
          toast.error('Transaction Failed', {
            id,
            description: 'Something went wrong, please try again',
            descriptionLink: `${REACT_APP__REST_API}/cosmos/tx/v1beta1/txs/${transactionHash}`,
            icon: '🤔',
            duration: Infinity,
            dismissable: true,
          });
        }
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
