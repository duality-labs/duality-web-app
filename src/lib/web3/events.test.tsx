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
const shortTimeout = 0.5e3;
const mediumTimeout = 2e3;
const longerTimeout = 3e3;
jest.setTimeout(mediumTimeout);

let subManager: SubscriptionManager;
let currentSocket: CustomSocket;

class CustomSocket extends WebSocket {
  private static list: Array<CustomSocket> = [];
  private messageListeners: Array<
    (this: WebSocket, ev: WebSocketEventMap['message']) => void
  > = [];
  private closeListeners: Array<
    (this: WebSocket, ev: WebSocketEventMap['close']) => void
  > = [];
  // array of promise resolves for each actionName (in case the same action is emitted twice)
  private receiveResolveMap: { [actionName: string]: Array<() => void> } = {};
  private actionIDMap: { [action: string]: number } = {};

  constructor(url: string, protocols?: string | string[]) {
    super(url, protocols);
    CustomSocket.list.push(this);
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    if (typeof data === 'string') {
      const { method, params, id } = JSON.parse(data);
      if (method === 'subscribe') {
        const [, messageAction] =
          (params?.[0] && /action='([^']+)'/.exec(params?.[0])) ?? [];
        this.actionIDMap[messageAction] = id;
      }
    }
    super.send(data);
  }

  addEventListener<K extends keyof WebSocketEventMap>(
    type: K,
    listener: (this: WebSocket, ev: WebSocketEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ) {
    if (type === 'message') {
      this.messageListeners.push(
        listener as (this: WebSocket, ev: WebSocketEventMap['message']) => void
      );
    }
    if (type === 'close') {
      this.closeListeners.push(
        listener as (this: WebSocket, ev: WebSocketEventMap['close']) => void
      );
    }
    super.addEventListener(type, listener, options);
  }

  emulateClose(clean: boolean) {
    const closeEvent = { wasClean: clean } as WebSocketEventMap['close'];
    this.closeListeners.forEach((listner) => listner.call(this, closeEvent));
  }

  async waitUntilReceived(...actionNames: Array<string>) {
    const promises = actionNames.map(
      (actionName) =>
        new Promise<void>(
          (resolve) =>
            (this.receiveResolveMap[actionName] = [
              ...(this.receiveResolveMap[actionName] ?? []),
              resolve,
            ])
        )
    );
    await Promise.all(promises);
  }

  emulateEvent(
    action: string,
    otherAttributes: { [key: string]: string } = {}
  ) {
    const idList = [
      this.actionIDMap.undefined,
      this.actionIDMap[action],
    ].filter(Boolean);
    // if there are no relevant subscriptions then don't call bubbleOnMessage (will log the unregistered id error) and skip the waiting
    if (!idList.length)
      return setTimeout(
        () => this.receiveResolveMap[action]?.pop()?.(),
        shortTimeout
      );
    idList.forEach((id) => {
      const eventData = {
        module: 'duality',
        ...otherAttributes,
        action: action,
      };
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
                            value:
                              value && Buffer.from(value).toString('base64'),
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

      setTimeout(() => {
        this.messageListeners.forEach((listener) =>
          listener.call(this, customEvent)
        );
        this.receiveResolveMap[action]?.pop()?.();
      }, shortTimeout);
    });
  }
}

