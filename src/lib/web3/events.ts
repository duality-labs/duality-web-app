import { Buffer } from 'buffer';

enum QueryStatus {
  Disconnecting,
  Disconnected,
  Connecting,
  Connected,
}

interface SubscriptionOptions {
  /**
   * messageAction the name of the event/message
   */
  messageAction?: string;
  /**
   * hashKey hash key of transaction
   */
  hashKey?: string;
  /**
   * blockHeight height of block of transaction
   */
  blockHeight?: string;
  /**
   * indexingHeight used for indexing FinalizeBlock events (sorting rather than filtering)
   */
  indexingHeight?: string;
}

interface TendermintEvent {
  'message.action': Array<string>;
  'tm.event': Array<string>;
  'tx.acc_seq': Array<string>;
  'tx.fee': Array<string>;
  'tx.hash': Array<string>;
  'tx.height': Array<string>;
  'tx.signature': Array<string>;
  [key: string]: Array<string>;
}

interface GenericTendermintData {
  type: string;
  value: object;
}

interface TendermintTxData {
  type: 'tendermint/event/Tx';
  value: {
    TxResult: {
      height: string;
      result: {
        data: string;
        events: Array<{
          attributes: [{ index: boolean; key: string; value: string }];
          type: 'tx' | 'message';
        }>;
        gas_used: string;
        gas_wanted: string;
        log: string;
      };
      tx: string;
    };
  };
}

type TendermintDataType = TendermintTxData | GenericTendermintData;

export type MessageListener = (
  data: TendermintDataType,
  event: TendermintEvent,
  originalEvent: MessageEvent,
  transactionEvents?: Array<{ [key: string]: string }>
) => void;

interface CallBackWrapper {
  genericListener?: MessageListener;
  messageListener?: (event: { [key: string]: string }) => void;
  // to compare with the action of each event and filter out those that don't match
  messageAction?: string;
}

type MessageType = 'subscribe' | 'unsubscribe';

