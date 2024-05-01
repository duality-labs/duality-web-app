import { useCallback } from 'react';
import { neutron } from '@duality-labs/neutronjs';
import { MsgWithdrawFilledLimitOrder } from '@duality-labs/neutronjs/types/codegen/neutron/dex/tx';

import { ToastDescriptions, useMsgs } from '../../lib/web3/hooks/useMsgs';

export const defaultToasts: ToastDescriptions = {
  loading: { description: 'Withdrawing Limit Order...' },
};

export function useWithdrawFilledLimitOrder(
  opts: Partial<{
    memo: string;
    gasMultiplier: number;
  }> = {}
): [
  ReturnType<typeof useMsgs>['0'],
  (withdrawLimitOrders: Array<MsgWithdrawFilledLimitOrder>) => Promise<void>
] {
  const [state, sendRequest] = useMsgs({ toasts: defaultToasts, ...opts });

  const sendCancelLimitOrders = useCallback(
    (withdrawLimitOrders: Array<MsgWithdrawFilledLimitOrder>) => {
      const msgs = withdrawLimitOrders.map((msg) =>
        neutron.dex.MessageComposer.withTypeUrl.withdrawFilledLimitOrder(msg)
      );
      return sendRequest(msgs);
    },
    [sendRequest]
  );

  return [state, sendCancelLimitOrders];
}
