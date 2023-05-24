import { useState, useCallback } from 'react';
import { DeliverTxResponse } from '@cosmjs/stargate';
import BigNumber from 'bignumber.js';

import { useWeb3 } from '../../lib/web3/useWeb3';
import {
  checkMsgErrorToast,
  checkMsgOutOfGasToast,
  checkMsgRejectedToast,
  checkMsgSuccessToast,
  createLoadingToast,
} from '../../components/Notifications/common';
import { getAmountInDenom } from '../../lib/web3/utils/tokens';

import { TickShareValue } from './useShareValueMap';
import rpcClient from '../../lib/web3/rpcMsgClient';
import { dualitylabs } from '@duality-labs/dualityjs';
import Long from 'long';

export interface EditedTickShareValue extends TickShareValue {
  tickDiff0: BigNumber;
  tickDiff1: BigNumber;
}

interface SendEditResponse {
  gasUsed: string;
}

export function useEditLiquidity(): [
  {
    data?: SendEditResponse;
    isValidating?: boolean;
    error?: string;
  },
  (sharesDiff: Array<EditedTickShareValue>) => Promise<void>
] {
  const [data, setData] = useState<SendEditResponse | undefined>(undefined);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string>();
  const web3 = useWeb3();

  const sendEditRequest = useCallback(
    async function (sharesDiff: Array<EditedTickShareValue>) {
      try {
        // check for correct inputs
        if (!web3.address || !web3.wallet) {
          throw new Error('Wallet not connected');
        }
        const web3Address = web3.address;

        if (sharesDiff.length === 0) {
          throw new Error('Ticks not set');
        }

        setData(undefined);
        setIsValidating(true);
        setError(undefined);

        const id = `${Date.now()}.${Math.random}`;
        // todo: change this on use of "edit liquidity mode again"
        createLoadingToast({ id, description: 'Removing Liquidity...' });

        const [depositCount, withdrawCount] = sharesDiff.reduce<
          [number, number]
        >(
          ([depositCount, withdrawCount], shareDiff) => {
            return [
              depositCount +
                (shareDiff.tickDiff0.isGreaterThan(0) ? 1 : 0) +
                (shareDiff.tickDiff1.isGreaterThan(0) ? 1 : 0),
              withdrawCount +
                (shareDiff.tickDiff0.isLessThan(0) ? 1 : 0) +
                (shareDiff.tickDiff1.isLessThan(0) ? 1 : 0),
            ];
          },
          [0, 0]
        );

        const gasEstimate =
          50000 + depositCount * 100000 + withdrawCount * 100000;

        // wrap transaction logic
        try {
          // add each tick message into a signed broadcast
          const client = await rpcClient(web3.wallet);
          const res = await client.signAndBroadcast(
            web3.address,
            sharesDiff.flatMap(
              ({
                share,
                token0,
                token1,
                tickDiff0,
                tickDiff1,
                userReserves0,
                userReserves1,
              }) => {
                return share.tickIndex !== undefined &&
                  share.fee !== undefined &&
                  !isNaN(Number(share.fee)) &&
                  share.sharesOwned &&
                  token0.address &&
                  token1.address &&
                  userReserves0 &&
                  userReserves1
                  ? // for situations where withdrawing both side of liquidity
                    // then add both together
                    // todo: this should be reworked, this is a major difference between deposit and
                    // withdrawal, deposit is per reserve, withdrawal is per share.
                    // I'm not certain that non-100% withdrawals work in all cases.
                    tickDiff0.isLessThan(0) && tickDiff1.isLessThan(0)
                    ? [
                        dualitylabs.duality.dex.MessageComposer.withTypeUrl.withdrawal(
                          {
                            creator: web3Address,
                            tokenA: token0.address,
                            tokenB: token1.address,
                            receiver: web3Address,
                            tickIndexesAToB: [Long.fromString(share.tickIndex)],
                            fees: [Long.fromString(share.fee)],
                            // approximate removal using percentages
                            // todo: this probably has a bug when withdrawing from a tick
                            // that has both token0 and token1 as this only takes into account one side
                            sharesToRemove: [
                              tickDiff0
                                .plus(tickDiff1)
                                .negated()
                                .dividedBy(userReserves0.plus(userReserves1))
                                .multipliedBy(share.sharesOwned)
                                .toFixed(0),
                            ],
                          }
                        ),
                      ]
                    : [
                        ...(!tickDiff0.isZero()
                          ? [
                              tickDiff0.isGreaterThan(0)
                                ? dualitylabs.duality.dex.MessageComposer.withTypeUrl.deposit(
                                    {
                                      creator: web3Address,
                                      tokenA: token0.address,
                                      tokenB: token1.address,
                                      receiver: web3Address,
                                      tickIndexesAToB: [
                                        Long.fromString(share.tickIndex),
                                      ],
                                      fees: [Long.fromString(share.fee)],
                                      amountsA: [
                                        getAmountInDenom(
                                          token0,
                                          tickDiff0,
                                          token0.display
                                        ) || '0',
                                      ],
                                      amountsB: ['0'],
                                      // todo: allow user to specify autoswap behavior
                                      Options: [{ disableAutoswap: false }],
                                    }
                                  )
                                : dualitylabs.duality.dex.MessageComposer.withTypeUrl.withdrawal(
                                    {
                                      creator: web3Address,
                                      tokenA: token0.address,
                                      tokenB: token1.address,
                                      receiver: web3Address,
                                      tickIndexesAToB: [
                                        Long.fromString(share.tickIndex),
                                      ],
                                      fees: [Long.fromString(share.fee)],
                                      // approximate removal using percentages
                                      // todo: this probably has a bug when withdrawing from a tick
                                      // that has both token0 and token1 as this only takes into account one side
                                      sharesToRemove: [
                                        tickDiff0
                                          .negated()
                                          .dividedBy(userReserves0)
                                          .multipliedBy(share.sharesOwned)
                                          .toFixed(0),
                                      ],
                                    }
                                  ),
                            ]
                          : []),
                        ...(!tickDiff1.isZero()
                          ? [
                              tickDiff1.isGreaterThan(0)
                                ? dualitylabs.duality.dex.MessageComposer.withTypeUrl.deposit(
                                    {
                                      creator: web3Address,
                                      tokenA: token0.address,
                                      tokenB: token1.address,
                                      receiver: web3Address,
                                      tickIndexesAToB: [
                                        Long.fromString(share.tickIndex),
                                      ],
                                      fees: [Long.fromString(share.fee)],
                                      amountsA: ['0'],
                                      amountsB: [
                                        getAmountInDenom(
                                          token1,
                                          tickDiff1,
                                          token1.display
                                        ) || '0',
                                      ],
                                      // todo: allow user to specify autoswap behavior
                                      Options: [{ disableAutoswap: false }],
                                    }
                                  )
                                : dualitylabs.duality.dex.MessageComposer.withTypeUrl.withdrawal(
                                    {
                                      creator: web3Address,
                                      tokenA: token0.address,
                                      tokenB: token1.address,
                                      receiver: web3Address,
                                      tickIndexesAToB: [
                                        Long.fromString(share.tickIndex),
                                      ],
                                      fees: [Long.fromString(share.fee)],
                                      // approximate removal using percentages
                                      // todo: this probably has a bug when withdrawing from a tick
                                      // that has both token0 and token1 as this only takes into account one side
                                      sharesToRemove: [
                                        tickDiff1
                                          .negated()
                                          .dividedBy(userReserves1)
                                          .multipliedBy(share.sharesOwned)
                                          .toFixed(0),
                                      ],
                                    }
                                  ),
                            ]
                          : []),
                      ]
                  : [];
              }
            ),
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

  return [{ data, isValidating, error }, sendEditRequest];
}
