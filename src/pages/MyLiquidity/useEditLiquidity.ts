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
import { Token, getBaseDenomAmount } from '../../lib/web3/utils/tokens';

import { UserReserves } from '../../lib/web3/hooks/useUserReserves';
import rpcClient from '../../lib/web3/rpcMsgClient';
import { neutron } from '@duality-labs/dualityjs';

export interface EditedPosition extends UserReserves {
  token0: Token;
  token1: Token;
  denom0: string;
  denom1: string;
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
  (sharesDiff: Array<EditedPosition>) => Promise<void>
] {
  const [data, setData] = useState<SendEditResponse | undefined>(undefined);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string>();
  const web3 = useWeb3();

  const sendEditRequest = useCallback(
    async function (sharesDiff: Array<EditedPosition>) {
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
                deposit: {
                  pair_id: { token0: token0Address, token1: token1Address },
                  center_tick_index: centerTickIndex,
                  fee,
                  shares_owned: userShares,
                },
                reserves: { reserves0, reserves1 },
                token0,
                token1,
                tickDiff0,
                tickDiff1,
              }) => {
                const userTotalReserves = BigNumber.sum(
                  reserves0 || 0,
                  reserves1 || 0
                );
                return centerTickIndex !== undefined &&
                  fee !== undefined &&
                  !isNaN(Number(fee)) &&
                  token0 &&
                  token1 &&
                  userTotalReserves.isGreaterThan(0)
                  ? // for situations where withdrawing both side of liquidity
                    // then add both together
                    // todo: this should be reworked, this is a major difference between deposit and
                    // withdrawal, deposit is per reserve, withdrawal is per share.
                    // I'm not certain that non-100% withdrawals work in all cases.
                    tickDiff0.isLessThan(0) && tickDiff1.isLessThan(0)
                    ? [
                        neutron.dex.MessageComposer.withTypeUrl.withdrawal({
                          creator: web3Address,
                          token_a: token0Address,
                          token_b: token1Address,
                          receiver: web3Address,
                          tick_indexes_a_to_b: [centerTickIndex],
                          fees: [fee],
                          // approximate removal using percentages
                          // todo: this probably has a bug when withdrawing from a tick
                          // that has both token0 and token1 as this only takes into account one side
                          shares_to_remove: [
                            tickDiff0
                              .plus(tickDiff1)
                              .negated()
                              .dividedBy(userTotalReserves)
                              .multipliedBy(userShares)
                              .toFixed(0),
                          ],
                        }),
                      ]
                    : [
                        ...(!tickDiff0.isZero()
                          ? [
                              tickDiff0.isGreaterThan(0)
                                ? neutron.dex.MessageComposer.withTypeUrl.deposit(
                                    {
                                      creator: web3Address,
                                      token_a: token0Address,
                                      token_b: token1Address,
                                      receiver: web3Address,
                                      tick_indexes_a_to_b: [centerTickIndex],
                                      fees: [fee],
                                      amounts_a: [
                                        getBaseDenomAmount(token0, tickDiff0) ||
                                          '0',
                                      ],
                                      amounts_b: ['0'],
                                      // todo: allow user to specify autoswap behavior
                                      options: [{ disable_autoswap: false }],
                                    }
                                  )
                                : neutron.dex.MessageComposer.withTypeUrl.withdrawal(
                                    {
                                      creator: web3Address,
                                      token_a: token0Address,
                                      token_b: token1Address,
                                      receiver: web3Address,
                                      tick_indexes_a_to_b: [centerTickIndex],
                                      fees: [fee],
                                      // approximate removal using percentages
                                      // todo: this probably has a bug when withdrawing from a tick
                                      // that has both token0 and token1 as this only takes into account one side
                                      shares_to_remove: reserves0
                                        ? [
                                            tickDiff0
                                              .negated()
                                              .dividedBy(reserves0)
                                              .multipliedBy(userShares)
                                              .toFixed(0),
                                          ]
                                        : ['0'],
                                    }
                                  ),
                            ]
                          : []),
                        ...(!tickDiff1.isZero()
                          ? [
                              tickDiff1.isGreaterThan(0)
                                ? neutron.dex.MessageComposer.withTypeUrl.deposit(
                                    {
                                      creator: web3Address,
                                      token_a: token0Address,
                                      token_b: token1Address,
                                      receiver: web3Address,
                                      tick_indexes_a_to_b: [centerTickIndex],
                                      fees: [fee],
                                      amounts_a: ['0'],
                                      amounts_b: [
                                        getBaseDenomAmount(token1, tickDiff1) ||
                                          '0',
                                      ],
                                      // todo: allow user to specify autoswap behavior
                                      options: [{ disable_autoswap: false }],
                                    }
                                  )
                                : neutron.dex.MessageComposer.withTypeUrl.withdrawal(
                                    {
                                      creator: web3Address,
                                      token_a: token0Address,
                                      token_b: token1Address,
                                      receiver: web3Address,
                                      tick_indexes_a_to_b: [centerTickIndex],
                                      fees: [fee],
                                      // approximate removal using percentages
                                      // todo: this probably has a bug when withdrawing from a tick
                                      // that has both token0 and token1 as this only takes into account one side
                                      shares_to_remove: reserves1
                                        ? [
                                            tickDiff1
                                              .negated()
                                              .dividedBy(reserves1)
                                              .multipliedBy(userShares)
                                              .toFixed(0),
                                          ]
                                        : ['0'],
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
              amount: [],
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

          // todo: parse and update toast with information about the trade

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
