import { useEffect, useRef } from 'react';
import { DexEvent, mapEventAttributes } from '../utils/events';
import { useWeb3 } from '../useWeb3';
import { MessageActionEvent, TendermintTxData } from '../events';
import { useDeepCompareMemoize } from 'use-deep-compare-effect';
import subscriber from '../subscriptionManager';

export default function useOnDexMsg<T extends DexEvent>(
  actionOrActions: T['attributes']['action'] | Array<T['attributes']['action']>,
  callback: (tx: TendermintTxData, dexEvent: T) => void,
  filterMessages?: Partial<T['attributes']> | null | undefined
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const actions = useDeepCompareMemoize(
    Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions]
  );

  const memoizedfilterMessages = useDeepCompareMemoize(filterMessages);

  // subscribe to updates to the user's limit orders
  useEffect(() => {
    // allow memoizedfilterMessages === null to cancel effect
    if (memoizedfilterMessages !== null) {
      const onDexMsg = (_event: MessageActionEvent, tx: TendermintTxData) => {
        const events = tx.value.TxResult.result.events.map(mapEventAttributes);
        const dexEvent = events.find(
          (event): event is T =>
            event.type === 'message' &&
            actions.includes(event.attributes.action)
        );

        if (dexEvent) {
          // send update to callback
          callbackRef.current(tx, dexEvent);
        }
      };
      // subscribe to all the user's dex messages
      subscriber.subscribeMessage(onDexMsg, {
        message: { module: 'dex', ...memoizedfilterMessages },
      });
      return () => {
        subscriber.unsubscribeMessage(onDexMsg);
      };
    }
  }, [callback, memoizedfilterMessages, actions]);
}

export function useOnUserDexMsg<T extends DexEvent>(
  actionOrActions: T['attributes']['action'] | Array<T['attributes']['action']>,
  callback: (tx: TendermintTxData, dexEvent: T) => void
) {
  const { address } = useWeb3();
  const filterToUserMsgs: Partial<DexEvent['attributes']> | null = address
    ? { Creator: address }
    : null;
  return useOnDexMsg<T>(actionOrActions, callback, filterToUserMsgs);
}
