import { useState, useCallback } from 'react';
import { neutron } from '@duality-labs/neutronjs';
import { DeliverTxResponse } from '@cosmjs/stargate';
import { MsgCancelLimitOrder } from '@duality-labs/neutronjs/types/codegen/neutron/dex/tx';

import { useWeb3 } from '../../lib/web3/useWeb3';
import { getDexSigningClient } from '../../lib/web3/clients/signingClients';
import { createMemo } from '../../lib/web3/utils/memo';
import {
  checkMsgErrorToast,
  checkMsgOutOfGasToast,
  checkMsgRejectedToast,
  checkMsgSuccessToast,
  createLoadingToast,
} from '../../components/Notifications/common';

const gasMultiplier = 1.5;

export function useCancelLimitOrder(
  opts: Partial<{
    memo: string;
  }> = {}
): [
  {
    data?: DeliverTxResponse;
    isValidating?: boolean;
    error?: string;
  },
  (msgs: Array<MsgCancelLimitOrder>) => Promise<void>
] {
  const [data, setData] = useState<DeliverTxResponse | undefined>(undefined);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string>();
  const web3 = useWeb3();

  const sendRequest = useCallback(
    async function (cancelLimitOrders: Array<MsgCancelLimitOrder>) {
      try {
        // check for correct inputs
        if (!cancelLimitOrders?.length) {
          throw new Error('Actions not set');
        }
        if (!web3.address || !web3.wallet) {
          throw new Error('Wallet not connected');
        }

        setData(undefined);
        setIsValidating(true);
        setError(undefined);

        const id = `${Date.now()}.${Math.random}`;
        createLoadingToast({ id, description: 'Cancelling Limit Order...' });

        // wrap transaction logic
        try {
          // get msg parts
          const client = await getDexSigningClient(web3.wallet);
          const memo = createMemo(opts.memo);
          const msgs = cancelLimitOrders.map((msg) =>
            neutron.dex.MessageComposer.withTypeUrl.cancelLimitOrder(msg)
          );

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
          if (!checkMsgSuccessToast(res, { id })) {
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
          checkMsgRejectedToast(err, { id }) ||
            checkMsgOutOfGasToast(err, { id }) ||
            checkMsgErrorToast(err, { id });

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
    [opts.memo, web3.address, web3.wallet]
  );

  return [{ data, isValidating, error }, sendRequest];
}
