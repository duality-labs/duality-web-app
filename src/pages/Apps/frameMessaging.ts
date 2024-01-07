import { DeliverTxResponse, SigningStargateClient } from '@cosmjs/stargate';
import { GeneratedType, OfflineSigner } from '@cosmjs/proto-signing';
import useSWRSubscription, { SWRSubscription } from 'swr/subscription';
import { Tendermint37Client } from '@cosmjs/tendermint-rpc';
import useSWRImmutable from 'swr/immutable';

import { getSigningDualityClient, getSigningDualityClientOptions, useRpcClient } from '@duality-labs/dualityjs';
import { useEffect, useRef, useState } from 'react';
import { getRpcClient } from '../../lib/web3/rpcQueryClient';
import { useWeb3 } from '../../lib/web3/useWeb3';

const { REACT_APP__RPC_API: defaultRpcEndpoint = '' } = import.meta.env;

// create single Tendermint37 connection for any signing client of this endpoint
export function useTendermintClient(rpcEndpoint: string) {
  return useSWRImmutable(['rpc', rpcEndpoint], async () => {
    return Tendermint37Client.connect(rpcEndpoint);
  }).data;
}

// create RPC tx signing clients from a cached base client

export function useDualitySigningClient(
  wallet: OfflineSigner | null,
  rpcEndpoint = defaultRpcEndpoint,
  defaultTypes?: ReadonlyArray<[string, GeneratedType]>
): SigningStargateClient | undefined {
  const tmClient = useTendermintClient(rpcEndpoint);

  const [signingClient, setSigningClient] = useState<SigningStargateClient>();
  useEffect(() => {
    // remove previous client
    setSigningClient(undefined);

    // create a new signing client for each wallet
    // start promise, but doesn't set the state if cleanup has triggered
    let cancel = false;
    if (tmClient && wallet) {
      SigningStargateClient.createWithSigner(
        tmClient,
        wallet,
        getSigningDualityClientOptions({ defaultTypes })
      ).then((client) => {
        if (!cancel) {
          setSigningClient(client);
        }
      });
    }

    return () => {
      cancel = true;
    };
  }, [tmClient, wallet, defaultTypes]);
  return signingClient;
}


type ASDF = keyof SigningStargateClient;

const allowedOriginRegex = /^https:\/\/\[a-z0-9-]+.csb\.app$/;

const a: ASDF = 'signAndBroadcast';

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

// type CheckIfThisEqualsNever = Exclude<
//   SigningStargateClientMethods,
//   typeof signingStargateClientMethods[number]
// >;

interface FrameMessage<T extends SigningStargateClientMethods> {
  id: number,
  type: T;
  args: Parameters<SigningStargateClient[T]>;
}

// type FrameMessageSignAndBroadcast = FrameMessage<'sign'>;

// const t: FrameMessageSignAndBroadcast = {
//   type: 'sign',
//   args: ['a', [], { amount: [{ amount: '1', denom: 'uatom' }], gas: '0' }, ''],
// };
// const t2: FrameMessage<'signAndBroadcast'> = {
//   type: 'signAndBroadcast',
//   args: ['a', [], 'auto'],
// };

function messageFilterCreator(
  eventTypes: string | string[],
  allowedOrigin: string
) {
  const eventTypesArray = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
  return (event: MessageEvent) => {
    return (
      event.origin === allowedOrigin &&
      eventTypesArray.includes(event.data.type)
    );
  };
}

// export function subscribeToFrameMessage<T extends 'initialize'>(
//   messageDataType: T,
//   eventCallback: (event: { type: T }) => void,
//   allowedOrigin: string
// ): () => void;
// export function subscribeToFrameMessage<T extends SigningStargateClientMethods>(
//   messageDataType: T,
//   eventCallback: (event: FrameMessage<T>) => void,
//   allowedOrigin: string
// ): () => void;
// export function subscribeToFrameMessage<
//   T extends SigningStargateClientMethods | 'initialize'
// >(
//   messageDataType: T,
//   eventCallback: (
//     event: FrameMessage<Exclude<T, 'initialize'>> | { type: T; args: any }
//   ) => void,
//   allowedOrigin: string
// ): () => void


