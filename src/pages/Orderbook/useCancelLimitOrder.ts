import { useCallback } from 'react';
import { neutron } from '@duality-labs/neutronjs';
import { MsgCancelLimitOrder } from '@duality-labs/neutronjs/types/codegen/neutron/dex/tx';

import { ToastDescriptions, useMsgs } from '../../lib/web3/hooks/useMsgs';

export const defaultToasts: ToastDescriptions = {
  loading: { description: 'Cancelling Limit Order...' },
};

export function useCancelLimitOrder(
  opts: Parameters<typeof useMsgs>['0'] = {}
): [
  ReturnType<typeof useMsgs>['0'],
  (cancelLimitOrders: Array<MsgCancelLimitOrder>) => Promise<void>
] {
  const [state, sendRequest] = useMsgs({ toasts: defaultToasts, ...opts });

  const sendCancelLimitOrders = useCallback(
    (cancelLimitOrders: Array<MsgCancelLimitOrder>) => {
      const msgs = cancelLimitOrders.map((msg) =>
        neutron.dex.MessageComposer.withTypeUrl.cancelLimitOrder(msg)
      );
      return sendRequest(msgs);
    },
    [sendRequest]
  );

  return [state, sendCancelLimitOrders];
}
