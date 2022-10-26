import { useState, useCallback } from 'react';
import { assertIsDeliverTxSuccess, DeliverTxResponse } from '@cosmjs/stargate';
import { Log } from '@cosmjs/stargate/build/logs';
import BigNumber from 'bignumber.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheckCircle,
  faCircleNotch,
  faGasPump,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';

import { toast } from '../../components/Notifications';

import { useWeb3 } from '../../lib/web3/useWeb3';
import { txClient as dexTxClient } from '../../lib/web3/generated/duality/nicholasdotsol.duality.dex/module';
import { Token } from '../../components/TokenPicker/hooks';
import { TickGroup } from '../../components/LiquiditySelector/LiquiditySelector';

const {
  REACT_APP__REST_API,
  REACT_APP__COIN_MIN_DENOM_EXP = '18',
  REACT_APP__COIN_MIN_DENOM_SHIFT_EXP = '12',
} = process.env;
const denomExponent = parseInt(REACT_APP__COIN_MIN_DENOM_EXP) || 0;
const denomShiftExponent = parseInt(REACT_APP__COIN_MIN_DENOM_SHIFT_EXP) || 0;

// standard error codes can be found in https://github.com/cosmos/cosmos-sdk/blob/v0.45.4/types/errors/errors.go
// however custom modules may register additional error codes
const REQUEST_SUCCESS = 0;
const ERROR_OUT_OF_GAS = 11;

interface SendDepositResponse {
  gasUsed: string;
  receivedTokenA: string;
  receivedTokenB: string;
}

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
              amount0.isNaN() ||
              amount1.isNaN() ||
              amount0.isLessThan(0) ||
              amount1.isLessThan(0)
            ) {
              throw new Error('Amounts not set');
            }
            return amount0.isGreaterThan(0) || amount1.isGreaterThan(0);
          }
        );

        if (filteredUserTicks.length === 0) {
          throw new Error('Ticks not set');
        }

        setData(undefined);
        setIsValidating(true);
        setError(undefined);

        // do not make requests if they are not routable
        if (!tokenA.address) {
          throw new Error(
            `Token ${tokenA.symbol} has no address on the Duality chain`
          );
        }
        if (!tokenB.address) {
          throw new Error(
            `Token ${tokenB.symbol} has no address on the Duality chain`
          );
        }

        const id = `${Date.now()}.${Math.random}`;
        toast.loading('Loading', {
          id,
          description: 'Executing your trade',
          icon: <FontAwesomeIcon icon={faCircleNotch} spin />,
          duration: Infinity,
          dismissable: true,
        });

        // wrap transaction logic
        try {
          // add each tick message into a signed broadcast
          const client = await dexTxClient(web3.wallet);
          const res = await client.signAndBroadcast(
            filteredUserTicks.flatMap(([price, amount0, amount1]) =>
              tokenA.address && tokenB.address
                ? client.msgSingleDeposit({
                    creator: web3Address,
                    token0: tokenA.address,
                    token1: tokenB.address,
                    receiver: web3Address,
                    price: price.toFixed(denomExponent),
                    fee: fee.toFixed(denomExponent),
                    amounts0: amount0
                      .shiftedBy(-denomShiftExponent)
                      .toFixed(denomExponent, BigNumber.ROUND_HALF_UP),
                    amounts1: amount1
                      .shiftedBy(-denomShiftExponent)
                      .toFixed(denomExponent, BigNumber.ROUND_HALF_UP),
                  })
                : []
            )
          );

          // check for response
          if (!res) {
            throw new Error('No response');
          }

          // check for response errors
          try {
            assertIsDeliverTxSuccess(res);
          } catch {
            const error: Error & { response?: DeliverTxResponse } = new Error(
              `Tx error: ${res.code}`
            );
            error.response = res;
            throw error;
          }
          const { code, gasUsed, rawLog, transactionHash } = res;
          if (code === REQUEST_SUCCESS) {
            toast.success('Transaction Successful', {
              id,
              description: 'View more details',
              descriptionLink: `${REACT_APP__REST_API}/cosmos/tx/v1beta1/txs/${transactionHash}`,
              icon: <FontAwesomeIcon icon={faCheckCircle} color="#5bc7b7" />,
              duration: 15e3,
              dismissable: true,
            });
          } else {
            // eslint-disable-next-line
            console.warn(`Failed to send tx (code: ${code}): ${rawLog}`);
            const error: Error & { response?: DeliverTxResponse } = new Error(
              `Tx error: ${code}`
            );
            error.response = res;
            throw error;
          }
          const foundLogs: Log[] = JSON.parse(res.rawLog || '[]');
          const foundEvents = foundLogs.flatMap((log) => log.events);
          // todo: use parseCoins from '@cosmjs/launchpad' here
          // to simplify the parsing of the response
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
                      if (
                        attr.value.endsWith(
                          tokenA.denom_units[1]?.denom.toLowerCase()
                        )
                      ) {
                        acc.receivedTokenA = new BigNumber(
                          acc.receivedTokenA || 0
                        )
                          .plus(
                            new BigNumber(
                              attr.value.slice(
                                0,
                                0 - tokenA.denom_units[1].denom.length
                              )
                            ).shiftedBy(-denomExponent + denomShiftExponent)
                          )
                          .toFixed(denomExponent);
                      }
                      if (
                        attr.value.endsWith(
                          tokenB.denom_units[1]?.denom.toLowerCase()
                        )
                      ) {
                        acc.receivedTokenB = new BigNumber(
                          acc.receivedTokenB || 0
                        )
                          .plus(
                            new BigNumber(
                              attr.value.slice(
                                0,
                                0 - tokenB.denom_units[1].denom.length
                              )
                            ).shiftedBy(-denomExponent + denomShiftExponent)
                          )
                          .toFixed(denomExponent);
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
        } catch (e) {
          // catch transaction errors
          const err = e as Error & { response?: DeliverTxResponse };

          if (!err.response && err?.message.includes('rejected')) {
            toast.error('Transaction Rejected', {
              id,
              description: 'You declined the transaction',
              icon: <FontAwesomeIcon icon={faXmark} color="red" />,
              duration: 5e3,
              dismissable: true,
            });
          } else if (err?.response?.code === ERROR_OUT_OF_GAS) {
            const { gasUsed, gasWanted, transactionHash } = err?.response;
            toast.error('Transaction Failed', {
              id,
              description: `Out of gas (used: ${gasUsed.toLocaleString(
                'en-US'
              )} wanted: ${gasWanted.toLocaleString('en-US')})`,
              descriptionLink: `${REACT_APP__REST_API}/cosmos/tx/v1beta1/txs/${transactionHash}`,
              icon: <FontAwesomeIcon icon={faGasPump} color="var(--error)" />,
              duration: Infinity,
              dismissable: true,
            });
          } else {
            const { transactionHash } = err?.response || {};
            toast.error('Transaction Failed', {
              id,
              description: 'Something went wrong, please try again',
              descriptionLink: `${REACT_APP__REST_API}/cosmos/tx/v1beta1/txs/${transactionHash}`,
              icon: '🤔',
              duration: Infinity,
              dismissable: true,
            });
          }

          // rethrow error to outer try block
          throw e;
        }
      } catch (e) {
        setIsValidating(false);
        setError((e as Error)?.message || (e as string));
      }
    },
    [web3.address, web3.wallet]
  );

  return [{ data, isValidating, error }, sendDepositRequest];
}
