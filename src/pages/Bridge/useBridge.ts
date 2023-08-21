import { useCallback, useState } from 'react';
import BigNumber from 'bignumber.js';
import { ibc } from '@duality-labs/dualityjs';
import { DeliverTxResponse, SigningStargateClient } from '@cosmjs/stargate';
import { Chain } from '@chain-registry/types';
import {
  MsgTransfer,
  MsgTransferResponseSDKType,
} from '@duality-labs/dualityjs/types/codegen/ibc/applications/transfer/v1/tx';

import { ibcClient } from '../../lib/web3/rpcMsgClient';
import { useRemoteChainRestEndpoint } from '../../lib/web3/hooks/useChains';
import {
  getKeplrWallet,
  getKeplrWalletAccount,
} from '../../lib/web3/wallets/keplr';

import {
  checkMsgErrorToast,
  checkMsgOutOfGasToast,
  checkMsgRejectedToast,
  checkMsgSuccessToast,
  createLoadingToast,
} from '../../components/Notifications/common';

async function bridgeToken(
  msg: MsgTransfer,
  client: SigningStargateClient,
  signingAddress: string
) {
  const {
    sender,
    receiver,
    sourceChannel,
    sourcePort,
    token,
    timeoutTimestamp,
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

  // send message to chain
  const id = `${Date.now()}.${Math.random}`;

  createLoadingToast({ id, description: 'Executing your trade' });

  return client
    .signAndBroadcast(
      signingAddress,
      [ibc.applications.transfer.v1.MessageComposer.withTypeUrl.transfer(msg)],
      {
        gas: '100000',
        amount: [],
      }
    )
    .then(function (res): void {
      if (!res) {
        throw new Error('No response');
      }
      const { code } = res;
      if (!checkMsgSuccessToast(res, { id })) {
        const error: Error & { response?: DeliverTxResponse } = new Error(
          `Tx error: ${code}`
        );
        error.response = res;
        throw error;
      }
    })
    .catch(function (err: Error & { response?: DeliverTxResponse }) {
      // catch transaction errors
      // chain toast checks so only one toast may be shown
      checkMsgRejectedToast(err, { id }) ||
        checkMsgOutOfGasToast(err, { id }) ||
        checkMsgErrorToast(err, { id });

      // rethrow error
      throw err;
    });
}

export default function useBridge(chainFrom?: Chain): [
  {
    data?: MsgTransferResponseSDKType;
    isValidating: boolean;
    error?: string;
  },
  (request: MsgTransfer) => Promise<void>
] {
  const [data, setData] = useState<MsgTransferResponseSDKType>();
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string>();

  const { data: restEndpointFrom, refetch: refetchFrom } =
    useRemoteChainRestEndpoint(chainFrom);

  const sendRequest = useCallback(
    async (request: MsgTransfer) => {
      // check things around the request (not the request payload)
      if (!request) return onError('Missing Token and Amount');
      if (!chainFrom) return onError('No Chain connected');

      setValidating(true);
      setError(undefined);
      setData(undefined);

      try {
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
          throw new Error('No chain endpoint found');
        }
        // make the bridge transaction to the from chain (with correct signing)
        const client = await ibcClient(offlineSigner, clientEndpointFrom);
        await bridgeToken(request, client, account.address);
        setValidating(false);
      } catch (err: unknown) {
        // add error to state
        onError((err as Error)?.message ?? 'Unknown error');
        // pass error to console for developer
        // eslint-disable-next-line no-console
        console.error(err);
        // pass error through
        throw err;
      }

      function onError(message?: string) {
        setValidating(false);
        setData(undefined);
        setError(message);
      }
    },
    [chainFrom, refetchFrom, restEndpointFrom]
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
