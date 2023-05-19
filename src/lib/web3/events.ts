import { Buffer } from 'buffer';

enum QueryStatus {
  Disconnecting,
  Disconnected,
  Connecting,
  Connected,
}

export interface ParamQueryMap {
  block?: {
    height?: string;
  };
  coin_received?: {
    amount?: string;
    receiver?: string;
  };
  coin_spent?: {
    amount?: string;
    spender?: string;
  };
  message?: {
    [key: string]: string;
  };
  tm?: {
    event?: EventType;
  };
  transfer?: {
    amount?: string;
    recipient?: string;
    sender?: string;
  };
  tx?: {
    fee?: string;
    hash?: string;
    height?: string;
    signature?: string;
  };
}

export interface TendermintEvent {
  'message.action': Array<string>;
  'tm.event': Array<string>;
  'tx.acc_seq': Array<string>;
  'tx.fee': Array<string>;
  'tx.hash': Array<string>;
  'tx.height': Array<string>;
  'tx.signature': Array<string>;
  [key: string]: Array<string>;
}

export interface MessageActionEvent {
  [key: string]: string | undefined;
  action?: string;
  module?: string;
}

export interface GenericTendermintData {
  type: string;
  value: object;
}

export interface TendermintTxData {
  type: 'tendermint/event/Tx';
  value: {
    TxResult: {
      height: string;
      result: {
        data: string; // base64 encoded Msg path
        events: Array<{
          // does this really contain an index?
          attributes: Array<{
            index: boolean; // attribute is indexed
            key: string; // base64 encoded attribute key
            value: string; // base64 encoded attribute value
          }>;
          type: 'tx' | 'message';
        }>;
        gas_used: string;
        gas_wanted: string;
        log: string; // JSON stringified log of events
      };
      tx: string;
    };
  };
}

export type TendermintDataType = TendermintTxData | GenericTendermintData;

export type MessageListener = (
  data: TendermintDataType,
  event: TendermintEvent,
  originalEvent: MessageEvent,
  transactionEvents?: Array<MessageActionEvent>
) => void;

interface CallBackWrapper {
  genericListener?: MessageListener;
  messageListener?: (event: MessageActionEvent) => void;
  // to compare with the action of each event and filter out those that don't match
  paramQueryMap?: ParamQueryMap;
}

export interface WebSocketClientMessage {
  jsonrpc: '2.0';
  id: number;
  method: MessageType;
  params?: Array<string>;
}

export interface WebSocketServerMessage {
  id: number;
  // an empty result object with an ID means
  // that a successful subscription on that ID has been established
  result: {
    query: string; // subscribed query string eg. "tm.event='Tx' AND message.action='Deposit'"
    data?: TendermintDataType;
    events?: TendermintEvent;
  };
  error?: {
    code: number;
    data: string;
    message: string;
  };
}

type MessageType = 'subscribe' | 'unsubscribe';

type SocketEventMap = Omit<WebSocketEventMap, 'message'>;

/**
 * @see https://github.com/tendermint/tendermint/blob/master/types/events.go
 */
export enum EventType {
  EventNewBlockValue = 'NewBlock',
  EventNewBlockHeaderValue = 'NewBlockHeader',
  EventNewEvidenceValue = 'NewEvidence',
  EventTxValue = 'Tx', // most used
  EventValidatorSetUpdatesValue = 'ValidatorSetUpdates',
  EventCompleteProposalValue = 'CompleteProposal',
  EventBlockSyncStatusValue = 'BlockSyncStatus',
  EventLockValue = 'Lock',
  EventNewRoundValue = 'NewRound',
  EventNewRoundStepValue = 'NewRoundStep',
  EventPolkaValue = 'Polka',
  EventRelockValue = 'Relock',
  EventStateSyncStatusValue = 'StateSyncStatus',
  EventTimeoutProposeValue = 'TimeoutPropose',
  EventTimeoutWaitValue = 'TimeoutWait',
  EventUnlockValue = 'Unlock',
  EventValidBlockValue = 'ValidBlock',
  EventVoteValue = 'Vote',
}

