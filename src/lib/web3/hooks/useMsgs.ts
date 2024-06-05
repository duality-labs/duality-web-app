import { useState, useCallback } from 'react';
import { DeliverTxResponse } from '@cosmjs/stargate';
import { EncodeObject } from '@cosmjs/proto-signing';

import { useWeb3 } from '../useWeb3';
import { getDexSigningClient } from '../clients/signingClients';
import { createMemo } from '../utils/memo';
import {
  ToastOptions,
  checkMsgErrorToast,
  checkMsgOutOfGasToast,
  checkMsgRejectedToast,
  checkMsgSuccessToast,
  createLoadingToast,
} from '../../../components/Notifications/common';
import logger from '../../utils/logger';

const defaultGasMultiplier = 1.5;

export interface ToastDescriptions {
  loading?: ToastOptions;
  success?: ToastOptions;
  rejected?: ToastOptions;
  outOfGas?: ToastOptions;
  error?: ToastOptions;
}

export function useMsgs({
  gasMultiplier = defaultGasMultiplier,
  ...opts
}: Partial<{
  toasts: ToastDescriptions;
  memo: string;
  gasMultiplier: number;
}> = {}): [
  {
    data?: DeliverTxResponse;
    isValidating?: boolean;
    error?: string;
  },
  (msgs: Array<EncodeObject>) => Promise<void>
] {
  const [data, setData] = useState<DeliverTxResponse | undefined>(undefined);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string>();
  const web3 = useWeb3();

  const sendRequest = useCallback(
    async function (msgs: Array<EncodeObject>) {
      try {
        // check for correct inputs
        if (!msgs?.length) {
          throw new Error('Actions not set');
        }
        if (!web3.address || !web3.wallet) {
          throw new Error('Wallet not connected');
        }

        setData(undefined);
        setIsValidating(true);
        setError(undefined);

        const id = `${Date.now()}.${Math.random}`;
        createLoadingToast({ id, ...opts.toasts?.loading });

        logger?.info('Client msgs', msgs);

        // wrap transaction logic
        try {
          // get msg parts
          const client = await getDexSigningClient(web3.wallet);
          const memo = createMemo(opts.memo);

          // estimate gas
          const gasEstimate = await client.simulate(web3.address, msgs, memo);
          // make request
          const res = await client.signAndBroadcast(
            web3.address,
            msgs,
            {
              gas: (gasEstimate * gasMultiplier).toFixed(0),
              amount: [],
            },
            memo
          );

          // check for response
          if (!res) {
            throw new Error('No response');
          }
          const { code } = res;

          // check for response errors
          if (!checkMsgSuccessToast(res, { id, ...opts.toasts?.success })) {
            const error: Error & { response?: DeliverTxResponse } = new Error(
              `Tx error: ${code}`
            );
            error.response = res;
            throw error;
          }

          // set new information
          setData(res);
          setIsValidating(false);
        } catch (e) {
          // catch transaction errors
          const err = e as Error & { response?: DeliverTxResponse };
          // chain toast checks so only one toast may be shown
          checkMsgRejectedToast(err, { id, ...opts.toasts?.rejected }) ||
            checkMsgOutOfGasToast(err, { id, ...opts.toasts?.outOfGas }) ||
            checkMsgErrorToast(err, { id, ...opts.toasts?.error });

          // rethrow transaction errors
          throw e;
        }
      } catch (e) {
        setIsValidating(false);
        setError((e as Error)?.message || (e as string));
        // pass error to console for developer
        // eslint-disable-next-line no-console
        console.error(e as Error);
      }
    },
    [gasMultiplier, opts.memo, opts.toasts, web3.address, web3.wallet]
  );

  return [{ data, isValidating, error }, sendRequest];
}
