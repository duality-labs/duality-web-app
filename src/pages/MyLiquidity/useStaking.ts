import { useState, useCallback } from 'react';
import { DeliverTxResponse } from '@cosmjs/stargate';
import BigNumber from 'bignumber.js';
import Long from 'long';

import { useWeb3 } from '../../lib/web3/useWeb3';
import {
  checkMsgErrorToast,
  checkMsgOutOfGasToast,
  checkMsgRejectedToast,
  checkMsgSuccessToast,
  createLoadingToast,
} from '../../components/Notifications/common';

import { UserPositionDepositContext } from '../../lib/web3/hooks/useUserShares';
import { signingRpcClient } from '../../lib/web3/rpcMsgClient';
import {
  dualitylabs,
  getSigningDualitylabsClient,
} from '@duality-labs/dualityjs';
import { ValuedUserPositionDepositContext } from '../../lib/web3/hooks/useUserShareValues';
import { getShareDenom } from '../../lib/web3/utils/shares';

export interface EditedPosition extends UserPositionDepositContext {
  tickDiff0: BigNumber;
  tickDiff1: BigNumber;
}

interface SendEditResponse {
  gasUsed: string;
}

export function useStake(): [
  {
    data?: SendEditResponse;
    isValidating?: boolean;
    error?: string;
  },
  (
    stakePositions: Array<ValuedUserPositionDepositContext>,
    unstakePositions: Array<ValuedUserPositionDepositContext>
  ) => Promise<void>
] {
  const [data, setData] = useState<SendEditResponse | undefined>(undefined);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string>();
  const web3 = useWeb3();

  const sendRequest = useCallback(
    async function (
      stakePositions: Array<ValuedUserPositionDepositContext>,
      unstakePositions: Array<ValuedUserPositionDepositContext>
    ) {
      try {
        // check for correct inputs
        if (!web3.address || !web3.wallet) {
          throw new Error('Wallet not connected');
        }
        const web3Address = web3.address;

        const stakeChangeCount =
          stakePositions.length + unstakePositions.length;
        if (stakeChangeCount === 0) {
          throw new Error('Stakes not set');
        }

        setData(undefined);
        setIsValidating(true);
        setError(undefined);

        const id = `${Date.now()}.${Math.random}`;
        createLoadingToast({ id, description: 'Staking...' });

        const gasEstimate = 50000 + 100000 * stakeChangeCount;

        // wrap transaction logic
        try {
          // add each tick message into a signed broadcast
          const client = await signingRpcClient(
            getSigningDualitylabsClient,
            web3.wallet
          );
          const res = await client.signAndBroadcast(
            web3.address,
            [
              ...(stakePositions.length > 0
                ? [
                    dualitylabs.duality.incentives.MessageComposer.withTypeUrl.stake(
                      {
                        owner: web3Address,
                        coins: stakePositions.flatMap(({ deposit }) => {
                          const denom = getShareDenom(
                            [deposit.pairID.token0, deposit.pairID.token1],
                            deposit.centerTickIndex1To0.toNumber(),
                            deposit.fee.toNumber()
                          );
                          return denom
                            ? {
                                denom,
                                amount: deposit.sharesOwned,
                              }
                            : [];
                        }),
                      }
                    ),
                  ]
                : []),
              ...(unstakePositions.length > 0
                ? [
                    dualitylabs.duality.incentives.MessageComposer.withTypeUrl.unstake(
                      {
                        owner: web3Address,
                        unstakes: unstakePositions.flatMap(
                          ({ deposit, stakeContext }) => {
                            const denom = getShareDenom(
                              [deposit.pairID.token0, deposit.pairID.token1],
                              deposit.centerTickIndex1To0.toNumber(),
                              deposit.fee.toNumber()
                            );
                            return denom
                              ? {
                                  ID: Long.fromString(stakeContext?.ID || ''),
                                  coins: [
                                    {
                                      denom,
                                      amount: deposit.sharesOwned,
                                    },
                                  ],
                                }
                              : [];
                          }
                        ),
                      }
                    ),
                  ]
                : []),
            ],
            {
              gas: gasEstimate.toFixed(0),
              amount: [
                { amount: (gasEstimate * 0.025).toFixed(0), denom: 'token' },
              ],
            },
            ''
          );

          // check for response
          if (!res) {
            throw new Error('No response');
          }
          const { code, gasUsed } = res;

          // check for response errors
          if (!checkMsgSuccessToast(res, { id })) {
            const error: Error & { response?: DeliverTxResponse } = new Error(
              `Tx error: ${code}`
            );
            error.response = res;
            throw error;
          }

          // set new information
          setData({
            gasUsed: gasUsed.toString(),
          });
          setIsValidating(false);
        } catch (e) {
          // catch transaction errors
          const err = e as Error & { response?: DeliverTxResponse };
          // chain toast checks so only one toast may be shown
          checkMsgRejectedToast(err, { id }) ||
            checkMsgOutOfGasToast(err, { id }) ||
            checkMsgErrorToast(err, { id });

          // rethrow transaction errors
          throw e;
        }
      } catch (e) {
        setIsValidating(false);
        setError((e as Error)?.message || (e as string));
        // pass error to console for developer
        // eslint-disable-next-line no-console
        console.error(e as Error);
      }
    },
    [web3.address, web3.wallet]
  );

  return [{ data, isValidating, error }, sendRequest];
}