type SocketListenerType = 'open' | 'error' | 'close';

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
   * @param eventType the event type listening to (when/how the event will get emitted)
   * @param options SubscriptionOptions
   */
  readonly subscribeMessage: (
    onMessage: (event: { [key: string]: string }) => void,
    eventType: EventType,
    options?: SubscriptionOptions
  ) => void;

  /**
   * Removes an event listener that only listens to message actions
   * @param onMessage the function listening for the event
   * @param eventType the event type listening to (when/how the event will get emitted)
   * @param options SubscriptionOptions
   */
  readonly unsubscribeMessage: (
    onMessage: (event: { [key: string]: string }) => void,
    eventType?: EventType,
    options?: SubscriptionOptions
  ) => void;

  /**
   * Adds an event listener
   * @param onMessage the function listening for the event
   * @param eventType the event type listening to (when/how the event will get emitted)
   */
  readonly subscribe: (
    onMessage: MessageListener,
    eventType: EventType,
    options?: SubscriptionOptions
  ) => void;

  /**
   * Removes the specified listener
   * @param onMessage the function listening for the event,
   * if no other arguments are supplied then all instances of the function will be removed
   * if this is not defined then all of the listeners for the relevant query will be removed
   * @param eventType the event type listening to (when/how the event will get emitted)
   * @param options SubscriptionOptions
   */
  readonly unsubscribe: (
    onMessage?: MessageListener,
    eventType?: EventType,
    options?: SubscriptionOptions
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
  onopen: () => void;

  /**
   * Use this setter to add an event listener for when there is an error with the socket
   */
  onerror: (ev: Event) => void;

  /**
   * Use this setter to add an event listener for when the socket gets closed
   */
  onclose: () => void;

  /**
   * Adds an event listener for socket events (interchangeable with the event setters)
   * @param event name of event
   * @param cb callback
   */
  readonly addSocketListener: (
    event: SocketListenerType,
    cb: (ev?: Event) => void
  ) => void;

  /**
   * Removes the last istance of an event listener for socket events (regardles of how it was added)
   * @param event name of event
   * @param cb callback
   */
  readonly removeSocketListener: (
    event: SocketListenerType,
    cb: (ev?: Event) => void
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

export function createSubscriptionManager(
  url: string,
  onMessage?: MessageListener,
  eventType?: EventType,
  options?: SubscriptionOptions
): SubscriptionManager {
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
  const openListeners: Array<() => void> = [];
  const closeListeners: Array<() => void> = [];
  const errorListeners: Array<(ev: Event) => void> = [];
  let reconnectInterval = startingReconnectInterval;
  let lastAbortTimeout = -1;
  if (eventType && onMessage) subscribe(onMessage, eventType, options || {});

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
      openListeners.push(value);
    },
  });
  Object.defineProperty(manager, 'onerror', {
    set: function (value) {
      if (typeof value !== 'function')
        throw new Error('Invalid error listener');
      errorListeners.push(value);
    },
  });
  Object.defineProperty(manager, 'onclose', {
    set: function (value) {
      if (typeof value !== 'function')
        throw new Error('Invalid close listener');
      closeListeners.push(value);
    },
  });

  return manager;

  function addSocketListener(
    event: SocketListenerType,
    cb: (ev?: Event) => void
  ) {
    switch (event) {
      case 'open':
        openListeners.push(cb);
        break;
      case 'error':
        errorListeners.push(cb);
        break;
      case 'close':
        closeListeners.push(cb);
        break;
    }
  }

  function removeSocketListener(
    event: SocketListenerType,
    cb: (ev?: Event) => void
  ) {
    switch (event) {
      case 'open':
        let index = openListeners.lastIndexOf(cb);
        if (index !== -1) openListeners.splice(index, 1);
        break;
      case 'error':
        index = errorListeners.lastIndexOf(cb);
        if (index !== -1) errorListeners.splice(index, 1);
        break;
      case 'close':
        index = closeListeners.lastIndexOf(cb);
        if (index !== -1) closeListeners.splice(index, 1);
        break;
    }
  }

  function open() {
    if (isOpen()) throw new Error('Socket is already open');
    const currentSocket = new WebSocket(url);
    socket = currentSocket;
    socket.addEventListener('open', function () {
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
      openListeners.forEach(function (cb) {
        try {
          cb();
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
      errorListeners.forEach(function (cb) {
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
        setTimeout(open, reconnectInterval);
        reconnectInterval = Math.min(
          maxReconnectInterval,
          reconnectInterval * 2
        );
      }
      closeListeners.forEach(function (cb) {
        try {
          cb();
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
    socket = null;
  }

  function subscribeMessage(
    onMessage: (event: { [key: string]: string }) => void,
    eventType: EventType,
    options?: SubscriptionOptions
  ) {
    abstractSubscribe(
      { messageListener: onMessage, messageAction: options?.messageAction },
      eventType,
      options || {}
    );
  }

  function unsubscribeMessage(
    onMessage: (event: { [key: string]: string }) => void,
    eventType?: EventType,
    options?: SubscriptionOptions
  ) {
    abstractUnsubscribe(
      { messageListener: onMessage },
      eventType,
      options || {}
    );
  }

  function subscribe(
    onMessage: MessageListener,
    eventType: EventType,
    options?: SubscriptionOptions
  ) {
    abstractSubscribe({ genericListener: onMessage }, eventType, options || {});
  }

  function abstractSubscribe(
    onMessage: CallBackWrapper,
    eventType: EventType,
    options: SubscriptionOptions
  ) {
    const paramQuery = getParamQuery(eventType, options);
    const listenerGroup = listeners[paramQuery] || {
      status: QueryStatus.Disconnected,
      idUnsub: createID(),
      callBacks: [],
      id: createID(),
    };
    listeners[paramQuery] = listenerGroup;
    idListenerMap[listenerGroup.id] = listenerGroup;
    idListenerMap[listenerGroup.idUnsub] = listenerGroup;
    listenerGroup.callBacks.push(onMessage);
    if (isOpen()) {
      sendMessage('subscribe', paramQuery, listenerGroup.id);
      listenerGroup.status = QueryStatus.Connecting;
    } else if (!socket) {
      open();
    }
    debounceUnsub();
  }

  function unsubscribe(
    onMessage?: MessageListener,
    eventType?: EventType,
    options?: SubscriptionOptions
  ) {
    abstractUnsubscribe(
      { genericListener: onMessage },
      eventType,
      options || {}
    );
  }

  function abstractUnsubscribe(
    onMessage: CallBackWrapper | undefined,
    eventType: EventType | undefined,
    options: SubscriptionOptions
  ) {
    const paramQuery = getParamQuery(eventType, options);
    const isGeneric = !paramQuery;
    const listenerGroups = isGeneric ? Object.keys(listeners) : [paramQuery];
    listenerGroups.forEach(function (query) {
      const group = listeners[query];
      if (!group) return;
      group.callBacks = onMessage
        ? group.callBacks.filter((cb) => !isSameWrapper(cb, onMessage))
        : [];
    });
    debounceUnsub();
  }

  function unsubscribeAll() {
    abstractUnsubscribe(undefined, undefined, {});
  }

  function getParamQuery(
    eventType: EventType | undefined,
    options: SubscriptionOptions
  ): string {
    const { messageAction, hashKey, blockHeight, indexingHeight } = options;
    const paramMap = {
      'tm.event': eventType,
      'message.action': messageAction,
      'tx.hash': hashKey,
      'tx.height': blockHeight,
      'block.height': indexingHeight,
    };
    return Object.entries(paramMap)
      .map(([key, value]) => (value ? `${key}='${value}'` : null))
      .filter(Boolean)
      .join(' AND ');
  }

  function debounceUnsub() {
    clearTimeout(lastAbortTimeout);
    const emptyListeners = Object.entries(listeners).filter(
      ([, group]) => !group.callBacks.length
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
    const message = {
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
  function bubbleOnMessage(event: MessageEvent) {
    const { error, id, result } = JSON.parse(event.data);
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
      events.forEach(function (originalEvent) {
        const event = originalEvent.attributes.reduce<{
          [key: string]: string;
        }>(function (result, { key, value }) {
          result[Buffer.from(key, 'base64').toString()] = Buffer.from(
            value,
            'base64'
          ).toString();
          return result;
        }, {});
        listenerGroup.callBacks.forEach(function (wrapper) {
          if (wrapper.messageListener && wrapper.messageAction === event.action)
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
  if (wrapper.genericListener === other.genericListener) return true;
  if (wrapper.messageListener === other.messageListener) return true;
  return false;
}
