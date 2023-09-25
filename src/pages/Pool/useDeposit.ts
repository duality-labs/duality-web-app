import { useState, useCallback } from 'react';
import { DeliverTxResponse } from '@cosmjs/stargate';
import BigNumber from 'bignumber.js';
import Long from 'long';
import { dualitylabs } from '@duality-labs/dualityjs';

import { useWeb3 } from '../../lib/web3/useWeb3';
import rpcClient from '../../lib/web3/rpcMsgClient';
import { TickGroup } from '../../components/LiquiditySelector/LiquiditySelector';
import {
  checkMsgErrorToast,
  checkMsgOutOfGasToast,
  checkMsgRejectedToast,
  checkMsgSuccessToast,
  createLoadingToast,
} from '../../components/Notifications/common';
import { Token, getDisplayDenomAmount } from '../../lib/web3/utils/tokens';
import {
  DexDepositEvent,
  mapEventAttributes,
} from '../../lib/web3/utils/events';
import { useOrderedTokenPair } from '../../lib/web3/hooks/useTokenPairs';
import { useTokenPairTickLiquidity } from '../../lib/web3/hooks/useTickLiquidity';
import { formatAmount } from '../../lib/utils/number';
import { getTokenId } from '../../lib/web3/hooks/useTokens';

interface SendDepositResponse {
  gasUsed: string;
  receivedTokenA: string;
  receivedTokenB: string;
}

// this is a function that exists in the backend
// but is not easily queried from here
// perhaps the backend could return these values on each Share object
function getVirtualTickIndexes(
  tickIndex: number | string | undefined,
  fee: number | string | undefined
): [number, number] | [] {
  const feePoints = Number(fee);
  const middleIndex = Number(tickIndex);
  return feePoints && !isNaN(feePoints) && !isNaN(middleIndex)
    ? [middleIndex + feePoints, middleIndex - feePoints]
    : [];
}

