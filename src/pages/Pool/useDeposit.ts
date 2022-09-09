import { useState, useCallback } from 'react';
import { assertIsDeliverTxSuccess } from '@cosmjs/stargate';
import { Log } from '@cosmjs/stargate/build/logs';
import BigNumber from 'bignumber.js';

import { useWeb3 } from '../../lib/web3/useWeb3';
import { txClient as dexTxClient } from '../../lib/web3/generated/duality/nicholasdotsol.duality.dex/module';
import { Token } from '../../components/TokenPicker/mockHooks';

const { REACT_APP__COIN_MIN_DENOM_EXP = '18' } = process.env;
const denomExponent = parseInt(REACT_APP__COIN_MIN_DENOM_EXP) || 0;

interface SendDepositResponse {
  gasUsed: string;
  receivedTokenA: string;
  receivedTokenB: string;
}

// todo: resolve with TickGroup in LiquiditySelector component
type TickGroup = Array<
  [price: BigNumber, amount0: BigNumber, amount1: BigNumber]
>;

export function useDeposit(): [
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
      return new Promise<void>(async function (resolve, reject) {
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
          // check all user ticks and filter to non-zero ticks
          const filteredUserTicks = userTicks.filter(
            ([price, amount0, amount1]) => {
              if (!price || price.isLessThan(0)) {
                throw new Error('Price not set');
              }
              if (
                !amount0 ||
                !amount1 ||
                amount0.isLessThan(0) ||
                amount1.isLessThan(0)
              ) {
                throw new Error('Amounts not set');
              }
              return amount0.isGreaterThan(0) || amount1.isGreaterThan(0);
            }
          );

          setData(undefined);
          setIsValidating(true);
          setError(undefined);

          // add each tick message into a signed broadcast
          const client = await dexTxClient(web3.wallet);
          const res = await client.signAndBroadcast(
            filteredUserTicks.map(([price, amount0, amount1]) =>
              client.msgSingleDeposit({
                creator: web3Address,
                token0: tokenA.address,
                token1: tokenB.address,
                receiver: web3Address,
                price: price.toFixed(denomExponent),
                fee: fee.toFixed(denomExponent),
                amounts0: amount0.toFixed(denomExponent),
                amounts1: amount1.toFixed(denomExponent),
              })
            )
          );

          // check for response
          if (!res) {
            throw new Error('No response');
          }

          // check for response errors
          const { code, gasUsed, rawLog } = res;
          assertIsDeliverTxSuccess(res);
          if (code) {
            // eslint-disable-next-line
            console.warn(`Failed to send tx (code: ${code}): ${rawLog}`);
            throw new Error(`Tx error: ${code}`);
          }

          const foundLogs: Log[] = JSON.parse(res.rawLog || '[]');
          const foundEvents = foundLogs.flatMap((log) => log.events);
          const { receivedTokenA, receivedTokenB } = foundEvents.reduce<{
            receivedTokenA: string;
            receivedTokenB: string;
          }>(
            (acc, event) => {
              if (event.type === 'transfer') {
                event.attributes.forEach((attr, index, attrs) => {
                  // if this attribute is the amount
                  if (index > 0 && attr.key === 'amount') {
                    // and the previous attribute was the sender
                    const previousAttr = attrs[index - 1];
                    if (
                      previousAttr?.key === 'sender' &&
                      previousAttr?.value === web3.address
                    ) {
                      // read the matching tokens into their values
                      if (attr.value.endsWith(tokenA.denom.toLowerCase())) {
                        acc.receivedTokenA = attr.value.slice(
                          0,
                          0 - tokenA.denom.length
                        );
                      }
                      if (attr.value.endsWith(tokenB.denom.toLowerCase())) {
                        acc.receivedTokenB = attr.value.slice(
                          0,
                          0 - tokenB.denom.length
                        );
                      }
                    }
                  }
                });
              }
              return acc;
            },
            { receivedTokenA: '0', receivedTokenB: '0' }
          );

          if (!receivedTokenA && !receivedTokenB) {
            throw new Error('No new shares received');
          }

          // set new information
          setData({
            gasUsed: gasUsed.toString(),
            receivedTokenA,
            receivedTokenB,
          });
          setIsValidating(false);
          resolve();
        } catch (e) {
          reject(e);
        }
      }).catch((e: Error | string) => {
        setIsValidating(false);
        setError((e as Error)?.message || (e as string));
      });
    },
    [web3.address, web3.wallet]
  );

  return [{ data, isValidating, error }, sendDepositRequest];
}
