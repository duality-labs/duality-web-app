import {
  createSubscriptionManager,
  EventType,
  SubscriptionManager,
  WebSocketClientMessage,
  WebSocketServerMessage,
} from './events';

const url = 'ws://localhost:1234';

function createCustomActionEvent(
  id: number,
  actionName: string,
  attributes: { [key: string]: string } = {},
  options?: CustomEventOptions
) {
  return createCustomEvent(id, { ...attributes, action: actionName }, options);
}

interface CustomEventOptions {
  type?: string;
}

function createCustomEvent(
  id: number,
  attributes: { [key: string]: string } = {},
  options: CustomEventOptions = {},
  eventType = 'message'
): WebSocketServerMessage {
  const eventData: { [key: string]: string } = {
    module: 'duality',
    ...attributes,
  };
  const { type = 'tendermint/event/Tx' } = options;
  return {
    id: id,
    result: {
      query: `tm.event='Tx'${
        attributes.action ? ` AND message.action='${attributes.action}'` : ''
      }`,
      data: {
        type,
        value: {
          TxResult: {
            result: {
              events: [
                {
                  type: eventType,
                  attributes: Object.entries(eventData).map(([key, value]) => ({
                    key,
                    value,
                  })),
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
  };
}

describe('The event subscription manager', function () {
  let server: WS;
  let subManager: SubscriptionManager;

  describe('The event subscription manager', function () {
    afterEach(() => {
      // should call the following line for safety but it prints a large warning everytime
      // jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    beforeEach(function () {
      server = new WS(url);
    });
    afterEach(async function () {
      server?.close();
      await server?.closed;
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
      subManager.addSocketListener('open', () => server.error());
      subManager.open();
    });

    it('should be able to call close without an open connection', function () {
      subManager = createSubscriptionManager(url);
      subManager.close();
      expect(subManager.isOpen()).toBe(false);
    });

    it('should be able to call open twice without opening two sockets', async function () {
      const handler = jest.fn();
      subManager = createSubscriptionManager(url);
      subManager.addSocketListener('open', handler);
      subManager.open();
      subManager.open();
      await server.connected;
      await delay(0);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should be able to open, close and reopen a connection', async function () {
      const handler = jest.fn();
      subManager = createSubscriptionManager(url);
      subManager.addSocketListener('open', handler);
      subManager.open();
      subManager.close();
      subManager.open();
      await server.connected;
      await delay(0);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(subManager.isOpen()).toBe(true);
    });

    it('should be able to open, wait, close and reopen a connection', async function () {
      const handler = jest.fn();
      subManager = createSubscriptionManager(url);
      subManager.addSocketListener('open', handler);
      const reopenedPromise = new Promise((resolve) => {
        // wait for open confirmation to close server
        subManager.addSocketListener('open', onOpen);
        function onOpen() {
          subManager.removeSocketListener('open', onOpen);
          server.close();
          server = new WS(url);
        }
        // wait for a reopening confirmation
        subManager.addSocketListener('close', onClose);
        async function onClose() {
          subManager.removeSocketListener('close', onClose);
          await delay(0);
          subManager.addSocketListener('open', resolve);
          subManager.open();
        }
      });
      subManager.open();
      await reopenedPromise;
      expect(handler).toHaveBeenCalledTimes(2);
      expect(subManager.isOpen()).toBe(true);
    });

    it('should be able to able to reconnect after a "network error"', async function () {
      const handler = jest.fn();
      subManager = createSubscriptionManager(url);
      subManager.addSocketListener('open', handler);
      const reopenedPromise = new Promise((resolve) => {
        // wait for open confirmation to throw error from server
        subManager.addSocketListener('open', onOpen);
        async function onOpen() {
          subManager.removeSocketListener('open', onOpen);
          jest.useFakeTimers({ legacyFakeTimers: false });
          server.close({
            code: 1001,
            reason: 'server blip',
            wasClean: false,
          });
          await server.closed;
          server = new WS(url);
          // speed up reconnection waiting time
          jest.advanceTimersByTime(10000);
          await server.connected;
          jest.useRealTimers();
        }
        // wait for a reopening confirmation
        subManager.addSocketListener('close', onClose);
        function onClose() {
          subManager.removeSocketListener('close', onClose);
          subManager.addSocketListener('open', resolve);
        }
      });
      subManager.open();
      await reopenedPromise;

      expect(handler).toHaveBeenCalledTimes(2);
      expect(subManager.isOpen()).toBe(true);
    });

    it('should not be affected by a fake clean close event', async function () {
      const handler = jest.fn();
      subManager = createSubscriptionManager(url);
      subManager.addSocketListener('open', handler);
      subManager.open();
      await new Promise<Event | undefined>((resolve) => {
        // wait for a close confirmation
        subManager.addSocketListener('close', resolve);
        // wait for open confirmation to close WebSocket server
        subManager.addSocketListener('open', onOpen);
        function onOpen() {
          server.close();
          server = new WS(url);
          subManager.removeSocketListener('open', onOpen);
        }
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(subManager.isOpen()).toBe(false);
    });
  });

  describe('should be able to manage subscribing', function () {
    const actionName = 'Test';
    const otherActionName = 'steT';
    const actionNames = [actionName, otherActionName];

    beforeEach(function (done) {
      server = new WS(url, { jsonProtocol: true });
      subManager = createSubscriptionManager(url);
      subManager.open();
      subManager.addSocketListener('open', () => {
        // ensure server also thinks it is connected
        server.connected.then(() => done());
      });
    });

    afterEach(function () {
      subManager.close();
      server.close();
    });

    describe('(subscription tests)', function () {
      it('should be able to listen for any type of event', async function () {
        const handler = jest.fn();
        subManager.subscribe(handler, {});
        const [id] = await resolveQueuedMessageIDs(server);
        const message = createCustomEvent(id);
        server.send(message);

        expect(handler).toHaveBeenCalledWith(
          message.result.data,
          expect.anything(),
          expect.anything()
        );
      });
      it('should be able to listen for a specific type of event', async function () {
        const handler = jest.fn();
        const otherHandler = jest.fn();
        subManager.subscribe(handler, {}, EventType.EventTxValue);
        subManager.subscribe(otherHandler, {}, EventType.EventNewBlockValue);
        const [id, id2] = await resolveQueuedMessageIDs(server);
        const message1 = createCustomEvent(
          id,
          {},
          { type: 'tendermint/event/Tx' }
        );
        // TODO: the subscription will listen to all types of events passed on the same id.
        // we rely on the WebSocket server to track the subscriptions correctly
        // and to always be in sync with the client in regards to the id and its expected type.
        // however, it is impossible for the server to always be in sync with the client.
        // to simulate correct behaviour we change the id number here to mismatch the subscription.
        const message2 = createCustomEvent(
          id2,
          {},
          { type: 'tendermint/event/NewBlock' }
        );
        server.send(message1);
        server.send(message2);

        expect(handler).toHaveBeenCalledWith(
          message1.result.data,
          expect.anything(),
          expect.anything()
        );
        expect(handler).not.toHaveBeenCalledWith(
          message2.result.data,
          expect.anything(),
          expect.anything()
        );
        expect(otherHandler).not.toHaveBeenCalledWith(
          message1.result.data,
          expect.anything(),
          expect.anything()
        );
        expect(otherHandler).toHaveBeenCalledWith(
          message2.result.data,
          expect.anything(),
          expect.anything()
        );
      });
      it('should be able to listen to multiple events', async function () {
        const handler = jest.fn();
        subManager.subscribe(handler, {});
        const [id] = await resolveQueuedMessageIDs(server);
        actionNames.forEach((actionName) => {
          const message = createCustomActionEvent(id, actionName);
          server.send(message);
          expect(handler).toHaveBeenCalledWith(
            message.result.data,
            expect.anything(),
            expect.anything()
          );
          // clear the handler for the next iteration
          handler.mockClear();
        });
      });
      it('should be able to listen to multiple events of any type', async function () {
        const handler = jest.fn();
        subManager.subscribe(handler, {});
        const [id] = await resolveQueuedMessageIDs(server);
        const message1 = createCustomEvent(
          id,
          {},
          { type: 'tendermint/event/Tx' }
        );
        const message2 = createCustomEvent(
          id,
          {},
          { type: 'tendermint/event/Custom' }
        );
        server.send(message1);
        server.send(message2);

        expect(handler).toHaveBeenCalledWith(
          message1.result.data,
          expect.anything(),
          expect.anything()
        );
        expect(handler).toHaveBeenCalledWith(
          message2.result.data,
          expect.anything(),
          expect.anything()
        );
      });
      it('should be ok to subscribe multiple times without an actionMessage', async function () {
        const handler = jest.fn();
        const repeatArray = Array.from({ length: 2 });
        repeatArray.forEach(() => subManager.subscribe(handler, {}));
        const [id] = await resolveQueuedMessageIDs(server);
        const message = createCustomActionEvent(id, actionName);
        server.send(message);
        repeatArray.forEach((_, index) => {
          expect(handler).toHaveBeenNthCalledWith(
            index + 1,
            message.result.data,
            expect.anything(),
            expect.anything()
          );
        });
      });
      it('should be ok to subscribe multiple times with an actionMessage', async function () {
        const handler = jest.fn();
        const repeatArray = Array.from({ length: 2 });
        repeatArray.forEach(() =>
          subManager.subscribe(handler, {
            message: { action: actionName },
          })
        );
        const [id] = await resolveQueuedMessageIDs(server);
        const message = createCustomActionEvent(id, actionName);
        server.send(message);
        repeatArray.forEach((_, index) => {
          expect(handler).toHaveBeenNthCalledWith(
            index + 1,
            message.result.data,
            expect.anything(),
            expect.anything()
          );
        });
      });
      it('should be ok to subscribe multiple times with different actionMessages', async function () {
        const handler = jest.fn();

        actionNames.forEach((actionName) =>
          subManager.subscribe(handler, {
            message: { action: actionName },
          })
        );
        const [id] = await resolveQueuedMessageIDs(server);
        actionNames.forEach((actionName, index) => {
          const message = createCustomActionEvent(id, actionName);
          server.send(message);
          expect(handler).toHaveBeenNthCalledWith(
            index + 1,
            message.result.data,
            expect.anything(),
            expect.anything()
          );
        });
      });

      it('should be ok to ignore unregistered events', async function () {
        const handler = jest.fn();
        const otherHandler = jest.fn();
        subManager.subscribe(handler, {
          message: { action: actionName },
        });
        subManager.subscribe(otherHandler, {
          message: { action: otherActionName },
        });
        const [id1, id2] = await resolveQueuedMessageIDs(server);
        const message1 = createCustomEvent(
          id1,
          {},
          { type: 'tendermint/event/Tx' }
        );
        const message2 = createCustomEvent(
          id2,
          {},
          { type: 'tendermint/event/Custom' }
        );
        server.send(message1);
        server.send(message2);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(otherHandler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(
          message1.result.data,
          expect.anything(),
          expect.anything()
        );
        expect(otherHandler).toHaveBeenCalledWith(
          message2.result.data,
          expect.anything(),
          expect.anything()
        );
      });
    });

    describe('(unsubscription tests)', function () {
      it('should be able to unsubscribe from a specific event', async function () {
        const handler = jest.fn();

        subManager.subscribe(handler, {
          message: { action: actionName },
        });
        const [id] = await resolveQueuedMessageIDs(server);
        subManager.unsubscribe(handler, {
          message: { action: actionName },
        });

        const message = createCustomActionEvent(id, actionName);
        server.send(message);

        expect(handler).toHaveBeenCalledTimes(0);
      });
      it('should be able to unsubscribe without params', async function () {
        const handler = jest.fn();

        subManager.subscribe(handler, {
          message: { action: actionName },
        });
        const [id] = await resolveQueuedMessageIDs(server);
        subManager.unsubscribe();

        const message = createCustomActionEvent(id, actionName);
        server.send(message);

        expect(handler).toHaveBeenCalledTimes(0);
      });
      it('should be able to unsubscribe from a generic subscription', async function () {
        const handler = jest.fn();

        subManager.subscribe(handler, {});
        const [id] = await resolveQueuedMessageIDs(server);
        subManager.unsubscribe(handler);

        const message = createCustomActionEvent(id, actionName);
        server.send(message);

        expect(handler).toHaveBeenCalledTimes(0);
      });
      it('should be able to unsubscribe from multiple specific subscriptions with one call', async function () {
        const handler = jest.fn();

        subManager.subscribe(handler, {
          message: { action: actionName },
        });
        subManager.subscribe(handler, {
          message: { action: actionName },
        });
        const [id] = await resolveQueuedMessageIDs(server);
        subManager.unsubscribe(handler, {
          message: { action: actionName },
        });

        const message = createCustomActionEvent(id, actionName);
        server.send(message);

        expect(handler).toHaveBeenCalledTimes(0);
      });
      it('should be able to unsubscribe from multiple subscriptions with one fully generic call', async function () {
        const handler = jest.fn();

        actionNames.forEach((actionName) => {
          subManager.subscribe(handler, {
            message: { action: actionName },
          });
        });
        const messageIDs = await resolveQueuedMessageIDs(server);
        subManager.unsubscribe();
        actionNames.forEach((actionName, index) => {
          const id = messageIDs[index];
          const message = createCustomActionEvent(id, actionName);
          server.send(message);
        });

        expect(handler).toHaveBeenCalledTimes(0);
      });
      it('should be able to unsubscribe from multiple subscriptions with one fully generic call (using resolveAllQueuedMessages)', async function () {
        const handler = jest.fn();

        actionNames.forEach((actionName) => {
          subManager.subscribe(handler, {
            message: { action: actionName },
          });
        });
        const messageIDs = await resolveQueuedMessageIDs(server);
        subManager.unsubscribe();
        actionNames.forEach((actionName, index) => {
          const id = messageIDs[index];
          const message = createCustomActionEvent(id, actionName);
          server.send(message);
        });

        expect(handler).toHaveBeenCalledTimes(0);
      });
      it('should be able to only unsubscribe from a specific subscription and not all (based on the action name)', async function () {
        const handler = jest.fn();

        actionNames.forEach((actionName) => {
          subManager.subscribe(handler, {
            message: { action: actionName },
          });
        });
        const messageIDs = await resolveQueuedMessageIDs(server);
        subManager.unsubscribe(handler, {
          message: { action: actionName },
        });

        const messages = actionNames.map((actionName, index) => {
          const id = messageIDs[index];
          const message = createCustomActionEvent(id, actionName);
          server.send(message);
          return message;
        });

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenLastCalledWith(
          messages[1].result.data,
          expect.anything(),
          expect.anything()
        );
      });
      it('should be able to only unsubscribe from a specific subscription and not all (based on the callback)', async function () {
        const handler = jest.fn();
        const otherHandler = jest.fn();

        subManager.subscribe(handler, {
          message: { action: actionName },
        });
        subManager.subscribe(otherHandler, {
          message: { action: actionName },
        });
        // both subscriptions use the same id
        const [id] = await resolveQueuedMessageIDs(server);
        subManager.unsubscribe(handler, {
          message: { action: actionName },
        });

        const message = createCustomActionEvent(id, actionName);
        server.send(message);

        expect(handler).toHaveBeenCalledTimes(0);
        expect(otherHandler).toHaveBeenCalledTimes(1);
        expect(otherHandler).toHaveBeenCalledWith(
          message.result.data,
          expect.anything(),
          expect.anything()
        );
      });
      it('should be able to only unsubscribe from a specific subscription and not all (based on the callback but otherwise generic)', async function () {
        const handler = jest.fn();
        const otherHandler = jest.fn();

        subManager.subscribe(handler, {
          message: { action: actionName },
        });
        subManager.subscribe(otherHandler, {
          message: { action: actionName },
        });
        // both subscriptions use the same id
        const [id] = await resolveQueuedMessageIDs(server);
        subManager.unsubscribe(handler);

        const message = createCustomActionEvent(id, actionName);
        server.send(message);

        expect(handler).toHaveBeenCalledTimes(0);
        expect(otherHandler).toHaveBeenCalledTimes(1);
        expect(otherHandler).toHaveBeenCalledWith(
          message.result.data,
          expect.anything(),
          expect.anything()
        );
      });
    });

    describe('(message subscription tests)', function () {
      it('should be able to listen for any type of message', async function () {
        const handler = jest.fn();

        subManager.subscribeMessage(handler, {});

        const [id] = await resolveQueuedMessageIDs(server);
        const message = createCustomActionEvent(id, actionName);
        server.send(message);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(
          getMessageObject(actionName),
          getTxObject(actionName)
        );
      });
      it('should be able to listen for a specific type of message', async function () {
        const handler = jest.fn();

        subManager.subscribeMessage(handler, {
          message: { action: actionName },
        });

        const [id] = await resolveQueuedMessageIDs(server);
        const message = createCustomActionEvent(id, actionName);
        server.send(message);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(
          getMessageObject(actionName),
          getTxObject(actionName)
        );
      });
      it('should be able to listen to multiple messages', async function () {
        const handler = jest.fn();

        subManager.subscribeMessage(handler, {});
        const [id] = await resolveQueuedMessageIDs(server);
        actionNames.forEach((actionName) => {
          const message = createCustomActionEvent(id, actionName);
          server.send(message);
        });

        expect(handler).toHaveBeenCalledTimes(actionNames.length);

        actionNames.forEach((actionName, index) => {
          expect(handler).toHaveBeenNthCalledWith(
            index + 1,
            getMessageObject(actionName),
            getTxObject(actionName)
          );
        });
      });
      it('should be ok to subscribe multiple times without an actionMessage', async function () {
        const handler = jest.fn();
        const repeatArray = Array.from({ length: 2 });

        repeatArray.forEach(() => subManager.subscribeMessage(handler, {}));
        const [id] = await resolveQueuedMessageIDs(server);
        const message = createCustomActionEvent(id, actionName);
        server.send(message);

        expect(handler).toHaveBeenCalledTimes(repeatArray.length);
        repeatArray.forEach((_, index) => {
          expect(handler).toHaveBeenNthCalledWith(
            index + 1,
            getMessageObject(actionName),
            getTxObject(actionName)
          );
        });
      });
      it('should be ok to subscribe multiple times with an actionMessage', async function () {
        const handler = jest.fn();
        const repeatArray = Array.from({ length: 2 });

        repeatArray.forEach(() =>
          subManager.subscribeMessage(handler, {
            message: { action: actionName },
          })
        );
        const [id] = await resolveQueuedMessageIDs(server);
        const message = createCustomActionEvent(id, actionName);
        server.send(message);

        expect(handler).toHaveBeenCalledTimes(repeatArray.length);
        repeatArray.forEach((_, index) => {
          expect(handler).toHaveBeenNthCalledWith(
            index + 1,
            getMessageObject(actionName),
            getTxObject(actionName)
          );
        });
      });
      it('should be ok to subscribe multiple times with different actionMessages', async function () {
        const handler = jest.fn();

        actionNames.forEach((actionName) =>
          subManager.subscribeMessage(handler, {
            message: { action: actionName },
          })
        );

        const messageIDs = await resolveQueuedMessageIDs(server);
        actionNames.forEach((actionName, index) => {
          const id = messageIDs[index];
          const message = createCustomActionEvent(id, actionName);
          server.send(message);
        });
        expect(handler).toHaveBeenCalledTimes(actionNames.length);
        actionNames.forEach((actionName, index) => {
          expect(handler).toHaveBeenNthCalledWith(
            index + 1,
            getMessageObject(actionName),
            getTxObject(actionName)
          );
        });
      });
      it('should be ok to ignore unregistered messages', async function () {
        const handler = jest.fn();
        const otherHandler = jest.fn();

        subManager.subscribeMessage(handler, {
          message: { action: actionName },
        });
        subManager.subscribeMessage(otherHandler, {
          message: { action: otherActionName },
        });

        const messageIDs = await resolveQueuedMessageIDs(server);
        actionNames.forEach((actionName, index) => {
          const id = messageIDs[index];
          const message = createCustomActionEvent(id, actionName);
          server.send(message);
        });

        expect(handler).toHaveBeenCalledTimes(1);
        expect(otherHandler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(
          getMessageObject(actionName),
          getTxObject(actionName)
        );
        expect(otherHandler).toHaveBeenCalledWith(
          getMessageObject(otherActionName),
          getTxObject(otherActionName)
        );
      });
    });

    describe('(message unsubscription tests)', function () {
      it('should be able to unsubscribe from a specific message', async function () {
        const handler = jest.fn();

        subManager.subscribeMessage(handler, {
          message: { action: actionName },
        });
        const [id] = await resolveQueuedMessageIDs(server);
        subManager.unsubscribeMessage(handler, {
          message: { action: actionName },
        });
        const message = createCustomActionEvent(id, actionName);
        server.send(message);

        expect(handler).toHaveBeenCalledTimes(0);
      });
      it('should be able to unsubscribe without params', async function () {
        const handler = jest.fn();

        subManager.subscribeMessage(handler, {
          message: { action: actionName },
        });
        const [id] = await resolveQueuedMessageIDs(server);
        subManager.unsubscribeMessage();
        const message = createCustomActionEvent(id, actionName);
        server.send(message);

        expect(handler).toHaveBeenCalledTimes(0);
      });
      it('should be able to unsubscribe from a generic subscription', async function () {
        const handler = jest.fn();

        subManager.subscribeMessage(handler, {});
        const [id] = await resolveQueuedMessageIDs(server);
        subManager.unsubscribeMessage(handler);
        const message = createCustomActionEvent(id, actionName);
        server.send(message);

        expect(handler).toHaveBeenCalledTimes(0);
      });
      it('should be able to unsubscribe from multiple specific subscriptions with one call', async function () {
        const handler = jest.fn();

        subManager.subscribeMessage(handler, {
          message: { action: actionName },
        });
        subManager.subscribeMessage(handler, {
          message: { action: actionName },
        });
        const [id] = await resolveQueuedMessageIDs(server);
        subManager.unsubscribeMessage(handler, {
          message: { action: actionName },
        });
        const message = createCustomActionEvent(id, actionName);
        server.send(message);

        expect(handler).toHaveBeenCalledTimes(0);
      });
      it('should be able to unsubscribe from multiple subscriptions with one fully generic call', async function () {
        const handler = jest.fn();

        actionNames.forEach((actionName) => {
          subManager.subscribeMessage(handler, {
            message: { action: actionName },
          });
        });
        subManager.unsubscribeMessage();

        const messageIDs = await resolveQueuedMessageIDs(server);
        actionNames.forEach((actionName, index) => {
          const id = messageIDs[index];
          const message = createCustomActionEvent(id, actionName);
          server.send(message);
        });

        expect(handler).toHaveBeenCalledTimes(0);
      });
      it('should be able to only unsubscribe from a specific subscription and not all (based on the action name)', async function () {
        const handler = jest.fn();

        actionNames.forEach((actionName) => {
          subManager.subscribeMessage(handler, {
            message: { action: actionName },
          });
        });
        subManager.unsubscribeMessage(handler, {
          message: { action: actionName },
        });

        const messageIDs = await resolveQueuedMessageIDs(server);
        actionNames.forEach((actionName, index) => {
          const id = messageIDs[index];
          const message = createCustomActionEvent(id, actionName);
          server.send(message);
        });

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenLastCalledWith(
          getMessageObject(otherActionName),
          getTxObject(otherActionName)
        );
      });
      it('should be able to only unsubscribe from a specific subscription and not all (based on the callback)', async function () {
        const handler = jest.fn();
        const otherHandler = jest.fn();

        subManager.subscribeMessage(handler, {
          message: { action: actionName },
        });
        subManager.subscribeMessage(otherHandler, {
          message: { action: actionName },
        });
        const [id] = await resolveQueuedMessageIDs(server);
        subManager.unsubscribeMessage(handler, {
          message: { action: actionName },
        });
        const message = createCustomActionEvent(id, actionName);
        server.send(message);

        expect(handler).toHaveBeenCalledTimes(0);
        expect(otherHandler).toHaveBeenCalledTimes(1);
        expect(otherHandler).toHaveBeenCalledWith(
          getMessageObject(actionName),
          getTxObject(actionName)
        );
      });
      it('should be able to only unsubscribe from a specific subscription and not all (based on the callback but otherwise generic)', async function () {
        const handler = jest.fn();
        const otherHandler = jest.fn();

        subManager.subscribeMessage(handler, {
          message: { action: actionName },
        });
        subManager.subscribeMessage(otherHandler, {
          message: { action: actionName },
        });
        const [id] = await resolveQueuedMessageIDs(server);
        subManager.unsubscribeMessage(handler);

        const message = createCustomActionEvent(id, actionName);
        server.send(message);

        expect(handler).toHaveBeenCalledTimes(0);
        expect(otherHandler).toHaveBeenCalledTimes(1);
        expect(otherHandler).toHaveBeenCalledWith(
          getMessageObject(actionName),
          getTxObject(actionName)
        );
      });
    });
  });
});

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function getMessageObject(actionName: string) {
  return {
    'message.module': 'duality',
    'message.action': actionName,
  };
}

function getTxObject(actionName: string) {
  return {
    type: 'tendermint/event/Tx',
    value: {
      TxResult: {
        result: {
          events: [
            {
              attributes: [
                { key: 'module', value: 'duality' },
                { key: 'action', value: actionName },
              ],
              type: 'message',
            },
          ],
        },
      },
    },
  };
}

function getClientMessageID(message: Awaited<WS['nextMessage']>) {
  const { id } = message as WebSocketClientMessage;
  return id;
}

async function resolveQueuedMessages(server: WS) {
  const messages: Array<Awaited<WS['nextMessage']>> = [];
  await new Promise<void>(async (resolve) => {
    messages.push(await server.nextMessage);
    await delay(1);
    while (server.messagesToConsume.pendingItems.length > 0) {
      messages.push(await server.nextMessage);
    }
    resolve();
  });
  return messages;
}

async function resolveQueuedMessageIDs(server: WS) {
  const messages = await resolveQueuedMessages(server);
  return messages.map(getClientMessageID);
}
