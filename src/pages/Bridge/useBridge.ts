import { useCallback, useState } from 'react';
import BigNumber from 'bignumber.js';
import { ibc } from '@duality-labs/dualityjs';
import { DeliverTxResponse } from '@cosmjs/stargate';
import { Chain } from '@chain-registry/types';
import {
  MsgTransfer,
  MsgTransferResponseSDKType,
} from '@duality-labs/dualityjs/types/codegen/ibc/applications/transfer/v1/tx';

import { ibcClient } from '../../lib/web3/rpcMsgClient';
import { dualityChain } from '../../lib/web3/hooks/useChains';
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

async function bridgeToken(chainFrom: Chain = dualityChain, msg: MsgTransfer) {
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
  const offlineSigner = await getKeplrWallet(chainFrom.chain_id);
  const account = await getKeplrWalletAccount(offlineSigner);
  if (!offlineSigner) {
    throw new Error('No Wallet');
  }
  if (!account || !account.address) {
    throw new Error('No wallet address');
  }

  // send message to chain
  const id = `${Date.now()}.${Math.random}`;

  createLoadingToast({ id, description: 'Executing your trade' });

  // get from chain endpoint if available
  const externalRpcUrl = chainFrom?.apis?.rpc?.at(0)?.address;
  const client = await ibcClient(offlineSigner, externalRpcUrl);
  return client
    .signAndBroadcast(
      account.address,
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

export default function useBridge(fromChain?: Chain): [
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

  const sendRequest = useCallback(
    async (request: MsgTransfer) => {
      if (!request) return onError('Missing Token and Amount');

      setValidating(true);
      setError(undefined);
      setData(undefined);

      try {
        await bridgeToken(fromChain, request);
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
    [fromChain]
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
