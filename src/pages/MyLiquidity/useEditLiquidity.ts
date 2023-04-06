import { useState, useCallback } from 'react';
import { DeliverTxResponse } from '@cosmjs/stargate';
import BigNumber from 'bignumber.js';

import { useWeb3 } from '../../lib/web3/useWeb3';
import apiClient from '../../lib/web3/apiClient';
import { Token } from '../../components/TokenPicker/hooks';
import {
  checkMsgErrorToast,
  checkMsgOutOfGasToast,
  checkMsgRejectedToast,
  checkMsgSuccessToast,
  createLoadingToast,
} from '../../components/Notifications/common';
import { getAmountInDenom } from '../../lib/web3/utils/tokens';
import { IndexedShare } from '../../lib/web3/utils/shares';

export interface ShareValue {
  share: IndexedShare;
  token0: Token;
  token1: Token;
}
export interface TickShareValue extends ShareValue {
  userReserves0?: BigNumber;
  userReserves1?: BigNumber;
}
export interface EditedTickShareValue extends TickShareValue {
  tickDiff0: BigNumber;
  tickDiff1: BigNumber;
}
export interface TickShareValueMap {
  [pairID: string]: Array<TickShareValue>;
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
          const client = apiClient(web3.wallet);
          const res = await client.signAndBroadcast(
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
                return share.tickIndex &&
                  share.feeIndex &&
                  share.sharesOwned &&
                  token0.address &&
                  token1.address &&
                  userReserves0 &&
                  userReserves1
                  ? [
                      ...(!tickDiff0.isZero()
                        ? [
                            tickDiff0.isGreaterThan(0)
                              ? client.NicholasdotsolDualityDex.tx.msgDeposit({
                                  value: {
                                    creator: web3Address,
                                    tokenA: token0.address,
                                    tokenB: token1.address,
                                    receiver: web3Address,
                                    tickIndexes: [Number(share.tickIndex)],
                                    feeIndexes: [Number(share.feeIndex)],
                                    amountsA: [
                                      getAmountInDenom(
                                        token0,
                                        tickDiff0,
                                        token0.display
                                      ) || '0',
                                    ],
                                    amountsB: ['0'],
                                  },
                                })
                              : client.NicholasdotsolDualityDex.tx.msgWithdrawl(
                                  {
                                    value: {
                                      creator: web3Address,
                                      tokenA: token0.address,
                                      tokenB: token1.address,
                                      receiver: web3Address,
                                      tickIndexes: [Number(share.tickIndex)],
                                      feeIndexes: [Number(share.feeIndex)],
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
                                    },
                                  }
                                ),
                          ]
                        : []),
                      ...(!tickDiff1.isZero()
                        ? [
                            tickDiff1.isGreaterThan(0)
                              ? client.NicholasdotsolDualityDex.tx.msgDeposit({
                                  value: {
                                    creator: web3Address,
                                    tokenA: token0.address,
                                    tokenB: token1.address,
                                    receiver: web3Address,
                                    tickIndexes: [Number(share.tickIndex)],
                                    feeIndexes: [Number(share.feeIndex)],
                                    amountsA: ['0'],
                                    amountsB: [
                                      getAmountInDenom(
                                        token1,
                                        tickDiff1,
                                        token1.display
                                      ) || '0',
                                    ],
                                  },
                                })
                              : client.NicholasdotsolDualityDex.tx.msgWithdrawl(
                                  {
                                    value: {
                                      creator: web3Address,
                                      tokenA: token0.address,
                                      tokenB: token1.address,
                                      receiver: web3Address,
                                      tickIndexes: [Number(share.tickIndex)],
                                      feeIndexes: [Number(share.feeIndex)],
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
                                    },
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
