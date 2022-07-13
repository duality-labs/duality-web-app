import {
  setSocketClass,
  createSubscriptionManager,
  SubscriptionManager,
  EventType,
  MessageActionEvent,
  TendermintDataType,
  TendermintTxData,
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
          events: {
            'message.action': eventData.action ? [eventData.action] : [],
            'tm.event': ['Event'],
            'tx.acc_seq': ['seq'],
            'tx.fee': ['fee'],
            'tx.hash': ['hash'],
            'tx.height': ['height'],
            'tx.signature': ['sig'],
          },
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

describe('The event subscription manager', function () {
  beforeAll(function () {
    setSocketClass(CustomSocket as typeof WebSocket);
  });

  describe('should be able to manage the connection state', function () {
    it('should be able to open a connection', function () {
      subManager = createSubscriptionManager(url);
      subManager.open();
      return new Promise((resolve) =>
        subManager.addSocketListener('open', resolve)
      );
    });

    it('should be able to close an open connection', function () {
      return new Promise(function (resolve) {
        subManager = createSubscriptionManager(url);
        subManager.addSocketListener('close', function (event) {
          expect(event instanceof CloseEvent && event.wasClean).toBe(true);
          resolve('Done');
        });
        subManager.addSocketListener('open', subManager.close);
        subManager.open();
      });
    });

    it('should be able to call close without an open connection', function () {
      let succesfullRun = false;
      try {
        subManager = createSubscriptionManager(url);
        subManager.close();
        succesfullRun = true;
      } catch (e) {
        succesfullRun = false;
      }
      expect(succesfullRun).toBe(true);
    });

    it(
      'should be able to call open twice without opening two sockets',
      async function () {
        let openCount = 0;
        subManager = createSubscriptionManager(url);
        subManager.addSocketListener('open', () => (openCount += 1));
        subManager.open();
        subManager.open();
        await wait(genericTimeout);
        expect(openCount).toBe(1);
      },
      genericTimeout * 2
    );

    afterEach(function () {
      subManager?.close();
    });
  });

  describe('should be able to manage subscribing', function () {
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

    describe('(subscription tests)', function () {
      it('should be able to listen for any type of event', async function () {
        const requestID = currentID;
        currentID += 2;
        const actionName = 'Test';
        currentSocket.emulateMessage(
          { module: 'duality', action: actionName },
          requestID
        );
        const result = await new Promise<TendermintDataType>((resolve) =>
          subManager.subscribe(resolve, EventType.EventTxValue)
        );
        const actionNames = getActionNames(result);
        expect(actionNames).toStrictEqual([actionName]);
      });
      it('should be able to listen for a specific type of message', async function () {
        const actionName = 'Test';
        const requestID = currentID;
        currentID += 2;
        currentSocket.emulateMessage(
          { module: 'duality', action: actionName },
          requestID
        );
        const result = await new Promise<TendermintDataType>((resolve) =>
          subManager.subscribe(resolve, EventType.EventTxValue, {
            messageAction: actionName,
          })
        );
        const actionNames = getActionNames(result);
        expect(actionNames).toStrictEqual([actionName]);
      });
      it('should be able to listen to mutliple messages', function () {
        const actionNames = ['Test', 'tseT'];
        const result: Array<string | null> = [];
        const requestID = currentID;
        currentID += 2;

        return new Promise(function (resolve) {
          subManager.subscribe(function (event) {
            result.push(...getActionNames(event));
            expect(result.length).toBeLessThanOrEqual(actionNames.length);
            if (result.length !== actionNames.length) return;
            expect(result.sort()).toStrictEqual(actionNames.sort());
            resolve('Done');
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
        const result: Array<string | null> = [];
        const repeatCount = 2;
        const requestID = currentID;
        currentID += 2;

        return new Promise(function (resolve) {
          Array.from({ length: repeatCount }).forEach(() =>
            subManager.subscribe(onEvent, EventType.EventTxValue)
          );
          currentSocket.emulateMessage(
            { module: 'duality', action: actionName },
            requestID
          );

          function onEvent(event: TendermintDataType) {
            const actionNames = getActionNames(event);
            result.push(...actionNames);
            expect(actionNames).toStrictEqual([actionName]);
            expect(result.length).toBeLessThanOrEqual(repeatCount);
            if (result.length !== repeatCount) return;
            resolve('Done');
          }
        });
      });
      it('should be ok to subscribe multiple times with a message', function () {
        const actionName = 'Test';
        const result: Array<string | null> = [];
        const repeatCount = 2;
        const requestID = currentID;
        currentID += 2;

        return new Promise(function (resolve) {
          Array.from({ length: repeatCount }).forEach(() =>
            subManager.subscribe(onEvent, EventType.EventTxValue, {
              messageAction: actionName,
            })
          );
          currentSocket.emulateMessage(
            { module: 'duality', action: actionName },
            requestID
          );

          function onEvent(event: TendermintDataType) {
            const actionNames = getActionNames(event);
            result.push(...actionNames);
            expect(actionNames).toStrictEqual([actionName]);
            expect(result.length).toBeLessThanOrEqual(repeatCount);
            if (result.length !== repeatCount) return;
            resolve('Done');
          }
        });
      });
      it('should be ok to subscribe multiple times with different messages', function () {
        const actionNames = ['Test', 'tseT'];
        const result: Array<string | null> = [];
        const requestIDMap = getNewIDMap(actionNames);

        return new Promise(function (resolve) {
          actionNames.forEach((actionName) =>
            subManager.subscribe(onEvent, EventType.EventTxValue, {
              messageAction: actionName,
            })
          );
          actionNames.forEach((actionName) =>
            currentSocket.emulateMessage(
              { module: 'duality', action: actionName },
              requestIDMap[actionName]
            )
          );

          function onEvent(event: TendermintDataType) {
            const actionNames = getActionNames(event);
            result.push(...actionNames);
            expect(result.length).toBeLessThanOrEqual(actionNames.length);
            if (result.length !== actionNames.length) return;
            expect(result.sort()).toStrictEqual(actionNames.sort());
            resolve('Done');
          }
        });
      });
      it(
        'should be ok to ignore unregistered messages',
        async function () {
          const actionName = 'Test';
          const fakeActionName = 'tseT';
          const requestID = currentID;
          currentID += 2;

          subManager.subscribe(onEvent, EventType.EventTxValue, {
            messageAction: actionName,
          });
          currentSocket.emulateMessage(
            { module: 'duality', action: actionName },
            requestID
          );
          currentSocket.emulateMessage(
            { module: 'duality', action: fakeActionName },
            // no other way to test
            requestID + 2
          );
          // give it a while to ensure the other event won't get read
          await wait(genericTimeout);

          function onEvent(event: TendermintDataType) {
            expect(getActionNames(event)).toStrictEqual([actionName]);
          }

          // double the timeout to ensure the timeout won't be an issue
        },
        genericTimeout * 2
      );
    });

    describe('(unsubscription tests)', function () {
      it(
        'should be able to unsubscribe from a specific event',
        async function () {
          const actionName = 'Test';
          let messageCount = 0;
          const requestID = currentID;
          currentID += 2;

          subManager.subscribe(onEvent, EventType.EventTxValue, {
            messageAction: actionName,
          });
          subManager.unsubscribe(onEvent, EventType.EventTxValue, {
            messageAction: actionName,
          });
          currentSocket.emulateMessage(
            { module: 'duality', action: actionName },
            requestID
          );
          await wait(genericTimeout);
          expect(messageCount).toBe(0);

          function onEvent() {
            messageCount += 1;
          }
        },
        genericTimeout * 2
      );
      it(
        'should be able to unsubscribe without params',
        async function () {
          const actionName = 'Test';
          let messageCount = 0;
          const requestID = currentID;
          currentID += 2;

          subManager.subscribe(onEvent, EventType.EventTxValue, {
            messageAction: actionName,
          });
          subManager.unsubscribe();
          currentSocket.emulateMessage(
            { module: 'duality', action: actionName },
            requestID
          );
          await wait(genericTimeout);
          expect(messageCount).toBe(0);

          function onEvent() {
            messageCount += 1;
          }
        },
        genericTimeout * 2
      );
      it(
        'should be able to unsubscribe from a generic subscription',
        async function () {
          const actionName = 'Test';
          let messageCount = 0;
          const requestID = currentID;
          currentID += 2;

          subManager.subscribe(onEvent, EventType.EventTxValue);
          subManager.unsubscribe(onEvent, EventType.EventTxValue);
          currentSocket.emulateMessage(
            { module: 'duality', action: actionName },
            requestID
          );
          await wait(genericTimeout);
          expect(messageCount).toBe(0);

          function onEvent() {
            messageCount += 1;
          }
        },
        genericTimeout * 2
      );
      it(
        'should be able to unsubscribe from multiple specific subscriptions with one call',
        async function () {
          const actionName = 'Test';
          let messageCount = 0;
          const requestID = currentID;
          currentID += 2;

          subManager.subscribe(onEvent, EventType.EventTxValue, {
            messageAction: actionName,
          });
          subManager.subscribe(onEvent, EventType.EventTxValue, {
            messageAction: actionName,
          });
          subManager.unsubscribe(onEvent, EventType.EventTxValue, {
            messageAction: actionName,
          });
          currentSocket.emulateMessage(
            { module: 'duality', action: actionName },
            requestID
          );
          await wait(genericTimeout);
          expect(messageCount).toBe(0);

          function onEvent() {
            messageCount += 1;
          }
        },
        genericTimeout * 2
      );
      it(
        'should be able to unsubscribe from multiple subscriptions with one fully generic call',
        async function () {
          const actionNames = ['Test', 'tseT'];
          let messageCount = 0;
          const requestIDMap = getNewIDMap(actionNames);

          actionNames.forEach((actionName) =>
            subManager.subscribe(onEvent, EventType.EventTxValue, {
              messageAction: actionName,
            })
          );
          subManager.unsubscribe();
          actionNames.forEach((actionName) =>
            currentSocket.emulateMessage(
              { module: 'duality', action: actionName },
              requestIDMap[actionName]
            )
          );
          await wait(genericTimeout);
          expect(messageCount).toBe(0);

          function onEvent() {
            messageCount += 1;
          }
        },
        genericTimeout * 2
      );
      it(
        'should be able to only unsubscribe from a specific subscription and not all (based on the action name)',
        async function () {
          const actionNames = ['Test', 'tseT'];
          let messageCount = 0;
          const requestIDMap = getNewIDMap(actionNames);

          actionNames.forEach((actionName) =>
            subManager.subscribe(onEvent, EventType.EventTxValue, {
              messageAction: actionName,
            })
          );
          subManager.unsubscribe(onEvent, EventType.EventTxValue, {
            messageAction: actionNames[0],
          });
          actionNames.forEach((actionName) =>
            currentSocket.emulateMessage(
              { module: 'duality', action: actionName },
              requestIDMap[actionName]
            )
          );
          await wait(genericTimeout);
          expect(messageCount).toBe(1);

          function onEvent() {
            messageCount += 1;
          }
        },
        genericTimeout * 2
      );
      it(
        'should be able to only unsubscribe from a specific subscription and not all (based on the callback)',
        async function () {
          const actionName = 'Test';
          let messageCount = 0;
          const requestID = currentID;
          currentID += 2;

          subManager.subscribe(onEvent, EventType.EventTxValue, {
            messageAction: actionName,
          });
          subManager.subscribe(
            () => (messageCount += 1),
            EventType.EventTxValue,
            { messageAction: actionName }
          );
          subManager.unsubscribe(onEvent, EventType.EventTxValue, {
            messageAction: actionName,
          });
          currentSocket.emulateMessage(
            { module: 'duality', action: actionName },
            requestID
          );
          await wait(genericTimeout);
          expect(messageCount).toBe(1);

          function onEvent() {
            messageCount += 1;
          }
        },
        genericTimeout * 2
      );
      it(
        'should be able to only unsubscribe from a specific subscription and not all (based on the callback but otherwise generic)',
        async function () {
          const actionName = 'Test';
          let messageCount = 0;
          const requestID = currentID;
          currentID += 2;

          subManager.subscribe(onEvent, EventType.EventTxValue, {
            messageAction: actionName,
          });
          subManager.subscribe(
            () => (messageCount += 1),
            EventType.EventTxValue,
            { messageAction: actionName }
          );
          subManager.unsubscribe(onEvent);
          currentSocket.emulateMessage(
            { module: 'duality', action: actionName },
            requestID
          );
          await wait(genericTimeout);
          expect(messageCount).toBe(1);

          function onEvent() {
            messageCount += 1;
          }
        },
        genericTimeout * 2
      );
    });

    describe('(message subscription tests)', function () {
      it('should be able to listen for any type of message', async function () {
        const requestID = currentID;
        currentID += 2;
        const actionName = 'Test';
        currentSocket.emulateMessage(
          { module: 'duality', action: actionName },
          requestID
        );
        const result = await new Promise<MessageActionEvent>((resolve) =>
          subManager.subscribeMessage(resolve, EventType.EventTxValue)
        );
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
        const result = await new Promise<MessageActionEvent>((resolve) =>
          subManager.subscribeMessage(resolve, EventType.EventTxValue, {
            messageAction: actionName,
          })
        );
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
            resolve('Done');
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
            resolve('Done');
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
            resolve('Done');
          }
        });
      });
      it('should be ok to subscribe multiple times with different messages', function () {
        const actionNames = ['Test', 'tseT'];
        const result: Array<string | undefined> = [];
        const requestIDMap = getNewIDMap(actionNames);

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
            resolve('Done');
          }
        });
      });
      it(
        'should be ok to ignore unregistered messages',
        async function () {
          const actionName = 'Test';
          const fakeActionName = 'tseT';
          const requestID = currentID;
          currentID += 2;

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
          await wait(genericTimeout);

          function onMessage(event: MessageActionEvent) {
            expect(event.action).toBe(actionName);
          }

          // double the timeout to ensure the timeout won't be an issue
        },
        genericTimeout * 2
      );
    });

    describe('(message unsubscription tests)', function () {
      it(
        'should be able to unsubscribe from a specific message',
        async function () {
          const actionName = 'Test';
          let messageCount = 0;
          const requestID = currentID;
          currentID += 2;

          subManager.subscribeMessage(onMessage, EventType.EventTxValue, {
            messageAction: actionName,
          });
          subManager.unsubscribeMessage(onMessage, EventType.EventTxValue, {
            messageAction: actionName,
          });
          currentSocket.emulateMessage(
            { module: 'duality', action: actionName },
            requestID
          );
          await wait(genericTimeout);
          expect(messageCount).toBe(0);

          function onMessage() {
            messageCount += 1;
          }
        },
        genericTimeout * 2
      );
      it(
        'should be able to unsubscribe without params',
        async function () {
          const actionName = 'Test';
          let messageCount = 0;
          const requestID = currentID;
          currentID += 2;

          subManager.subscribeMessage(onMessage, EventType.EventTxValue, {
            messageAction: actionName,
          });
          subManager.unsubscribeMessage();
          currentSocket.emulateMessage(
            { module: 'duality', action: actionName },
            requestID
          );
          await wait(genericTimeout);
          expect(messageCount).toBe(0);

          function onMessage() {
            messageCount += 1;
          }
        },
        genericTimeout * 2
      );
      it(
        'should be able to unsubscribe from a generic subscription',
        async function () {
          const actionName = 'Test';
          let messageCount = 0;
          const requestID = currentID;
          currentID += 2;

          subManager.subscribeMessage(onMessage, EventType.EventTxValue);
          subManager.unsubscribeMessage(onMessage, EventType.EventTxValue);
          currentSocket.emulateMessage(
            { module: 'duality', action: actionName },
            requestID
          );
          await wait(genericTimeout);
          expect(messageCount).toBe(0);

          function onMessage() {
            messageCount += 1;
          }
        },
        genericTimeout * 2
      );
      it(
        'should be able to unsubscribe from multiple specific subscriptions with one call',
        async function () {
          const actionName = 'Test';
          let messageCount = 0;
          const requestID = currentID;
          currentID += 2;

          subManager.subscribeMessage(onMessage, EventType.EventTxValue, {
            messageAction: actionName,
          });
          subManager.subscribeMessage(onMessage, EventType.EventTxValue, {
            messageAction: actionName,
          });
          subManager.unsubscribeMessage(onMessage, EventType.EventTxValue, {
            messageAction: actionName,
          });
          currentSocket.emulateMessage(
            { module: 'duality', action: actionName },
            requestID
          );
          await wait(genericTimeout);
          expect(messageCount).toBe(0);

          function onMessage() {
            messageCount += 1;
          }
        },
        genericTimeout * 2
      );
      it(
        'should be able to unsubscribe from multiple subscriptions with one fully generic call',
        async function () {
          const actionNames = ['Test', 'tseT'];
          let messageCount = 0;
          const requestIDMap = getNewIDMap(actionNames);

          actionNames.forEach((actionName) =>
            subManager.subscribeMessage(onMessage, EventType.EventTxValue, {
              messageAction: actionName,
            })
          );
          subManager.unsubscribeMessage();
          actionNames.forEach((actionName) =>
            currentSocket.emulateMessage(
              { module: 'duality', action: actionName },
              requestIDMap[actionName]
            )
          );
          await wait(genericTimeout);
          expect(messageCount).toBe(0);

          function onMessage() {
            messageCount += 1;
          }
        },
        genericTimeout * 2
      );
      it(
        'should be able to only unsubscribe from a specific subscription and not all (based on the action name)',
        async function () {
          const actionNames = ['Test', 'tseT'];
          let messageCount = 0;
          const requestIDMap = getNewIDMap(actionNames);

          actionNames.forEach((actionName) =>
            subManager.subscribeMessage(onMessage, EventType.EventTxValue, {
              messageAction: actionName,
            })
          );
          subManager.unsubscribeMessage(onMessage, EventType.EventTxValue, {
            messageAction: actionNames[0],
          });
          actionNames.forEach((actionName) =>
            currentSocket.emulateMessage(
              { module: 'duality', action: actionName },
              requestIDMap[actionName]
            )
          );
          await wait(genericTimeout);
          expect(messageCount).toBe(1);

          function onMessage() {
            messageCount += 1;
          }
        },
        genericTimeout * 2
      );
      it(
        'should be able to only unsubscribe from a specific subscription and not all (based on the callback)',
        async function () {
          const actionName = 'Test';
          let messageCount = 0;
          const requestID = currentID;
          currentID += 2;

          subManager.subscribeMessage(onMessage, EventType.EventTxValue, {
            messageAction: actionName,
          });
          subManager.subscribeMessage(
            () => (messageCount += 1),
            EventType.EventTxValue,
            { messageAction: actionName }
          );
          subManager.unsubscribeMessage(onMessage, EventType.EventTxValue, {
            messageAction: actionName,
          });
          currentSocket.emulateMessage(
            { module: 'duality', action: actionName },
            requestID
          );
          await wait(genericTimeout);
          expect(messageCount).toBe(1);

          function onMessage() {
            messageCount += 1;
          }
        },
        genericTimeout * 2
      );
      it(
        'should be able to only unsubscribe from a specific subscription and not all (based on the callback but otherwise generic)',
        async function () {
          const actionName = 'Test';
          let messageCount = 0;
          const requestID = currentID;
          currentID += 2;

          subManager.subscribeMessage(onMessage, EventType.EventTxValue, {
            messageAction: actionName,
          });
          subManager.subscribeMessage(
            () => (messageCount += 1),
            EventType.EventTxValue,
            { messageAction: actionName }
          );
          subManager.unsubscribeMessage(onMessage);
          currentSocket.emulateMessage(
            { module: 'duality', action: actionName },
            requestID
          );
          await wait(genericTimeout);
          expect(messageCount).toBe(1);

          function onMessage() {
            messageCount += 1;
          }
        },
        genericTimeout * 2
      );
    });

    afterEach(function () {
      subManager.close();
    });
  });
});

function wait(ms: number) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function getNewIDMap(actionNames: Array<string>) {
  return actionNames.reduce<{ [actionName: string]: number }>(function (
    result,
    name
  ) {
    result[name] = currentID;
    currentID += 2;
    return result;
  },
  {});
}

function getActionNames(data: TendermintDataType) {
  const events = (data as TendermintTxData).value?.TxResult?.result?.events;
  return events
    .map(function (event) {
      const attribute = event.attributes.find(
        ({ key }) => Buffer.from(key, 'base64').toString() === 'action'
      );
      return attribute
        ? Buffer.from(attribute.value, 'base64').toString()
        : null;
    })
    .filter(Boolean);
}