export interface SubscriptionManager {
  /**
   * Adds an event listener that only listens to message actions
   * @param onMessage the function listening for the event
   * @param paramQueryMap ParamQueryMap
   * @param eventType the event type listening to (when/how the event will get emitted)
   */
  readonly subscribeMessage: (
    onMessage: (event: MessageActionEvent) => void,
    paramQueryMap: ParamQueryMap,
    eventType?: EventType
  ) => void;

  /**
   * Removes an event listener that only listens to message actions
   * @param onMessage the function listening for the event
   * @param paramQueryMap ParamQueryMap
   * @param eventType the event type listening to (when/how the event will get emitted)
   */
  readonly unsubscribeMessage: (
    onMessage?: (event: MessageActionEvent) => void,
    paramQueryMap?: ParamQueryMap,
    eventType?: EventType
  ) => void;

  /**
   * Adds an event listener
   * @param onMessage the function listening for the event
   * @param paramQueryMap the subscription query as an object
   * @param eventType the event type listening to (when/how the event will get emitted)
   */
  readonly subscribe: (
    onMessage: MessageListener,
    paramQueryMap: ParamQueryMap,
    eventType?: EventType | '*'
  ) => void;

  /**
   * Removes the specified listener
   * @param onMessage the function listening for the event,
   * if no other arguments are supplied then all instances of the function will be removed
   * if this is not defined then all of the listeners for the relevant query will be removed
   * @param paramQueryMap the subscription query as an object
   * @param eventType the event type listening to (when/how the event will get emitted)
   */
  readonly unsubscribe: (
    onMessage?: MessageListener,
    paramQueryMap?: ParamQueryMap,
    eventType?: EventType
  ) => void;

  /**
   * Removes all of the listeners (doesn't close the socket)
   */
  readonly unsubscribeAll: () => void;

  /**
   * Opens the socket (needs to be called to start receiving)
   */
  readonly open: () => void;

  /**
   * Closes the socket and clears any listeners (can be reopened)
   */
  readonly close: () => void;

  /**
   * Use this setter to add an event listener for when the socket gets connected
   */
  onopen: (ev: Event) => void;

  /**
   * Use this setter to add an event listener for when there is an error with the socket
   */
  onerror: (ev: Event) => void;

  /**
   * Use this setter to add an event listener for when the socket gets closed
   */
  onclose: (ev: Event) => void;

  /**
   * Adds an event listener for socket events (interchangeable with the event setters)
   * @param event name of event
   * @param cb callback
   */
  readonly addSocketListener: <EventType extends keyof SocketEventMap>(
    event: EventType,
    cb: (ev: SocketEventMap[EventType]) => void
  ) => void;

  /**
   * Removes the last istance of an event listener for socket events (regardles of how it was added)
   * @param event name of event
   * @param cb callback
   */
  readonly removeSocketListener: <EventType extends keyof SocketEventMap>(
    event: EventType,
    cb: (ev: SocketEventMap[EventType]) => void
  ) => void;

  /**
   * Checks if the current socket exists and is open
   * @returns true if it's open
   */
  readonly isOpen: () => boolean;
}

const startingReconnectInterval = 2e3,
  maxReconnectInterval = 2 * 60e3;

const unsubDebounceInterval = 1e3;

