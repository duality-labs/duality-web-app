import { useCallback, useState } from 'react';
import BigNumber from 'bignumber.js';
import { ibc } from '@duality-labs/neutronjs';
import { DeliverTxResponse, SigningStargateClient } from '@cosmjs/stargate';
import { Chain } from '@chain-registry/types';
import {
  MsgTransfer,
  MsgTransferResponse,
} from '@duality-labs/neutronjs/types/codegen/ibc/applications/transfer/v1/tx';
import { GetTxsEventRequest } from '@duality-labs/neutronjs/types/codegen/cosmos/tx/v1beta1/service';

import { getCosmosRestClient } from '../../lib/web3/clients/restClients';
import {
  IBCReceivePacketEvent,
  IBCSendPacketEvent,
  decodeEvent,
  mapEventAttributes,
} from '../../lib/web3/utils/events';
import {
  useRemoteChainRestEndpoint,
  useRemoteChainRpcEndpoint,
} from '../../lib/web3/hooks/useChains';
import {
  getKeplrWallet,
  getKeplrWalletAccount,
} from '../../lib/web3/wallets/keplr';

import {
  createErrorToast,
  createTransactionToasts,
} from '../../components/Notifications/common';
import { coerceError } from '../../lib/utils/error';
import { seconds } from '../../lib/utils/time';
import { getIbcSigningClient } from '../../lib/web3/clients/signingClients';

async function bridgeToken(
  client: SigningStargateClient,
  signingAddress: string,
  msg: MsgTransfer
) {
  const {
    sender,
    receiver,
    source_channel: sourceChannel,
    source_port: sourcePort,
    token,
    timeout_timestamp: timeoutTimestamp,
  } = msg;
  if (
    !sender ||
    !receiver ||
    !sourceChannel ||
    !sourcePort ||
    !token ||
    !timeoutTimestamp
  ) {
    throw new Error('Invalid Input');
  }

  if (!new BigNumber(token.amount).isGreaterThan(0)) {
    throw new Error('Invalid Input (0 amount)');
  }

  // todo: check token denom validity if possible

  // note: all Cosmos chains use IBC v1 transfer at the moment
  //       so passing different chains interchangably works fine
  // future: update when there is a transition to a newer version

  return await client.signAndBroadcast(
    signingAddress,
    [ibc.applications.transfer.v1.MessageComposer.withTypeUrl.transfer(msg)],
    {
      gas: '100000',
      amount: [],
    }
  );
}

