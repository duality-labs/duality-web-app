import {
  setSocketClass,
  createSubscriptionManager,
  SubscriptionManager,
  EventType,
  SubscriptionOptions,
  MessageActionEvent,
} from './events';
import { Buffer } from 'buffer';

const url = 'ws://localhost:26657/websocket';
const genericTimeout = 5e3;
jest.setTimeout(genericTimeout);

let subManager: SubscriptionManager;
let currentSocket: CustomSocket;
// the id doesn't reset on clean so it's estimated value is stored here
let currentID = 3;

class CustomSocket extends WebSocket {
  private static list: Array<CustomSocket> = [];
  private listeners: Array<
    (this: WebSocket, ev: WebSocketEventMap['message']) => void
  > = [];

  constructor(url: string, protocols?: string | string[]) {
    super(url, protocols);
    CustomSocket.list.push(this);
  }

  addEventListener<K extends keyof WebSocketEventMap>(
    type: K,
    listener: (this: WebSocket, ev: WebSocketEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ) {
    if (type === 'message') {
      this.listeners.push(
        listener as (this: WebSocket, ev: WebSocketEventMap['message']) => void
      );
    }
    super.addEventListener(type, listener, options);
  }

  emulateMessage(eventData: MessageActionEvent, id: number) {
    const customEvent = {
      data: JSON.stringify({
        id: id,
        result: {
          data: {
            type: 'tendermint/event/Tx',
            value: {
              TxResult: {
                result: {
                  events: [
                    {
                      attributes: Object.entries(eventData).map(
                        ([key, value]) => ({
                          key: Buffer.from(key).toString('base64'),
                          value: value && Buffer.from(value).toString('base64'),
                        })
                      ),
                    },
                  ],
                },
              },
            },
          },
          events: {},
        },
      }),
    } as WebSocketEventMap['message'];
    // wait 50ms before emitting event
    setTimeout(
      () =>
        this.listeners.forEach((listener) => listener.call(this, customEvent)),
      250
    );
  }
}

beforeAll(function () {
  setSocketClass(CustomSocket as typeof WebSocket);
});

beforeEach(function () {
  return new Promise(function (resolve, reject) {
    subManager = createSubscriptionManager(url);
    subManager.addSocketListener('open', function (e) {
      if (e?.target instanceof CustomSocket) {
        currentSocket = e.target;
        resolve(subManager);
      } else {
        reject('');
      }
    });
    subManager.addSocketListener('error', reject);
    subManager.open();
  });
});

afterEach(() => {
  subManager.close();
});

describe('The event subscription manager', () => {
  it('should be able to listen for any type of message', async function () {
    const requestID = currentID;
    currentID += 2;
    const actionName = 'Test';
    currentSocket.emulateMessage(
      { module: 'duality', action: actionName },
      requestID
    );
    const result = await subscribeAsync();
    expect(result.action).toBe(actionName);
  });
  it('should be able to listen for a specific type of message', async function () {
    const actionName = 'Test';
    const requestID = currentID;
    currentID += 2;
    currentSocket.emulateMessage(
      { module: 'duality', action: actionName },
      requestID
    );
    const result = await subscribeAsync(actionName);
    expect(result.action).toBe(actionName);
  });
  it('should be able to listen to mutliple messages', function () {
    const actionNames = ['Test', 'tseT'];
    const result: Array<string | undefined> = [];
    const requestID = currentID;
    currentID += 2;

    return new Promise(function (resolve) {
      subManager.subscribeMessage(function (event) {
        result.push(event.action);
        expect(result.length).toBeLessThanOrEqual(actionNames.length);
        if (result.length !== actionNames.length) return;
        expect(result.sort()).toStrictEqual(actionNames.sort());
        resolve('OK');
      }, EventType.EventTxValue);
      actionNames.forEach((actionName) =>
        currentSocket.emulateMessage(
          { module: 'duality', action: actionName },
          requestID
        )
      );
    });
  });
  it('should be ok to subscribe multiple times without a message', function () {
    const actionName = 'Test';
    const result: Array<string | undefined> = [];
    const repeatCount = 2;
    const requestID = currentID;
    currentID += 2;

    return new Promise(function (resolve) {
      Array.from({ length: repeatCount }).forEach(() =>
        subManager.subscribeMessage(onMessage, EventType.EventTxValue)
      );
      currentSocket.emulateMessage(
        { module: 'duality', action: actionName },
        requestID
      );

      function onMessage(event: MessageActionEvent) {
        result.push(event.action);
        expect(event.action).toBe(actionName);
        expect(result.length).toBeLessThanOrEqual(repeatCount);
        if (result.length !== repeatCount) return;
        resolve('OK');
      }
    });
  });
  it('should be ok to subscribe multiple times with a message', function () {
    const actionName = 'Test';
    const result: Array<string | undefined> = [];
    const repeatCount = 2;
    const requestID = currentID;
    currentID += 2;

    return new Promise(function (resolve) {
      Array.from({ length: repeatCount }).forEach(() =>
        subManager.subscribeMessage(onMessage, EventType.EventTxValue, {
          messageAction: actionName,
        })
      );
      currentSocket.emulateMessage(
        { module: 'duality', action: actionName },
        requestID
      );

      function onMessage(event: MessageActionEvent) {
        result.push(event.action);
        expect(event.action).toBe(actionName);
        expect(result.length).toBeLessThanOrEqual(repeatCount);
        if (result.length !== repeatCount) return;
        resolve('OK');
      }
    });
  });
  it('should be ok to subscribe multiple times with different messages', function () {
    const actionNames = ['Test', 'tseT'];
    const result: Array<string | undefined> = [];
    const requestIDMap = actionNames.reduce<{ [actionName: string]: number }>(
      function (result, name) {
        result[name] = currentID;
        currentID += 2;
        return result;
      },
      {}
    );

    return new Promise(function (resolve) {
      actionNames.forEach((actionName) =>
        subManager.subscribeMessage(onMessage, EventType.EventTxValue, {
          messageAction: actionName,
        })
      );
      actionNames.forEach((actionName) =>
        currentSocket.emulateMessage(
          { module: 'duality', action: actionName },
          requestIDMap[actionName]
        )
      );

      function onMessage(event: MessageActionEvent) {
        result.push(event.action);
        expect(result.length).toBeLessThanOrEqual(actionNames.length);
        if (result.length !== actionNames.length) return;
        expect(result.sort()).toStrictEqual(actionNames.sort());
        resolve('OK');
      }
    });
  });
  it(
    'should be ok to ignore unregistered messages',
    function () {
      const actionName = 'Test';
      const fakeActionName = 'tseT';
      const requestID = currentID;
      currentID += 2;

      return new Promise(function (resolve) {
        subManager.subscribeMessage(onMessage, EventType.EventTxValue, {
          messageAction: actionName,
        });
        currentSocket.emulateMessage(
          { module: 'duality', action: actionName },
          requestID
        );
        currentSocket.emulateMessage(
          { module: 'duality', action: fakeActionName },
          requestID
        );
        // give it a while to ensure the other event won't get read
        setTimeout(resolve, genericTimeout);

        function onMessage(event: MessageActionEvent) {
          expect(event.action).toBe(actionName);
        }
      });

      // double the timeout to ensure the timeout won't be an issue
    },
    genericTimeout * 2
  );
});

function subscribeAsync(actionName?: string): Promise<MessageActionEvent> {
  return new Promise(function (resolve) {
    const options: SubscriptionOptions = actionName
      ? { messageAction: actionName }
      : {};
    subManager.subscribeMessage(resolve, EventType.EventTxValue, options);
  });
}
