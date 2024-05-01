import { useEffect, useRef } from 'react';
import { DexEvent, mapEventAttributes } from '../utils/events';
import { useWeb3 } from '../useWeb3';
import { MessageActionEvent, TendermintTxData } from '../events';
import { useDeepCompareMemoize } from 'use-deep-compare-effect';
import subscriber from '../subscriptionManager';

export default function useOnUserDexMsg<T extends DexEvent>(
  actionOrActions: T['attributes']['action'] | Array<T['attributes']['action']>,
  callback: (tx: TendermintTxData, dexEvent: T) => void
) {
  const { address } = useWeb3();

  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const actions = useDeepCompareMemoize(
    Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions]
  );

  // subscribe to updates to the user's limit orders
  useEffect(() => {
    if (address) {
      const onUserDexMsg = (
        _event: MessageActionEvent,
        tx: TendermintTxData
      ) => {
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
      subscriber.subscribeMessage(onUserDexMsg, {
        message: { module: 'dex', Creator: address },
      });
      return () => {
        subscriber.unsubscribeMessage(onUserDexMsg);
      };
    }
  }, [callback, address, actions]);
}