export default function useBridge(
  chainFrom?: Chain,
  chainTo?: Chain
): [
  {
    data?: MsgTransferResponse;
    isValidating: boolean;
    error?: string;
  },
  (request: MsgTransfer) => Promise<void>
] {
  const [data, setData] = useState<MsgTransferResponse>();
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string>();

  const { data: restEndpointFrom, refetch: refetchFrom } =
    useRemoteChainRestEndpoint(chainFrom);
  const { data: restEndpointTo, refetch: refetchTo } =
    useRemoteChainRestEndpoint(chainTo);
  const { data: rpcEndpointFrom, refetch: refetchRpc } =
    useRemoteChainRpcEndpoint(chainFrom);

  const sendRequest = useCallback(
    async (request: MsgTransfer) => {
      try {
        // check synchronous things around the request (not the request payload)
        if (!request) {
          throw new Error('Missing Token and Amount');
        }
        if (!chainFrom) {
          throw new Error('No Source Chain connected');
        }
        if (!chainTo) {
          throw new Error('No Destination Chain connected');
        }

        // set loading state
        setValidating(true);
        setError(undefined);
        setData(undefined);

        // check async things around the request (not the request payload)
        const offlineSigner = await getKeplrWallet(chainFrom.chain_id);
        if (!offlineSigner) {
          throw new Error('No Wallet');
        }
        const account = await getKeplrWalletAccount(offlineSigner);
        if (!account || !account.address) {
          throw new Error('No wallet address');
        }
        const refetchOptions = { cancelRefetch: false };
        const clientEndpointFrom =
          restEndpointFrom ?? (await refetchFrom(refetchOptions)).data;
        if (!clientEndpointFrom) {
          throw new Error('No source chain endpoint found');
        }
        // before sending the transaction:
        // check that both sides of the channel have an Active status
        const clientEndpointTo =
          restEndpointTo ?? (await refetchTo(refetchOptions)).data;
        if (!clientEndpointTo) {
          throw new Error('No destination chain endpoint found');
        }
        const rpcClientEndpointFrom =
          rpcEndpointFrom ?? (await refetchRpc(refetchOptions)).data;
        if (!rpcClientEndpointFrom) {
          throw new Error('No source chain transaction endpoint found');
        }

        // process intended request
        // make the bridge transaction to the from chain (with correct signing)
        const client = await getIbcSigningClient(
          offlineSigner,
          rpcClientEndpointFrom
        );
        const responseFrom = await createTransactionToasts(
          () => bridgeToken(client, account.address, request),
          {
            onLoadingMessage: 'Source Chain Transaction Started...',
            onSuccessMessage: 'Source Chain Transaction Successful!',
            onErrorMessage: 'Source Chain Transaction Failed',
            restEndpoint: restEndpointFrom ?? undefined,
          }
        );
        if (!responseFrom) {
          throw new Error('Could not confirm source chain transaction');
        }
        // confirm the transaction is received on the receiving chain
        const events = [
          // collect events with mapped attributes
          ...responseFrom.events.map(mapEventAttributes),
          // collect events with potential mapped base64 attributes
          // we do this because we haven't checked whether the source chain
          // is pre-v0.35.0 Tendermint or not so the atrributes may be encoded
          ...responseFrom.events.map(decodeEvent).map(mapEventAttributes),
        ];
        const sendEvent =
          events &&
          events.find((event): event is IBCSendPacketEvent => {
            return event.type === 'send_packet';
          });
        const packetDataHex = sendEvent?.attributes.packet_data_hex;
        if (!packetDataHex) {
          throw new Error('Could not confirm sending chain transaction data');
        }

        const responseTo = await createTransactionToasts(
          async () => {
            // poll for expected IBC packet, but timeout after a period of time
            const timeout = Date.now() + 30 * seconds;
            while (Date.now() <= timeout) {
              const restClientTo = await getCosmosRestClient(clientEndpointTo);
              const res = await restClientTo.tx.v1beta1.getTxsEvent({
                events: `recv_packet.packet_data_hex='${packetDataHex}'`,
                limit: '10',
                // note: hacking request payload type because it is very wrong
              } as unknown as GetTxsEventRequest);
              const txResult = res?.tx_responses?.find((txResponse) => {
                const events = [
                  // collect events with mapped attributes
                  ...txResponse.events.map(mapEventAttributes),
                  // collect events with potential mapped base64 attributes
                  // we do this because we haven't checked whether the source chain
                  // is pre-v0.35.0 Tendermint or not so the atrributes may be encoded
                  ...txResponse.events.map(decodeEvent).map(mapEventAttributes),
                ];
                const receiveEvent = events.find(
                  (event): event is IBCReceivePacketEvent => {
                    // return the receive packet type that has the correctly decoded keys
                    return (
                      event.type === 'recv_packet' &&
                      !!event.attributes.packet_data_hex
                    );
                  }
                );
                // compare the timeout timestamp as it is the most unique identifier
                return (
                  receiveEvent?.attributes.packet_timeout_timestamp ===
                  sendEvent?.attributes.packet_timeout_timestamp
                );
              });
              if (txResult) {
                // translate response into format for toasts
                return {
                  code: txResult.code,
                  transactionHash: txResult.txhash,
                  rawLog: txResult.raw_log,
                  gasUsed: txResult.gas_used.toNumber(),
                  gasWanted: txResult.gas_wanted.toNumber(),
                } as DeliverTxResponse;
              }
              // wait a little while
              await new Promise((resolve) => setTimeout(resolve, 3 * seconds));
            }
            // while timeout reached
            throw new Error(
              'Timed out waiting for receiving chain confirmation'
            );
          },
          {
            onLoadingMessage: 'Destination Chain Transaction Started...',
            onSuccessMessage: 'Destination Chain Transaction Successful!',
            onErrorMessage: 'Destination Chain Transaction Failed',
            restEndpoint: restEndpointTo ?? undefined,
          }
        );
        if (!responseTo) {
          throw new Error('Could not confirm destination chain transaction');
        }

        // exit loading state
        setValidating(false);
      } catch (maybeError: unknown) {
        const err = coerceError(maybeError);
        // handle unhandled errors (handled errors won't be processed twice)
        createErrorToast(err);

        // set error state
        setValidating(false);
        setData(undefined);
        setError(err.message);

        // pass error through
        throw err;
      }
    },
    [
      chainFrom,
      chainTo,
      refetchFrom,
      refetchRpc,
      refetchTo,
      restEndpointFrom,
      restEndpointTo,
      rpcEndpointFrom,
    ]
  );

  return [
    {
      data,
      isValidating: validating,
      error,
    },
    sendRequest,
  ];
}
