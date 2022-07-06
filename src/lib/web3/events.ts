import { Buffer } from 'buffer';

enum ActionNames {
  DepositShares = 'deposit_shares',
  NewDeposit = 'NewDeposit',
}

interface TendermintEvent {
  'message.action': Array<ActionNames>;
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

type MessageType = 'subscribe' | 'unsubscribe' | 'unsubscribeall';

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
   * Adds an event listener
   * @param onMessage the function listening for the event
   * @param eventType the event type listening to (when/how the event will get emitted)
   * @param messageAction the name of the event/message
   * @param hashKey hash key of transaction
   * @param blockHeight height of block of transaction
   * @param indexingHeight used for indexing FinalizeBlock events (sorting rather than filtering)
   */
  readonly subscribe: (
    onMessage: MessageListener,
    eventType: EventType,
    messageAction?: string,
    hashKey?: string,
    blockHeight?: string,
    indexingHeight?: string
  ) => void;

  /**
   * Removes the specified listener
   * @param onMessage the function listening for the event,
   * if no other arguments are supplied then all instances of the function will be removed
   * if this is not defined then all of the listeners for the relevant query will be removed
   * @param eventType the event type listening to (when/how the event will get emitted)
   * @param messageAction the name of the event/message
   * @param hashKey hash key of transaction
   * @param blockHeight height of block of transaction
   * @param indexingHeight used for indexing FinalizeBlock events (sorting rather than filtering)
   */
  readonly unsubscribe: (
    onMessage: MessageListener,
    eventType?: EventType,
    messageAction?: string,
    hashKey?: string,
    blockHeight?: string,
    indexingHeight?: string
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

export function createSubscriptionManager(
  url: string,
  onMessage?: MessageListener,
  eventType?: EventType,
  messageAction?: string,
  hashKey?: string,
  blockHeight?: string,
  indexingHeight?: string
): SubscriptionManager {
  let socket: WebSocket | null = null;
  const listeners: {
    [query: string]: { active: boolean; callBacks: Array<MessageListener> };
  } = {};
  const openListeners: Array<() => void> = [];
  const closeListeners: Array<() => void> = [];
  const errorListeners: Array<(ev: Event) => void> = [];
  let reconnectInterval = startingReconnectInterval;
  if (eventType && onMessage)
    subscribe(
      onMessage,
      eventType,
      messageAction,
      hashKey,
      blockHeight,
      indexingHeight
    );

  const manager = {
    open,
    close,
    subscribe,
    unsubscribe,
    unsubscribeAll,
    addSocketListener,
    removeSocketListener,
    isOpen,
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
    socket = new WebSocket(url);
    socket.addEventListener('open', function () {
      reconnectInterval = startingReconnectInterval;
      if (this !== socket) return; // socket has been altered
      socket?.addEventListener('message', bubbleOnMessage);
      Object.entries(listeners).forEach(([paramQuery, queryGroup]) => {
        if (!queryGroup.active) {
          const message = {
            jsonrpc: '2.0',
            method: 'subscribe',
            params: [paramQuery],
            id: 1,
          };
          socket?.send(JSON.stringify(message));
          queryGroup.active = true;
        }
      });
      openListeners.forEach(function (cb) {
        try {
          cb();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Failed to call open listener:');
          // eslint-disable-next-line no-console
          console.error(err);
        }
      });
    });
    socket.addEventListener('error', function (ev) {
      if (this !== socket) return; // socket has been altered
      errorListeners.forEach(function (cb) {
        try {
          cb(ev);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Failed to call error listener:');
          // eslint-disable-next-line no-console
          console.error(err);
        }
      });
    });
    socket.addEventListener('close', function (event) {
      if (this !== socket) return; // socket has been altered
      // disable all listeners (without removing) after a close
      Object.values(listeners).forEach((group) => (group.active = false));
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
          console.error('Failed to call close listener:');
          // eslint-disable-next-line no-console
          console.error(err);
        }
      });
    });
  }

  function close() {
    unsubscribeAll();
    if (isOpen()) socket?.close();
    socket = null;
  }

  function subscribe(
    onMessage: MessageListener,
    eventType: EventType,
    messageAction?: string,
    hashKey?: string,
    blockHeight?: string,
    indexingHeight?: string
  ) {
    sendMessage(
      'subscribe',
      onMessage,
      eventType,
      messageAction,
      hashKey,
      blockHeight,
      indexingHeight
    );
    // if the socket hasn't been initialized then open it after the the listener has been registered
    if (!socket) open();
  }

  function unsubscribe(
    onMessage?: MessageListener,
    eventType?: EventType,
    messageAction?: string,
    hashKey?: string,
    blockHeight?: string,
    indexingHeight?: string
  ) {
    sendMessage(
      'unsubscribe',
      onMessage,
      eventType,
      messageAction,
      hashKey,
      blockHeight,
      indexingHeight
    );
  }

  function unsubscribeAll() {
    sendMessage('unsubscribeall');
  }

  /**
   * "Overload" for sendMessageQuery
   */
  function sendMessage(
    method: MessageType,
    onMessage?: MessageListener,
    eventType?: EventType,
    messageAction?: string,
    hashKey?: string,
    blockHeight?: string,
    indexingHeight?: string
  ) {
    sendMessageParam(method, onMessage, {
      'tm.event': eventType,
      'message.action': messageAction,
      'tx.hash': hashKey,
      'tx.height': blockHeight,
      'block.height': indexingHeight,
    });
  }

  /**
   * "Overload" for sendMessageQuery
   */
  function sendMessageParam(
    method: MessageType,
    onMessage: MessageListener | undefined,
    paramMap: { [key: string]: string | undefined }
  ) {
    const paramQuery = Object.entries(paramMap)
      .map(([key, value]) => (value ? `${key}='${value}'` : null))
      .filter(Boolean)
      .join(' AND ');
    const isGeneric = !paramQuery;
    sendMessageQuery(method, onMessage, paramQuery, isGeneric);
  }

  /**
   * Manages the event listeners and sends the appropriate messages when necessary
   * @param method type of call
   * @param onMessage callback action
   * @param paramQuery the query param that identifies the request
   * @param isGeneric (only used for unsub to check whether the call is query based or function based)
   */
  function sendMessageQuery(
    method: MessageType,
    onMessage: MessageListener | undefined,
    paramQuery: string,
    isGeneric: boolean
  ) {
    switch (method) {
      case 'subscribe':
        if (!onMessage) return;
        listeners[paramQuery] = listeners[paramQuery] || {
          active: false,
          callBacks: [],
        };
        listeners[paramQuery].callBacks.push(onMessage);
        if (listeners[paramQuery].active) return;
        if (!isOpen()) return;
        listeners[paramQuery].active = true;
        break;
      case 'unsubscribe':
        if (isGeneric) {
          if (!onMessage) {
            // if no arguments were passed then call unsubscribeAll instead
            unsubscribeAll();
            return;
          }
          Object.entries(listeners).forEach(function ([
            paramQuery,
            listenerGroup,
          ]) {
            if (listenerGroup.callBacks.some((cb) => cb === onMessage)) {
              // send sub query to matching listener groups
              sendMessageQuery(method, onMessage, paramQuery, false);
            }
          });
          // abort message sending since it was managed by the loop
          return;
        }
        const listenerGroup = listeners[paramQuery];
        // null check
        if (!listenerGroup) return;
        // if no callback is supplied the remove everything
        if (onMessage) {
          listenerGroup.callBacks = listenerGroup.callBacks.filter(
            (cb) => cb !== onMessage
          );
          // if there are more functions listening abort
          if (listenerGroup.callBacks.length) return;
        } else {
          listenerGroup.callBacks = [];
        }
        listenerGroup.active = false;
        if (!isOpen()) return;
        break;
      case 'unsubscribeall':
        const hasSubs = Object.values(listeners).filter(function (
          listenerGroup
        ) {
          listenerGroup.callBacks = [];
          if (listenerGroup.active) {
            listenerGroup.active = false;
            return true;
          }
          return false;
        }).length;
        // if there are no active subscriptions then abort
        if (!hasSubs) return;
        if (!isOpen()) return;
        break;
    }
    const message = {
      jsonrpc: '2.0',
      method: method,
      params: [paramQuery],
      id: 1,
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
    const parsedData = JSON.parse(event.data);
    if (parsedData.error) {
      // eslint-disable-next-line no-console
      console.error('Received error from server');
      // eslint-disable-next-line no-console
      console.error(parsedData.error);
      return;
    }
    const data = parsedData.result.data as TendermintTxData,
      events = parsedData.result.events as TendermintEvent;
    let transactionEvents: Array<{ [key: string]: string }> | undefined =
      undefined;
    if (!data || !events) return; // ignore the original handshake
    if (data.type === 'tendermint/event/Tx') {
      const events = data.value?.TxResult?.result?.events;
      transactionEvents = events.map(function (event) {
        return event.attributes.reduce<{ [key: string]: string }>(function (
          result,
          { key, value }
        ) {
          result[Buffer.from(key, 'base64').toString()] = Buffer.from(
            value,
            'base64'
          ).toString();
          return result;
        },
        {});
      });
    }
    const queriedListeners = listeners[parsedData.result.query];
    if (!queriedListeners?.active) return;
    queriedListeners.callBacks.forEach(function (callBack) {
      callBack(data, events, event, transactionEvents);
    });
  }
}