// the ready key is more unique because it must be listened to on the top window
const ready = 'dex-frame-messaging:initialize'
export function subscribeToFrameMessage<T extends typeof ready = typeof ready>(
  messageDataType: T,
  eventCallback: (event: MessageEvent<{ type: T; args: any }>) => void,
  allowedOrigin: string,
  opts?: AddEventListenerOptions
): () => void {
  const filterToMessageType = messageFilterCreator(
    messageDataType,
    allowedOrigin,
  );
  const handleEvent = (event: MessageEvent) => {
    // console.log('unfiltered message event', event.data?.type, event)
    if (filterToMessageType(event)) {
      try {
        eventCallback(event);
      } catch (e) {
        console.error('error in frame message:', e, event);
      }
    }
  };
  // add listener and return cleanup function
  window.addEventListener('message', handleEvent, opts);
  return () => window.removeEventListener('message', handleEvent);
}

export function subscribeToFrameSigningClientMessages<
  T extends Array<SigningStargateClientMethods>
>(
  messageDataTypes: T,
  eventCallback: (event: FrameMessage<T[number]>) => void,
  allowedOrigin: string
): () => void {
  const filterToMessageType = messageFilterCreator(
    messageDataTypes,
    allowedOrigin
  );
  const handleEvent = (event: MessageEvent) => {
    if (filterToMessageType(event)) {
      try {
        eventCallback(event.data);
      } catch (e) {
        console.error('error in frame message:', e, event);
      }
    }
  };
  // add listener and return cleanup function
  window.addEventListener('message', handleEvent);
  return () => window.removeEventListener('message', handleEvent);
}

class FrameClient {
  private messagePort: MessagePort;
  constructor(messagePort: MessagePort) {
    this.messagePort = messagePort;
  }
  subscribeToFrameSigningClientMessages<
    T extends Array<SigningStargateClientMethods>
  >(
    messageDataTypes: T,
    eventCallback: (event: FrameMessage<T[number]>) => void,
  ): () => void {
    const handleEvent = (event: MessageEvent) => {
      console.log('top window listened to messages')
      if (messageDataTypes.includes(event.data.type)) {
        try {
          eventCallback(event.data);
        } catch (e) {
          console.error('error in frame message:', e, event);
        }
      }
    };
    // add listener and return cleanup function
    this.messagePort.addEventListener('message', handleEvent);
    return () => this.messagePort.removeEventListener('message', handleEvent);
  }
}

function handleDeliverTxResponse(deliverTxResponse: DeliverTxResponse) {
  return 
}

export function useFrameMessagingForwarding(messagePort: MessagePort | undefined, rpcEndpoint = defaultRpcEndpoint) {
  const { wallet: signer } = useWeb3();

  // subscribe to signing client requests
  useEffect(() => {
    if (signer && messagePort) {
      const frameClient = new FrameClient(messagePort);
      return frameClient.subscribeToFrameSigningClientMessages(
          signingStargateClientMethods,
          async ({ id, type, args }) => {
            const client = await getSigningDualityClient({
              rpcEndpoint,
              signer,
            });

            // could handle each of these differently
            type TypeArgs<T extends SigningStargateClientMethods> = Parameters<SigningStargateClient[T]>
            switch(type) {
              case 'signAndBroadcast': {
                return client[type](...args as TypeArgs<'signAndBroadcast'>)
                  .then((response) => {
                    messagePort.postMessage({ id, type, response });
                    return response;
                  })
                  .catch((error) => {
                    messagePort.postMessage({ id, type, error });
                    throw error;
                  })
              }
            }

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
        )
    }
  }, [signer, messagePort]);
}

// if you use the same origin more than once, the last connected one will be set
export function useFramePort(uniqueOriginURL: URL | string) {
  const [messagePort, setMessagePort] = useState<MessagePort>();
  const allowedOrigin = new URL(uniqueOriginURL).origin;

  // subscribe to initialization of this frame once
  useEffect(() => {
    console.log('create subscribeToFrameMessage initialize')
    let closePort: () => void;
    const unsubscribe = subscribeToFrameMessage(
      'dex-frame-messaging:initialize',
      (e) => {
        const messagePort = e.ports?.at(0);
        if (messagePort) {
          // start port to start receiving messages
          messagePort.start();
          // set port to state
          setMessagePort(messagePort)
          // send response to port
          messagePort.postMessage({ type: 'dex-frame-messaging:initialized' });
          // add cleanup for port
          closePort = () => messagePort.close();
        }
      },
      allowedOrigin,
    )
    return () => {
      closePort?.();
      unsubscribe();
    }
  }, [allowedOrigin]);

  return messagePort;
}
