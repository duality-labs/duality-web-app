import { useState, useCallback } from 'react';
import { assertIsDeliverTxSuccess } from '@cosmjs/stargate';
import { Log } from '@cosmjs/stargate/build/logs';
import BigNumber from 'bignumber.js';

import { useWeb3 } from '../../lib/web3/useWeb3';
import { txClient as dexTxClient } from '../../lib/web3/generated/duality/nicholasdotsol.duality.dex/module';
import { Token } from '../../components/TokenPicker/hooks';
import { DexShare } from '../../lib/web3/generated/duality/nicholasdotsol.duality.dex/module/rest';
import { TickInfo } from '../../lib/web3/indexerProvider';

const { REACT_APP__COIN_MIN_DENOM_EXP = '18' } = process.env;
const denomExponent = parseInt(REACT_APP__COIN_MIN_DENOM_EXP) || 0;

export interface ShareValue {
  share: DexShare;
  token0: Token;
  token1: Token;
  userReserves0?: BigNumber;
  userReserves1?: BigNumber;
}
export interface TickShareValue extends ShareValue {
  tick: TickInfo;
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
      return new Promise<void>(async function (resolve, reject) {
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

          // add each tick message into a signed broadcast
          const client = await dexTxClient(web3.wallet);
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
                return share.price &&
                  share.fee &&
                  share.shareAmount &&
                  token0.address &&
                  token1.address &&
                  userReserves0 &&
                  userReserves1
                  ? [
                      ...(!tickDiff0.isZero()
                        ? [
                            tickDiff0.isGreaterThan(0)
                              ? client.msgSingleDeposit({
                                  creator: web3Address,
                                  token0: token0.address,
                                  token1: token1.address,
                                  receiver: web3Address,
                                  price: share.price,
                                  fee: share.fee,
                                  amounts0: tickDiff0
                                    // .shiftedBy(-denomShiftExponent)
                                    .toFixed(
                                      denomExponent,
                                      BigNumber.ROUND_HALF_UP
                                    ),
                                  amounts1: '0',
                                })
                              : client.msgSingleWithdraw({
                                  creator: web3Address,
                                  token0: token0.address,
                                  token1: token1.address,
                                  receiver: web3Address,
                                  price: share.price,
                                  fee: share.fee,
                                  // approximate removal using percentages
                                  // todo: this probably has a bug when withdrawing from a tick
                                  // that has both token0 and token1 as this only takes into account one side
                                  sharesRemoving: tickDiff0
                                    .negated()
                                    .dividedBy(userReserves0)
                                    .multipliedBy(share.shareAmount)
                                    .toFixed(
                                      denomExponent,
                                      BigNumber.ROUND_HALF_UP
                                    ),
                                }),
                          ]
                        : []),
                      ...(!tickDiff1.isZero()
                        ? [
                            tickDiff1.isGreaterThan(0)
                              ? client.msgSingleDeposit({
                                  creator: web3Address,
                                  token0: token0.address,
                                  token1: token1.address,
                                  receiver: web3Address,
                                  price: share.price,
                                  fee: share.fee,
                                  amounts0: '0',
                                  amounts1: tickDiff1
                                    // .shiftedBy(-denomShiftExponent)
                                    .toFixed(
                                      denomExponent,
                                      BigNumber.ROUND_HALF_UP
                                    ),
                                })
                              : client.msgSingleWithdraw({
                                  creator: web3Address,
                                  token0: token0.address,
                                  token1: token1.address,
                                  receiver: web3Address,
                                  price: share.price,
                                  fee: share.fee,
                                  // approximate removal using percentages
                                  // todo: this probably has a bug when withdrawing from a tick
                                  // that has both token0 and token1 as this only takes into account one side
                                  sharesRemoving: tickDiff1
                                    .negated()
                                    .dividedBy(userReserves1)
                                    .multipliedBy(share.shareAmount)
                                    .toFixed(
                                      denomExponent,
                                      BigNumber.ROUND_HALF_UP
                                    ),
                                }),
                          ]
                        : []),
                    ]
                  : [];
              }
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
            // eslint-disable-next-line no-console
            console.warn(`Failed to send tx (code: ${code}): ${rawLog}`);
            throw new Error(`Tx error: ${code}`);
          }

          const foundLogs: Log[] = JSON.parse(res.rawLog || '[]');
          const foundEvents = foundLogs.flatMap((log) => log.events);
          // eslint-disable-next-line no-console
          console.log('foundLogs and foundEvents', foundLogs, foundEvents);

          // set new information
          setData({
            gasUsed: gasUsed.toString(),
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

  return [{ data, isValidating, error }, sendEditRequest];
}