export function createSubscriptionManager(url: string): SubscriptionManager {
  let socket: WebSocket | null = null;
  const listeners: {
    [query: string]: {
      callBacks: Array<CallBackWrapper>;
      status: QueryStatus;
      idUnsub: number;
      id: number;
    };
  } = {};
  let idListenerMap: {
    [id: number]: typeof listeners[keyof typeof listeners] | null;
  } = {};
  const socketListeners: {
    [EventType in keyof SocketEventMap]: Array<
      (ev: SocketEventMap[EventType]) => void
    >;
  } = {
    open: [],
    close: [],
    error: [],
  };
  let reconnectInterval = startingReconnectInterval;
  let lastAbortTimeout = -1;

  const manager = {
    open,
    close,
    subscribe,
    unsubscribe,
    unsubscribeAll,
    addSocketListener,
    removeSocketListener,
    isOpen,
    subscribeMessage,
    unsubscribeMessage,
  } as SubscriptionManager;
  Object.defineProperty(manager, 'onopen', {
    set: function (value) {
      if (typeof value !== 'function') throw new Error('Invalid open listener');
      socketListeners.open.push(value);
    },
  });
  Object.defineProperty(manager, 'onerror', {
    set: function (value) {
      if (typeof value !== 'function')
        throw new Error('Invalid error listener');
      socketListeners.error.push(value);
    },
  });
  Object.defineProperty(manager, 'onclose', {
    set: function (value) {
      if (typeof value !== 'function')
        throw new Error('Invalid close listener');
      socketListeners.close.push(value);
    },
  });

  return manager;

  function addSocketListener<EventType extends keyof SocketEventMap>(
    event: EventType,
    cb: (ev: SocketEventMap[EventType]) => void
  ) {
    const list = socketListeners[event];
    if (!list) throw Error('Invalid listener type');
    list.push(cb);
  }

  function removeSocketListener<EventType extends keyof SocketEventMap>(
    event: EventType,
    cb: (ev: SocketEventMap[EventType]) => void
  ) {
    const list = socketListeners[event];
    if (!list) throw Error('Invalid listener type');
    const index = list.lastIndexOf(cb);
    if (index !== -1) list.splice(index, 1);
  }

  function open() {
    if (isOpen()) throw new Error('Socket is already open');
    const currentSocket = new WebSocket(url);
    socket = currentSocket;
    socket.addEventListener('open', function (event) {
      reconnectInterval = startingReconnectInterval;
      if (currentSocket !== socket) return; // socket has been altered
      currentSocket.addEventListener('message', bubbleOnMessage);
      Object.entries(listeners).forEach(([paramQuery, group]) => {
        // refresh ids after a new connection
        idListenerMap[group.idUnsub] = null;
        idListenerMap[group.id] = null;
        group.id = createID();
        group.idUnsub = createID();
        idListenerMap[group.idUnsub] = group;
        idListenerMap[group.id] = group;
        // send pending requests
        if (
          group.status === QueryStatus.Disconnected &&
          group.callBacks.length
        ) {
          sendMessage('subscribe', paramQuery, group.id);
          group.status = QueryStatus.Connecting;
        }
      });
      socketListeners.open.forEach(function (cb) {
        try {
          cb(event);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Failed to execute open listener:');
          // eslint-disable-next-line no-console
          console.error(err);
        }
      });
    });
    currentSocket.addEventListener('error', function (ev) {
      if (currentSocket !== socket) return; // socket has been altered
      socketListeners.error.forEach(function (cb) {
        try {
          cb(ev);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Failed to execute error listener:');
          // eslint-disable-next-line no-console
          console.error(err);
        }
      });
    });
    currentSocket.addEventListener('close', function (event) {
      if (currentSocket !== socket) return; // socket has been altered
      // disable all listeners (without removing) after a close
      Object.values(listeners).forEach(
        (group) => (group.status = QueryStatus.Disconnected)
      );
      if (!event.wasClean) {
        socket = null;
        setTimeout(open, reconnectInterval);
        reconnectInterval = Math.min(
          maxReconnectInterval,
          reconnectInterval * 2
        );
      }
      socketListeners.close.forEach(function (cb) {
        try {
          cb(event);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Failed to execute close listener:');
          // eslint-disable-next-line no-console
          console.error(err);
        }
      });
    });
  }

  function close() {
    unsubscribeAll();
    if (isOpen()) socket?.close();
    idListenerMap = {};
  }

  function subscribeMessage(
    onMessage: (event: MessageActionEvent) => void,
    paramQueryMap: ParamQueryMap = {},
    // default to a Tx message type
    eventType: EventType = EventType.EventTxValue
  ) {
    abstractSubscribe(
      { messageListener: onMessage, paramQueryMap },
      getParamQuery(paramQueryMap, eventType)
    );
  }

  function unsubscribeMessage(
    onMessage?: (event: MessageActionEvent) => void,
    paramQueryMap?: ParamQueryMap,
    eventType: EventType = EventType.EventTxValue
  ) {
    abstractUnsubscribe(
      { messageListener: onMessage },
      getParamQuery(paramQueryMap, onMessage && paramQueryMap && eventType)
    );
  }

  function subscribe(
    onMessage: MessageListener,
    paramQueryMap: ParamQueryMap,
    eventType?: EventType
  ) {
    abstractSubscribe(
      { genericListener: onMessage },
      getParamQuery(paramQueryMap, eventType)
    );
  }

  function abstractSubscribe(onMessage: CallBackWrapper, paramQuery: string) {
    const listenerGroup = listeners[paramQuery] || {
      status: QueryStatus.Disconnected,
      idUnsub: createID(),
      callBacks: [],
      id: createID(),
    };
    // If disconnected, set back to disconnected and erase old disconnecting traces
    if (listenerGroup.status === QueryStatus.Disconnecting) {
      listenerGroup.status = QueryStatus.Disconnected;
      idListenerMap[listenerGroup.idUnsub] = null;
      listenerGroup.idUnsub = createID();
    }
    listeners[paramQuery] = listenerGroup;
    idListenerMap[listenerGroup.id] = listenerGroup;
    idListenerMap[listenerGroup.idUnsub] = listenerGroup;
    listenerGroup.callBacks.push(onMessage);
    if (isOpen() && listenerGroup.status === QueryStatus.Disconnected) {
      sendMessage('subscribe', paramQuery, listenerGroup.id);
      listenerGroup.status = QueryStatus.Connecting;
    } else if (!socket) {
      open();
    }
    debounceUnsub();
  }

  function unsubscribe(
    onMessage?: MessageListener,
    paramQueryMap?: ParamQueryMap,
    eventType?: EventType
  ) {
    abstractUnsubscribe(
      { genericListener: onMessage },
      getParamQuery(paramQueryMap, eventType)
    );
  }

  function abstractUnsubscribe(
    onMessage: CallBackWrapper | undefined,
    paramQuery?: string
  ) {
    const isGeneric = !paramQuery;
    const listenerGroups = isGeneric ? Object.keys(listeners) : [paramQuery];
    listenerGroups.forEach(function (query) {
      const group = listeners[query];
      if (!group) return;
      group.callBacks =
        onMessage?.genericListener || onMessage?.messageListener
          ? group.callBacks.filter((cb) => !isSameWrapper(cb, onMessage))
          : [];
    });
    debounceUnsub();
  }

  function unsubscribeAll() {
    abstractUnsubscribe(undefined);
  }

  function getParamQuery(
    paramQueryMap: ParamQueryMap = {},
    eventType?: EventType
  ): string {
    return (
      Object.entries(
        eventType
          ? // insert event type if given
            {
              ...paramQueryMap,
              tm: {
                ...paramQueryMap.tm,
                event: eventType,
              },
            }
          : paramQueryMap
      )
        // convert map-of-map to map.map notation
        .flatMap(([section, sectionMap]) => {
          return Object.entries(sectionMap).map(([attr, value]) => {
            return [`${section}.${attr}`, value];
          });
        })
        .map(([key, value]) => (value ? `${key}='${value}'` : null))
        .filter(Boolean)
        .join(' AND ')
    );
  }

  function debounceUnsub() {
    clearTimeout(lastAbortTimeout);
    const emptyListeners = Object.entries(listeners).filter(
      ([, group]) =>
        !group.callBacks.length && group.status === QueryStatus.Disconnected
    );
    if (emptyListeners.length && isOpen()) {
      lastAbortTimeout = setTimeout(
        function removeList() {
          if (!isOpen()) return;
          emptyListeners.forEach(function ([paramQuery, group]) {
            sendMessage('unsubscribe', paramQuery, group.idUnsub);
            group.status = QueryStatus.Disconnecting;
          });
        } as TimerHandler,
        unsubDebounceInterval
      );
    }
  }

  function sendMessage(method: MessageType, paramQuery: string, id: number) {
    if (!isOpen()) {
      throw new Error('Socket connection is not open');
    }
    const message: WebSocketClientMessage = {
      jsonrpc: '2.0',
      method: method,
      params: paramQuery ? [paramQuery] : undefined,
      id: id,
    };
    socket?.send(JSON.stringify(message));
  }

  function isOpen() {
    return socket?.readyState === WebSocket.OPEN;
  }

  /**
   * Calls the respective callback functions when a message is received
   * @param event the event emitted by tendermint
   */

  function bubbleOnMessage(event: MessageEvent<string>) {
    const { error, id, result } = JSON.parse(
      event.data
    ) as WebSocketServerMessage;
    if (id === 1) {
      Object.values(listeners).forEach(function (cb) {
        if (cb.status === QueryStatus.Disconnecting)
          cb.status = QueryStatus.Disconnected;
      });
      idListenerMap = {};
      return;
    }
    const listenerGroup = idListenerMap[id];
    if (!listenerGroup) {
      // eslint-disable-next-line no-console
      console.warn(`Received unregistered id ${id}`);
      return;
    }
    if (error) {
      // eslint-disable-next-line no-console
      console.error('Received error from server');
      // eslint-disable-next-line no-console
      console.error(error);
      return;
    }
    const data = result.data as TendermintTxData,
      events = result.events as TendermintEvent;
    // set status after the original handshake
    if (!data || !events) {
      listenerGroup.status =
        listenerGroup.idUnsub === id
          ? QueryStatus.Disconnected
          : QueryStatus.Connected;
      return;
    }
    if (data.type === 'tendermint/event/Tx') {
      const events = data.value?.TxResult?.result?.events;
      events?.forEach(function (originalEvent) {
        const event = originalEvent.attributes.reduce<{
          [key: string]: string;
        }>(function (result, { key, value }) {
          const keyParts = [
            originalEvent.type,
            Buffer.from(key, 'base64').toString(),
          ];
          result[keyParts.join('.')] = Buffer.from(value, 'base64').toString();
          return result;
        }, {});
        listenerGroup.callBacks.forEach(function (wrapper) {
          if (
            wrapper.messageListener &&
            Object.entries(wrapper.paramQueryMap || {}).every(
              ([section, sectionMap]) => {
                // match all message pieces
                return Object.entries(sectionMap).every(([attr, value]) => {
                  return event[`${section}.${attr}`] === value;
                });
              }
            )
          )
            wrapper.messageListener(event);
        });
      });
    }
    listenerGroup.callBacks.forEach(function (wrapper) {
      if (wrapper.genericListener) wrapper.genericListener(data, events, event);
    });
  }
}

// 1 reserved for unsub all
let idCounter = 2;

function createID() {
  return (idCounter = idCounter < Number.MAX_SAFE_INTEGER ? idCounter + 1 : 2);
}

function isSameWrapper(wrapper: CallBackWrapper, other: CallBackWrapper) {
  if (
    wrapper.genericListener === other.genericListener &&
    wrapper.genericListener
  )
    return true;
  if (
    wrapper.messageListener === other.messageListener &&
    wrapper.messageListener
  )
    return true;
  return false;
}