describe('The event subscription manager', function () {
  beforeAll(function () {
    setSocketClass(CustomSocket as typeof WebSocket);
  });

  describe('should be able to manage the connection state', function () {
    afterEach(function () {
      subManager?.close();
    });

    it('should be able to open a connection', function (done) {
      subManager = createSubscriptionManager(url);
      subManager.open();
      subManager.addSocketListener('open', () => done());
    });

    it('should be able to close an open connection', function (done) {
      subManager = createSubscriptionManager(url);
      subManager.addSocketListener('close', function (event) {
        expect(event.wasClean).toBe(true);
        done();
      });
      subManager.addSocketListener('open', subManager.close);
      subManager.open();
    });

    it('should be able to call close without an open connection', function () {
      subManager = createSubscriptionManager(url);
      subManager.close();
      expect(subManager.isOpen()).toBe(false);
    });

    it(
      'should be able to call open twice without opening two sockets',
      async function () {
        const handler = jest.fn();
        subManager = createSubscriptionManager(url);
        subManager.addSocketListener('open', handler);
        subManager.open();
        subManager.open();
        await delay(mediumTimeout);
        expect(handler).toHaveBeenCalledTimes(1);
      },
      longerTimeout
    );

    it(
      'should be able to open, close and reopen a connection',
      async function () {
        const handler = jest.fn();
        subManager = createSubscriptionManager(url);
        subManager.addSocketListener('open', handler);
        subManager.open();
        subManager.close();
        subManager.open();
        await delay(mediumTimeout);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(subManager.isOpen()).toBe(true);
      },
      longerTimeout
    );

    it(
      'should be able to open, wait, close and reopen a connection',
      async function () {
        const handler = jest.fn();
        subManager = createSubscriptionManager(url);
        subManager.addSocketListener('open', handler);
        subManager.addSocketListener('open', subManager.close);
        subManager.addSocketListener('close', () => {
          subManager.removeSocketListener('open', subManager.close);
          subManager.open();
        });
        subManager.open();

        await delay(mediumTimeout);
        expect(handler).toHaveBeenCalledTimes(2);
        expect(subManager.isOpen()).toBe(true);
      },
      longerTimeout
    );

    it(
      'should be able to able to reconnect after a "network error"',
      async function () {
        const handler = jest.fn();
        subManager = createSubscriptionManager(url);
        subManager.addSocketListener('open', handler);
        subManager.addSocketListener('open', onOpen);
        subManager.open();

        await delay(longerTimeout);
        expect(handler).toHaveBeenCalledTimes(2);
        expect(subManager.isOpen()).toBe(true);

        function onOpen(event?: Event) {
          if (event?.target instanceof CustomSocket) {
            const socket = event.target;
            socket.emulateClose(false);
            subManager.removeSocketListener('open', onOpen);
          }
        }
      },
      longerTimeout + shortTimeout
    );

    it(
      'should not be affected by a fake clean close event',
      async function () {
        const handler = jest.fn();
        subManager = createSubscriptionManager(url);
        subManager.addSocketListener('open', handler);
        subManager.addSocketListener('open', onOpen);
        subManager.open();

        await delay(longerTimeout);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(subManager.isOpen()).toBe(true);

        function onOpen(event?: Event) {
          if (event?.target instanceof CustomSocket) {
            const socket = event.target;
            socket.emulateClose(true);
            subManager.removeSocketListener('open', onOpen);
          }
        }
      },
      longerTimeout + shortTimeout
    );
  });

  describe('should be able to manage subscribing', function () {
    const actionName = 'Test';
    const otherActionName = 'steT';
    const actionNames = [actionName, otherActionName];

    beforeEach(async function () {
      await new Promise(function (resolve, reject) {
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

    afterEach(function () {
      subManager.close();
    });

    describe('(subscription tests)', function () {
      it('should be able to listen for any type of event', async function () {
        const handler = jest.fn();

        subManager.subscribe(handler, EventType.EventTxValue);
        currentSocket.emulateEvent(actionName);

        await currentSocket.waitUntilReceived(actionName);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            value: expect.objectContaining(getEventObject(actionName)),
          }),
          expect.anything(),
          expect.anything()
        );
      });
      it('should be able to listen for a specific type of event', async function () {
        const { waiter, resolve } = createWaiter<TendermintDataType>();

        subManager.subscribe(resolve, EventType.EventTxValue, {
          messageAction: actionName,
        });
        currentSocket.emulateEvent(actionName);

        expect(getActionNames(await waiter)).toStrictEqual([actionName]);
      });
      it('should be able to listen to multiple events', async function () {
        const handler = jest.fn();

        subManager.subscribe(handler, EventType.EventTxValue);
        actionNames.forEach((actionName) =>
          currentSocket.emulateEvent(actionName)
        );

        await currentSocket.waitUntilReceived(...actionNames);

        expect(handler).toHaveBeenCalledTimes(actionNames.length);
        actionNames.forEach((actionName, index) => {
          expect(handler).toHaveBeenNthCalledWith(
            index + 1,
            expect.objectContaining({
              value: expect.objectContaining(getEventObject(actionName)),
            }),
            expect.anything(),
            expect.anything()
          );
        });
      });
      it('should be ok to subscribe multiple times without an actionMessage', async function () {
        const handler = jest.fn();
        const repeatArray = Array.from({ length: 2 });

        repeatArray.forEach(() =>
          subManager.subscribe(handler, EventType.EventTxValue)
        );
        currentSocket.emulateEvent(actionName);

        await currentSocket.waitUntilReceived(actionName);

        expect(handler).toHaveBeenCalledTimes(repeatArray.length);
        repeatArray.forEach((_, index) => {
          expect(handler).toHaveBeenNthCalledWith(
            index + 1,
            expect.objectContaining({
              value: expect.objectContaining(getEventObject(actionName)),
            }),
            expect.anything(),
            expect.anything()
          );
        });
      });
      it('should be ok to subscribe multiple times with an actionMessage', async function () {
        const handler = jest.fn();
        const repeatArray = Array.from({ length: 2 });

        repeatArray.forEach(() =>
          subManager.subscribe(handler, EventType.EventTxValue, {
            messageAction: actionName,
          })
        );
        currentSocket.emulateEvent(actionName);

        await currentSocket.waitUntilReceived(actionName);

        expect(handler).toHaveBeenCalledTimes(repeatArray.length);
        repeatArray.forEach((_, index) => {
          expect(handler).toHaveBeenNthCalledWith(
            index + 1,
            expect.objectContaining({
              value: expect.objectContaining(getEventObject(actionName)),
            }),
            expect.anything(),
            expect.anything()
          );
        });
      });
      it('should be ok to subscribe multiple times with different actionMessages', async function () {
        const handler = jest.fn();

        actionNames.forEach((actionName) =>
          subManager.subscribe(handler, EventType.EventTxValue, {
            messageAction: actionName,
          })
        );
        actionNames.forEach((actionName) =>
          currentSocket.emulateEvent(actionName)
        );

        await currentSocket.waitUntilReceived(...actionNames);

        expect(handler).toHaveBeenCalledTimes(actionNames.length);
        actionNames.forEach((actionName, index) => {
          expect(handler).toHaveBeenNthCalledWith(
            index + 1,
            expect.objectContaining({
              value: expect.objectContaining(getEventObject(actionName)),
            }),
            expect.anything(),
            expect.anything()
          );
        });
      });
      it('should be ok to ignore unregistered events', async function () {
        const handler = jest.fn();
        const otherHandler = jest.fn();

        subManager.subscribe(handler, EventType.EventTxValue, {
          messageAction: actionName,
        });
        subManager.subscribe(otherHandler, EventType.EventTxValue, {
          messageAction: otherActionName,
        });

        currentSocket.emulateEvent(actionName);
        currentSocket.emulateEvent(otherActionName);

        await currentSocket.waitUntilReceived(actionName, otherActionName);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(otherHandler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            value: expect.objectContaining(getEventObject(actionName)),
          }),
          expect.anything(),
          expect.anything()
        );
        expect(otherHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            value: expect.objectContaining(getEventObject(otherActionName)),
          }),
          expect.anything(),
          expect.anything()
        );
      });
    });

    describe('(unsubscription tests)', function () {
      it('should be able to unsubscribe from a specific event', async function () {
        const handler = jest.fn();

        subManager.subscribe(handler, EventType.EventTxValue, {
          messageAction: actionName,
        });
        subManager.unsubscribe(handler, EventType.EventTxValue, {
          messageAction: actionName,
        });

        currentSocket.emulateEvent(actionName);

        await currentSocket.waitUntilReceived(actionName);

        expect(handler).toHaveBeenCalledTimes(0);
      });
      it('should be able to unsubscribe without params', async function () {
        const handler = jest.fn();

        subManager.subscribe(handler, EventType.EventTxValue, {
          messageAction: actionName,
        });
        subManager.unsubscribe();

        currentSocket.emulateEvent(actionName);

        await currentSocket.waitUntilReceived(actionName);

        expect(handler).toHaveBeenCalledTimes(0);
      });
      it('should be able to unsubscribe from a generic subscription', async function () {
        const handler = jest.fn();

        subManager.subscribe(handler, EventType.EventTxValue);
        subManager.unsubscribe(handler, EventType.EventTxValue);

        currentSocket.emulateEvent(actionName);

        await currentSocket.waitUntilReceived(actionName);

        expect(handler).toHaveBeenCalledTimes(0);
      });
      it('should be able to unsubscribe from multiple specific subscriptions with one call', async function () {
        const handler = jest.fn();

        subManager.subscribe(handler, EventType.EventTxValue, {
          messageAction: actionName,
        });
        subManager.subscribe(handler, EventType.EventTxValue, {
          messageAction: actionName,
        });
        subManager.unsubscribe(handler, EventType.EventTxValue, {
          messageAction: actionName,
        });

        currentSocket.emulateEvent(actionName);

        await currentSocket.waitUntilReceived(actionName);

        expect(handler).toHaveBeenCalledTimes(0);
      });
      it('should be able to unsubscribe from multiple subscriptions with one fully generic call', async function () {
        const handler = jest.fn();

        actionNames.forEach((actionName) => {
          subManager.subscribe(handler, EventType.EventTxValue, {
            messageAction: actionName,
          });
        });
        subManager.unsubscribe();

        actionNames.forEach((actionName) =>
          currentSocket.emulateEvent(actionName)
        );

        await currentSocket.waitUntilReceived(...actionNames);

        expect(handler).toHaveBeenCalledTimes(0);
      });
      it('should be able to only unsubscribe from a specific subscription and not all (based on the action name)', async function () {
        const handler = jest.fn();

        actionNames.forEach((actionName) => {
          subManager.subscribe(handler, EventType.EventTxValue, {
            messageAction: actionName,
          });
        });
        subManager.unsubscribe(handler, EventType.EventTxValue, {
          messageAction: actionName,
        });

        actionNames.forEach((actionName) =>
          currentSocket.emulateEvent(actionName)
        );

        await currentSocket.waitUntilReceived(...actionNames);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenLastCalledWith(
          expect.objectContaining({
            value: expect.objectContaining(getEventObject(otherActionName)),
          }),
          expect.anything(),
          expect.anything()
        );
      });
      it('should be able to only unsubscribe from a specific subscription and not all (based on the callback)', async function () {
        const handler = jest.fn();
        const otherHandler = jest.fn();

        subManager.subscribe(handler, EventType.EventTxValue, {
          messageAction: actionName,
        });
        subManager.subscribe(otherHandler, EventType.EventTxValue, {
          messageAction: actionName,
        });
        subManager.unsubscribe(handler, EventType.EventTxValue, {
          messageAction: actionName,
        });
        currentSocket.emulateEvent(actionName);

        await currentSocket.waitUntilReceived(actionName);

        expect(handler).toHaveBeenCalledTimes(0);
        expect(otherHandler).toHaveBeenCalledTimes(1);
        expect(otherHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            value: expect.objectContaining(getEventObject(actionName)),
          }),
          expect.anything(),
          expect.anything()
        );
      });
      it('should be able to only unsubscribe from a specific subscription and not all (based on the callback but otherwise generic)', async function () {
        const handler = jest.fn();
        const otherHandler = jest.fn();

        subManager.subscribe(handler, EventType.EventTxValue, {
          messageAction: actionName,
        });
        subManager.subscribe(otherHandler, EventType.EventTxValue, {
          messageAction: actionName,
        });
        subManager.unsubscribe(handler);

        currentSocket.emulateEvent(actionName);

        await currentSocket.waitUntilReceived(actionName);

        expect(handler).toHaveBeenCalledTimes(0);
        expect(otherHandler).toHaveBeenCalledTimes(1);
        expect(otherHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            value: expect.objectContaining(getEventObject(actionName)),
          }),
          expect.anything(),
          expect.anything()
        );
      });
    });

    describe('(message subscription tests)', function () {
      it('should be able to listen for any type of message', async function () {
        const handler = jest.fn();

        subManager.subscribeMessage(handler, EventType.EventTxValue);
        currentSocket.emulateEvent(actionName);

        await currentSocket.waitUntilReceived(actionName);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(getMessageObject(actionName));
      });
      it('should be able to listen for a specific type of message', async function () {
        const { waiter, resolve } = createWaiter<MessageActionEvent>();

        subManager.subscribeMessage(resolve, EventType.EventTxValue, {
          messageAction: actionName,
        });
        currentSocket.emulateEvent(actionName);

        expect(await waiter).toStrictEqual(getMessageObject(actionName));
      });
      it('should be able to listen to multiple messages', async function () {
        const handler = jest.fn();

        subManager.subscribeMessage(handler, EventType.EventTxValue);
        actionNames.forEach((actionName) =>
          currentSocket.emulateEvent(actionName)
        );

        await currentSocket.waitUntilReceived(...actionNames);

        expect(handler).toHaveBeenCalledTimes(actionNames.length);
        actionNames.forEach((actionName, index) => {
          expect(handler).toHaveBeenNthCalledWith(
            index + 1,
            getMessageObject(actionName)
          );
        });
      });
      it('should be ok to subscribe multiple times without an actionMessage', async function () {
        const handler = jest.fn();
        const repeatArray = Array.from({ length: 2 });

        repeatArray.forEach(() =>
          subManager.subscribeMessage(handler, EventType.EventTxValue)
        );
        currentSocket.emulateEvent(actionName);

        await currentSocket.waitUntilReceived(actionName);

        expect(handler).toHaveBeenCalledTimes(repeatArray.length);
        repeatArray.forEach((_, index) => {
          expect(handler).toHaveBeenNthCalledWith(
            index + 1,
            getMessageObject(actionName)
          );
        });
      });
      it('should be ok to subscribe multiple times with an actionMessage', async function () {
        const handler = jest.fn();
        const repeatArray = Array.from({ length: 2 });

        repeatArray.forEach(() =>
          subManager.subscribeMessage(handler, EventType.EventTxValue, {
            messageAction: actionName,
          })
        );
        currentSocket.emulateEvent(actionName);

        await currentSocket.waitUntilReceived(actionName);

        expect(handler).toHaveBeenCalledTimes(repeatArray.length);
        repeatArray.forEach((_, index) => {
          expect(handler).toHaveBeenNthCalledWith(
            index + 1,
            getMessageObject(actionName)
          );
        });
      });
      it('should be ok to subscribe multiple times with different actionMessages', async function () {
        const handler = jest.fn();

        actionNames.forEach((actionName) =>
          subManager.subscribeMessage(handler, EventType.EventTxValue, {
            messageAction: actionName,
          })
        );
        actionNames.forEach((actionName) =>
          currentSocket.emulateEvent(actionName)
        );

        await currentSocket.waitUntilReceived(...actionNames);

        expect(handler).toHaveBeenCalledTimes(actionNames.length);
        actionNames.forEach((actionName, index) => {
          expect(handler).toHaveBeenNthCalledWith(
            index + 1,
            getMessageObject(actionName)
          );
        });
      });
      it('should be ok to ignore unregistered messages', async function () {
        const handler = jest.fn();
        const otherHandler = jest.fn();

        subManager.subscribeMessage(handler, EventType.EventTxValue, {
          messageAction: actionName,
        });
        subManager.subscribeMessage(otherHandler, EventType.EventTxValue, {
          messageAction: otherActionName,
        });

        currentSocket.emulateEvent(actionName);
        currentSocket.emulateEvent(otherActionName);

        await currentSocket.waitUntilReceived(actionName, otherActionName);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(otherHandler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(getMessageObject(actionName));
        expect(otherHandler).toHaveBeenCalledWith(
          getMessageObject(otherActionName)
        );
      });
    });

    describe('(message unsubscription tests)', function () {
      it('should be able to unsubscribe from a specific message', async function () {
        const handler = jest.fn();

        subManager.subscribeMessage(handler, EventType.EventTxValue, {
          messageAction: actionName,
        });
        subManager.unsubscribeMessage(handler, EventType.EventTxValue, {
          messageAction: actionName,
        });

        currentSocket.emulateEvent(actionName);

        await currentSocket.waitUntilReceived(actionName);

        expect(handler).toHaveBeenCalledTimes(0);
      });
      it('should be able to unsubscribe without params', async function () {
        const handler = jest.fn();

        subManager.subscribeMessage(handler, EventType.EventTxValue, {
          messageAction: actionName,
        });
        subManager.unsubscribeMessage();

        currentSocket.emulateEvent(actionName);

        await currentSocket.waitUntilReceived(actionName);

        expect(handler).toHaveBeenCalledTimes(0);
      });
      it('should be able to unsubscribe from a generic subscription', async function () {
        const handler = jest.fn();

        subManager.subscribeMessage(handler, EventType.EventTxValue);
        subManager.unsubscribeMessage(handler, EventType.EventTxValue);

        currentSocket.emulateEvent(actionName);

        await currentSocket.waitUntilReceived(actionName);

        expect(handler).toHaveBeenCalledTimes(0);
      });
      it('should be able to unsubscribe from multiple specific subscriptions with one call', async function () {
        const handler = jest.fn();

        subManager.subscribeMessage(handler, EventType.EventTxValue, {
          messageAction: actionName,
        });
        subManager.subscribeMessage(handler, EventType.EventTxValue, {
          messageAction: actionName,
        });
        subManager.unsubscribeMessage(handler, EventType.EventTxValue, {
          messageAction: actionName,
        });

        currentSocket.emulateEvent(actionName);

        await currentSocket.waitUntilReceived(actionName);

        expect(handler).toHaveBeenCalledTimes(0);
      });
      it('should be able to unsubscribe from multiple subscriptions with one fully generic call', async function () {
        const handler = jest.fn();

        actionNames.forEach((actionName) => {
          subManager.subscribeMessage(handler, EventType.EventTxValue, {
            messageAction: actionName,
          });
        });
        subManager.unsubscribeMessage();

        actionNames.forEach((actionName) =>
          currentSocket.emulateEvent(actionName)
        );

        await currentSocket.waitUntilReceived(...actionNames);

        expect(handler).toHaveBeenCalledTimes(0);
      });
      it('should be able to only unsubscribe from a specific subscription and not all (based on the action name)', async function () {
        const handler = jest.fn();

        actionNames.forEach((actionName) => {
          subManager.subscribeMessage(handler, EventType.EventTxValue, {
            messageAction: actionName,
          });
        });
        subManager.unsubscribeMessage(handler, EventType.EventTxValue, {
          messageAction: actionName,
        });

        actionNames.forEach((actionName) =>
          currentSocket.emulateEvent(actionName)
        );

        await currentSocket.waitUntilReceived(...actionNames);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenLastCalledWith(
          getMessageObject(otherActionName)
        );
      });
      it('should be able to only unsubscribe from a specific subscription and not all (based on the callback)', async function () {
        const handler = jest.fn();
        const otherHandler = jest.fn();

        subManager.subscribeMessage(handler, EventType.EventTxValue, {
          messageAction: actionName,
        });
        subManager.subscribeMessage(otherHandler, EventType.EventTxValue, {
          messageAction: actionName,
        });
        subManager.unsubscribeMessage(handler, EventType.EventTxValue, {
          messageAction: actionName,
        });
        currentSocket.emulateEvent(actionName);

        await currentSocket.waitUntilReceived(actionName);

        expect(handler).toHaveBeenCalledTimes(0);
        expect(otherHandler).toHaveBeenCalledTimes(1);
        expect(otherHandler).toHaveBeenCalledWith(getMessageObject(actionName));
      });
      it('should be able to only unsubscribe from a specific subscription and not all (based on the callback but otherwise generic)', async function () {
        const handler = jest.fn();
        const otherHandler = jest.fn();

        subManager.subscribeMessage(handler, EventType.EventTxValue, {
          messageAction: actionName,
        });
        subManager.subscribeMessage(otherHandler, EventType.EventTxValue, {
          messageAction: actionName,
        });
        subManager.unsubscribeMessage(handler);

        currentSocket.emulateEvent(actionName);

        await currentSocket.waitUntilReceived(actionName);

        expect(handler).toHaveBeenCalledTimes(0);
        expect(otherHandler).toHaveBeenCalledTimes(1);
        expect(otherHandler).toHaveBeenCalledWith(getMessageObject(actionName));
      });
    });
  });
});

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function createWaiter<T>() {
  let resolveCB: ((result: T) => void) | undefined;
  let alreadyCalled = false;
  let readyResult: T;
  const waiter = new Promise<T>(function (resolve) {
    if (alreadyCalled) {
      resolve(readyResult);
    } else {
      resolveCB = resolve;
    }
  });

  return { waiter, resolve: resolveWrapper };

  function resolveWrapper(result: T) {
    if (resolveCB) {
      resolveCB(result);
    } else {
      readyResult = result;
      alreadyCalled = true;
    }
  }
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

function getEventObject(actionName: string) {
  return {
    TxResult: {
      result: {
        events: [
          {
            attributes: [
              {
                key: 'bW9kdWxl',
                value: 'ZHVhbGl0eQ==',
              },
              {
                key: Buffer.from('action').toString('base64'),
                value: Buffer.from(actionName).toString('base64'),
              },
            ],
          },
        ],
      },
    },
  };
}

function getMessageObject(actionName: string) {
  return {
    module: 'duality',
    action: actionName,
  };
}