export function useDeposit([tokenA, tokenB]: [
  Token | undefined,
  Token | undefined
]): [
  {
    data?: SendDepositResponse;
    isValidating?: boolean;
    error?: string;
  },
  (
    tokenA: Token | undefined,
    tokenB: Token | undefined,
    fee: BigNumber | undefined,
    userTicks: TickGroup
  ) => Promise<void>
] {
  // get previous ticks context
  const [token0, token1] =
    useOrderedTokenPair([getTokenId(tokenA), getTokenId(tokenB)]) || [];
  const {
    data: [token0Ticks, token1Ticks],
  } = useTokenPairTickLiquidity([token0, token1]);

  const [data, setData] = useState<SendDepositResponse | undefined>(undefined);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string>();
  const web3 = useWeb3();

  const sendDepositRequest = useCallback(
    async function (
      tokenA: Token | undefined,
      tokenB: Token | undefined,
      fee: BigNumber | undefined,
      userTicks: TickGroup
    ) {
      try {
        // check for correct inputs
        if (!web3.address || !web3.wallet) {
          throw new Error('Wallet not connected');
        }
        const web3Address = web3.address;
        if (!tokenA || !tokenB) {
          throw new Error('Tokens not set');
        }
        if (!fee || !fee.isGreaterThanOrEqualTo(0)) {
          throw new Error('Fee not set');
        }

        // do not make requests if they are not routable
        const tokenIdA = getTokenId(tokenA);
        const tokenIdB = getTokenId(tokenB);
        if (!tokenIdA) {
          throw new Error(
            `Token ${tokenA.symbol} has no address on the Duality chain`
          );
        }
        if (!tokenIdB) {
          throw new Error(
            `Token ${tokenB.symbol} has no address on the Duality chain`
          );
        }

        const forward = token0 === tokenIdA && token1 === tokenIdB;
        const reverse = token0 === tokenIdB && token1 === tokenIdA;
        const pairTicks = forward || reverse;

        // if (!pairs || !pairTicks) {
        //   throw new Error(
        //     `Cannot initialize a new pair here: ${[
        //       `our calculation of pair ID as either "${getPairID(
        //         tokenIdA,
        //         tokenIdB
        //       )}" or "${getPairID(
        //         tokenIdB,
        //         tokenIdA
        //       )}" may be incorrect.`,
        //     ].join(', ')}`
        //   );
        // }

        // check all user ticks and filter to non-zero ticks
        // also compbine any equivalent deposits into the same Msg
        const filteredUserTicks = userTicks
          .filter(({ priceBToA, reserveA, reserveB }) => {
            if (!priceBToA || priceBToA.isLessThan(0)) {
              throw new Error('Price not set');
            }
            if (
              !reserveA ||
              !reserveB ||
              reserveA.isNaN() ||
              reserveB.isNaN() ||
              reserveA.isLessThan(0) ||
              reserveB.isLessThan(0)
            ) {
              throw new Error('Amounts not set');
            }
            return reserveA.isGreaterThan(0) || reserveB.isGreaterThan(0);
          })
          // convert virtual (indexer) Ticks into "real" index Ticks (which are expected in the API)
          .flatMap((tick) => {
            const hasA = tick.reserveA.isGreaterThan(0);
            const hasB = tick.reserveB.isGreaterThan(0);

            // the order of tick indexes appears reversed here because we are
            // converting from virtual to real ticks (not real to virual)
            const [tickIndexB, tickIndexA] = getVirtualTickIndexes(
              tick.tickIndexBToA,
              tick.fee
            );

            if (tickIndexA === undefined || tickIndexB === undefined) {
              return [];
            }

            const ticks: TickGroup = [];

            // add reserveA as a single tick
            if (hasA) {
              ticks.push({
                ...tick,
                // select the tick index where we will add liquidity
                tickIndexBToA: forward ? tickIndexA : tickIndexB,
                reserveB: new BigNumber(0),
              });
            }

            // add reserveB as a single tick
            if (hasB) {
              ticks.push({
                ...tick,
                // select the tick index where we will add liquidity
                tickIndexBToA: forward ? tickIndexB : tickIndexA,
                reserveA: new BigNumber(0),
              });
            }

            return ticks;
          })
          .reduce<TickGroup>((ticks, tick) => {
            // find equivalent tick
            const foundTickIndex = ticks.findIndex((searchTick) => {
              return (
                searchTick.tickIndexBToA === tick.tickIndexBToA &&
                searchTick.fee === tick.fee &&
                searchTick.tokenA === tick.tokenA &&
                searchTick.tokenB === tick.tokenB
              );
            });

            // add new tick data into found tick data
            if (foundTickIndex >= 0) {
              const foundTick = ticks[foundTickIndex];
              ticks.splice(foundTickIndex, 1, {
                ...foundTick,
                reserveA: foundTick.reserveA.plus(tick.reserveA),
                reserveB: foundTick.reserveB.plus(tick.reserveB),
              });
            }
            // else append new tick
            else {
              ticks.push(tick);
            }

            return ticks;
          }, []);

        if (filteredUserTicks.length === 0) {
          throw new Error('Ticks not set');
        }

        setData(undefined);
        setIsValidating(true);
        setError(undefined);

        const gasEstimate = filteredUserTicks.reduce((gasEstimate, tick) => {
          const [tickIndex0, tickIndex1] = getVirtualTickIndexes(
            tick.tickIndexBToA,
            tick.fee
          );
          const existingTick =
            tickIndex0 !== undefined && tickIndex1 !== undefined
              ? !!token0Ticks?.find((pairTick) => {
                  return pairTick.tickIndex1To0.isEqualTo(tickIndex0);
                }) &&
                !!token1Ticks?.find((pairTick) => {
                  return pairTick.tickIndex1To0.isEqualTo(tickIndex1);
                })
              : undefined;
          // add 60000 for existing ticks
          // add 50000 more for initializing a new tick
          return gasEstimate + (existingTick ? 60000 : 100000);
          // add 80000 base gas
          // add 60000 for initilizing a new tick pair
        }, 80000 + (!pairTicks ? 60000 : 0));

        const id = `${Date.now()}.${Math.random}`;
        createLoadingToast({ id, description: 'Adding Liquidity...' });

        // wrap transaction logic
        try {
          const client = await rpcClient(web3.wallet);
          const res = await client.signAndBroadcast(
            web3.address,
            [
              dualitylabs.duality.dex.MessageComposer.withTypeUrl.deposit({
                creator: web3Address,
                tokenA: tokenIdA,
                tokenB: tokenIdB,
                receiver: web3Address,
                // note: tick indexes must be in the form of "A to B"
                // as that is what is noted by the key sent to the API
                // but that seems to be we have defined as "B to A"
                tickIndexesAToB: filteredUserTicks.map((tick) =>
                  Long.fromNumber(tick.tickIndexBToA)
                ),
                fees: filteredUserTicks.map((tick) =>
                  Long.fromNumber(tick.fee)
                ),
                amountsA: filteredUserTicks.map((tick) =>
                  tick.reserveA.toFixed(0)
                ),
                amountsB: filteredUserTicks.map((tick) =>
                  tick.reserveB.toFixed(0)
                ),
                // todo: allow user to specify autoswap behavior
                Options: filteredUserTicks.map(() => ({
                  disable_autoswap: false,
                })),
              }),
            ],
            {
              gas: gasEstimate.toFixed(0),
              amount: [
                { amount: (gasEstimate * 0.025).toFixed(0), denom: 'token' },
              ],
            }
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

          // calculate received tokens
          const { receivedTokenA, receivedTokenB } = res.events.reduce<{
            receivedTokenA: BigNumber;
            receivedTokenB: BigNumber;
          }>(
            (acc, event) => {
              // find and process each dex Deposit message created by this user
              if (
                event.type === 'message' &&
                event.attributes.find(
                  ({ key, value }) => key === 'module' && value === 'dex'
                ) &&
                event.attributes.find(
                  ({ key, value }) => key === 'action' && value === 'Deposit'
                ) &&
                event.attributes.find(
                  ({ key, value }) =>
                    key === 'Creator' && value === web3.address
                )
              ) {
                // collect into more usable format for parsing
                const { attributes } =
                  mapEventAttributes<DexDepositEvent>(event);

                // accumulate share values
                // ('NewReserves' is the difference between previous and next share value)
                const shareIncrease0 = new BigNumber(
                  attributes['Reserves0Deposited']
                );
                const shareIncrease1 = new BigNumber(
                  attributes['Reserves1Deposited']
                );
                if (
                  tokenIdA === attributes['Token0'] &&
                  tokenIdB === attributes['Token1']
                ) {
                  acc.receivedTokenA = acc.receivedTokenA.plus(shareIncrease0);
                  acc.receivedTokenB = acc.receivedTokenB.plus(shareIncrease1);
                } else if (
                  tokenIdA === attributes['Token1'] &&
                  tokenIdB === attributes['Token0']
                ) {
                  acc.receivedTokenA = acc.receivedTokenA.plus(shareIncrease1);
                  acc.receivedTokenB = acc.receivedTokenB.plus(shareIncrease0);
                }
              }
              return acc;
            },
            {
              receivedTokenA: new BigNumber(0),
              receivedTokenB: new BigNumber(0),
            }
          );

          // check no shares exception
          if (receivedTokenA.isZero() && receivedTokenB.isZero()) {
            const error: Error & { response?: DeliverTxResponse } = new Error(
              'No new shares received'
            );
            error.response = res;
            checkMsgErrorToast(error, {
              id,
              title: 'No new shares received',
              description:
                'The transaction was successful but no new shares were created',
            });
          }
          // set success
          else if (
            receivedTokenA.isGreaterThanOrEqualTo(0) &&
            receivedTokenB.isGreaterThanOrEqualTo(0)
          ) {
            // update toast
            checkMsgSuccessToast(res, {
              id,
              description: `Deposited ${[
                receivedTokenA.isGreaterThan(0) &&
                  `${formatAmount(
                    getDisplayDenomAmount(tokenA, receivedTokenA) || 0
                  )} ${tokenA.symbol}`,
                receivedTokenB.isGreaterThan(0) &&
                  `${formatAmount(
                    getDisplayDenomAmount(tokenB, receivedTokenB) || 0
                  )} ${tokenB.symbol}`,
              ]
                .filter(Boolean)
                .join(' and ')} (click for more details)`,
            });
            // set new information
            setData({
              gasUsed: gasUsed.toString(),
              receivedTokenA: receivedTokenA.toFixed(),
              receivedTokenB: receivedTokenB.toFixed(),
            });
          }
          // catch other exceptions
          else {
            const error: Error & { response?: DeliverTxResponse } = new Error(
              'Deposit issue'
            );
            error.response = res;
            checkMsgErrorToast(error, {
              id,
              title: 'An unexpected error occured',
              description:
                'The transaction was successful but we could not determine the number of new shares created',
            });
          }

          setIsValidating(false);
        } catch (e) {
          // catch transaction errors
          const err = e as Error & { response?: DeliverTxResponse };
          // chain toast checks so only one toast may be shown
          checkMsgRejectedToast(err, { id }) ||
            checkMsgOutOfGasToast(err, { id }) ||
            checkMsgErrorToast(err, { id });

          // rethrow error to outer try block
          throw e;
        }
      } catch (e) {
        setIsValidating(false);
        setError((e as Error)?.message || (e as string));
        // pass error to console for developer
        // eslint-disable-next-line no-console
        console.error(e);
      }
    },
    [web3.address, web3.wallet, token0, token1, token0Ticks, token1Ticks]
  );

  return [{ data, isValidating, error }, sendDepositRequest];
}
