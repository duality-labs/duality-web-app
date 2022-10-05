import { useCallback, useState } from 'react';
import { assertIsDeliverTxSuccess } from '@cosmjs/stargate';
import { OfflineSigner } from '@cosmjs/proto-signing';
import { BigNumber } from 'bignumber.js';
import { useToast, CreateToastFnReturn } from '@chakra-ui/toast';
import { Link, Spinner, Text } from '@chakra-ui/react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faXmark } from '@fortawesome/free-solid-svg-icons';

import Toast from '../../../components/Toast';

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

function sendSwap(
  wallet: OfflineSigner,
  { amountIn, tokenIn, tokenOut, minOut, creator }: MsgSwap,
  toast: CreateToastFnReturn
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
    client
      .signAndBroadcast([
        client.msgSwap({ amountIn, tokenIn, tokenOut, minOut, creator }),
      ])
      .then(function (res) {
        if (!res) return reject('No response');

        toast({
          render: ({ id }) => (
            <Toast
              id={id}
              icon={<Spinner size="lg" speed="1s" />}
              title="Loading"
              description="Executing your trade"
              close={toast.close}
            />
          ),
          status: 'info',
          isClosable: true,
        });

        assertIsDeliverTxSuccess(res);
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

          toast({
            render: ({ id }) => (
              <Toast
                id={id}
                icon={
                  <FontAwesomeIcon
                    icon={faCheckCircle}
                    color="#5bc7b7"
                    size="2x"
                  />
                }
                title="Transaction Successful"
                description={
                  <Link
                    href={`${REACT_APP__REST_API}/cosmos/tx/v1beta1/txs/${transactionHash}`}
                    target="_blank"
                  >
                    View more details
                  </Link>
                }
                close={toast.close}
              />
            ),
            status: 'success',
            duration: 15000,
            isClosable: true,
          });
        } else {
          // eslint-disable-next-line
          console.warn(`Failed to send tx (code: ${code}): ${rawLog}`);
          return reject(new Error(`Tx error: ${code}`));
        }
      })
      .catch(function (err: Error) {
        if (err?.message.includes('rejected')) {
          toast({
            render: ({ id }) => (
              <Toast
                id={id}
                icon={<FontAwesomeIcon icon={faXmark} color="red" size="2x" />}
                title="Transaction Rejected"
                description="You declined the transaction"
                close={toast.close}
              />
            ),
            status: 'info',
            isClosable: true,
          });
        } else {
          toast({
            render: ({ id }) => (
              <Toast
                id={id}
                icon={<Text fontSize="4xl">🤔</Text>}
                title="Transaction Failed"
                description="Something went wrong, please try again"
                close={toast.close}
              />
            ),
            status: 'error',
            duration: null,
            isClosable: true,
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

  const toast = useToast({ position: 'top-right' });

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

      sendSwap(wallet, request, toast)
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
    [web3, toast]
  );

  return [{ data, isValidating: validating, error }, sendRequest];
}
