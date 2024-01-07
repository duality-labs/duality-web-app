/* eslint-disable @typescript-eslint/no-explicit-any */

import { SigningStargateClient } from '@cosmjs/stargate';

import { useEffect, useState } from 'react';
import { useWeb3 } from '../../lib/web3/useWeb3';
import { toast } from '../../components/Notifications';
import { useDualitySigningClient } from './useClients';

type ExtractMethodNames<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];
type SigningStargateClientMethods = ExtractMethodNames<SigningStargateClient>;
const signingStargateClientMethods: Array<SigningStargateClientMethods> = [
  'simulate',
  'sendTokens',
  'delegateTokens',
  'undelegateTokens',
  'withdrawRewards',
  'sendIbcTokens',
  'signAndBroadcast',
  'signAndBroadcastSync',
  'sign',
  'getChainId',
  'getHeight',
  'getAccount',
  'getSequence',
  'getBlock',
  'getBalance',
  'getAllBalances',
  'getBalanceStaked',
  'getDelegation',
  'getTx',
  'searchTx',
  'disconnect',
  'broadcastTx',
  'broadcastTxSync',
];

interface SigningClientFrameMessage<T extends SigningStargateClientMethods> {
  id: number;
  type: T;
  args: Parameters<SigningStargateClient[T]>;
}

interface NotificationOptions {
  style?: 'loading' | 'success' | 'error' | 'blank';
  heading: string;
  body?: string;
  link?: string;
  dismissable?: boolean;
}

class FrameClient {
  private messagePort: MessagePort;
  constructor(messagePort: MessagePort) {
    this.messagePort = messagePort;
  }

  subscribeToFrameHeight(onFrameHeight: (height: number) => void) {
    const handleEvent = (event: MessageEvent) => {
      if (event.data?.type === 'frameHeight') {
        // forward to any listeners
        const height: number = event.data.height;
        onFrameHeight(height);
      }
    };
    // add listener and return cleanup function
    this.messagePort.addEventListener('message', handleEvent);
    return () => this.messagePort.removeEventListener('message', handleEvent);
  }

  // forward notifications to our UI
  subscribeToFrameNotifications() {
    const handleEvent = (event: MessageEvent) => {
      if (event.data?.type === 'showNotification') {
        const {
          style,
          heading,
          body,
          link,
          dismissable,
          ...rest
        }: NotificationOptions = event.data.opts;
        const opts = {
          ...rest,
          description: body,
          descriptionLink: link,
          dismissable: dismissable,
        };
        try {
          switch (style) {
            case 'loading':
              return toast.loading(heading, opts);
            case 'success':
              return toast.success(heading, opts);
            case 'error':
              return toast.error(heading, opts);
            default:
              return toast.blank(heading, opts);
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('error in frame message:', e, event);
        }
      }
    };
    // add listener and return cleanup function
    this.messagePort.addEventListener('message', handleEvent);
    return () => this.messagePort.removeEventListener('message', handleEvent);
  }

  // listen to SigningStargateClient method calls from the frame
  subscribeToFrameSigningClientMessages<
    T extends Array<SigningStargateClientMethods>
  >(
    messageDataTypes: T,
    eventCallback: (event: SigningClientFrameMessage<T[number]>) => void
  ): () => void {
    const handleEvent = (event: MessageEvent) => {
      if (messageDataTypes.includes(event.data.type)) {
        try {
          eventCallback(event.data);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('error in frame message:', e, event);
        }
      }
    };
    // add listener and return cleanup function
    this.messagePort.addEventListener('message', handleEvent);
    return () => this.messagePort.removeEventListener('message', handleEvent);
  }
}

// if you use the same origin more than once, the last connected one will be set
export default function useFrameMessaging(uniqueOriginURL: URL | string) {
  // subscribe to initialization of this frame to set the message port
  const messagePort = useFrameInitialization(uniqueOriginURL);

  // setup notification listening
  useFrameNotifications(messagePort);

  // forward signing client messages to the signing client
  useFrameMessagingForwarding(messagePort);

  return messagePort;
}

// the ready key is more unique because it must be listened to on the top window
const ready = 'dex-frame-messaging:initialize';
function subscribeToFrameMessage<T extends typeof ready = typeof ready>(
  messageDataType: T,
  eventCallback: (event: MessageEvent<{ type: T; args: any }>) => void,
  allowedOrigin: string,
  opts?: AddEventListenerOptions
): () => void {
  const handleEvent = (event: MessageEvent) => {
    // console.log('unfiltered message event', event.data?.type, event)
    if (
      event.origin === allowedOrigin &&
      event.data?.type === messageDataType
    ) {
      try {
        eventCallback(event);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('error in frame message:', e, event);
      }
    }
  };
  // add listener and return cleanup function
  window.addEventListener('message', handleEvent, opts);
  return () => window.removeEventListener('message', handleEvent);
}

function useFrameInitialization(url: URL | string): MessagePort | undefined {
  const allowedOrigin = new URL(url).origin;
  const [messagePort, setMessagePort] = useState<MessagePort>();

  // subscribe to initialization of this frame to set the message port
  useEffect(() => {
    let closePort: () => void;
    const unsubscribe = subscribeToFrameMessage(
      'dex-frame-messaging:initialize',
      (e) => {
        const messagePort = e.ports?.at(0);
        if (messagePort) {
          // start port to start receiving messages
          messagePort.start();
          // set port to state
          setMessagePort(messagePort);
          // send response to port
          messagePort.postMessage({ type: 'dex-frame-messaging:initialized' });
          // add cleanup for port
          closePort = () => messagePort.close();
        }
      },
      allowedOrigin
    );
    return () => {
      closePort?.();
      unsubscribe();
    };
  }, [allowedOrigin]);

  return messagePort;
}

export function useFrameHeight(messagePort: MessagePort | undefined) {
  // save height to state
  const [desiredHeight, setDesiredHeight] = useState<number>();
  // subscribe when port is ready
  useEffect(() => {
    if (messagePort) {
      const frameClient = new FrameClient(messagePort);
      return frameClient.subscribeToFrameHeight((height) =>
        setDesiredHeight(height)
      );
    }
  }, [messagePort]);
  return desiredHeight;
}

function useFrameNotifications(messagePort: MessagePort | undefined) {
  useEffect(() => {
    if (messagePort) {
      const frameClient = new FrameClient(messagePort);
      return frameClient.subscribeToFrameNotifications();
    }
  }, [messagePort]);
}

function useFrameMessagingForwarding(
  messagePort: MessagePort | undefined,
  rpcEndpoint?: string
) {
  const { wallet: signer } = useWeb3();
  const client = useDualitySigningClient(signer, rpcEndpoint);

  // subscribe to signing client requests
  useEffect(() => {
    if (signer && messagePort && client) {
      const frameClient = new FrameClient(messagePort);
      return frameClient.subscribeToFrameSigningClientMessages(
        signingStargateClientMethods,
        async ({ id, type, args }) => {
          // note: type hack is because its hard to tell TypeScript
          //       that the args will match the given method
          return (client[type] as any)(...args)
            .then((response: any = null) => {
              messagePort.postMessage({ id, type, response });
              return response;
            })
            .catch((error: any) => {
              messagePort.postMessage({ id, type, error });
              throw error;
            });
        }
      );
    }
  }, [client, signer, messagePort]);
}
