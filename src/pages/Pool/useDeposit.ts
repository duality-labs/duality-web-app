import { useState, useCallback } from 'react';
import { assertIsDeliverTxSuccess } from '@cosmjs/stargate';
import BigNumber from 'bignumber.js';

import { useWeb3 } from '../../lib/web3/useWeb3';
import { txClient as dexTxClient } from '../../lib/web3/generated/duality/nicholasdotsol.duality.dex/module';
import { MsgSingleDepositResponse } from '../../lib/web3/generated/duality/nicholasdotsol.duality.dex/module/types/dex/tx';
import { Token } from '../../components/TokenPicker/mockHooks';

const { REACT_APP__COIN_MIN_DENOM_EXP = '18' } = process.env;
const denomExponent = parseInt(REACT_APP__COIN_MIN_DENOM_EXP) || 0;
const denomRatio = new BigNumber(10).exponentiatedBy(denomExponent);

export function useDeposit(): [
  {
    data?: MsgSingleDepositResponse;
    isValidating?: boolean;
    error?: string;
  },
  (
    tokenA: Token | undefined,
    tokenB: Token | undefined,
    amount0: BigNumber | undefined,
    amount1: BigNumber | undefined
  ) => Promise<string | void>
] {
  const [data, setData] = useState<MsgSingleDepositResponse>();
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string>();
  const web3 = useWeb3();

  const sendDepositRequest = useCallback(
    async function (
      tokenA: Token | undefined,
      tokenB: Token | undefined,
      amount0: BigNumber | undefined,
      amount1: BigNumber | undefined
    ) {
      return new Promise<string | void>(async function (resolve) {
        try {
          const result = await (async function () {
            // check for correct inputs
            if (!web3.address || !web3.wallet) {
              throw new Error('Wallet not connected');
            }
            if (!tokenA || !tokenB) {
              throw new Error('Tokens not set');
            }
            if (
              !amount0 ||
              !amount1 ||
              amount0.isLessThan(0) ||
              amount1.isLessThan(0)
            ) {
              throw new Error('Amounts not set');
            }
            if (!amount0.isGreaterThan(0) && !amount1.isGreaterThan(0)) {
              throw new Error('Amounts are zero');
            }

            setData(undefined);
            setIsValidating(true);
            setError(undefined);

            // add each tick message into a signed broadcast
            const client = await dexTxClient(web3.wallet);
            const res = await client.signAndBroadcast([
              client.msgSingleDeposit({
                creator: web3.address,
                token0: tokenA.address,
                token1: tokenB.address,
                receiver: web3.address,
                // fake some price points and amounts that can be tested in dev
                price: new BigNumber(1).toFixed(denomExponent),
                fee: new BigNumber(0).toFixed(denomExponent),
                amounts0: amount0.dividedBy(denomRatio).toFixed(denomExponent),
                amounts1: amount1.dividedBy(denomRatio).toFixed(denomExponent),
              }),
            ]);

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

            // return new information
            setData({ sharesMinted: '' });
            setIsValidating(false);

            return gasUsed.toString();
          })();
          resolve(result);
        } catch (e) {
          setIsValidating(false);
          setError((e as Error)?.message || (e as string));
          resolve();
        }
      });
    },
    [web3.address, web3.wallet]
  );

  return [{ data, isValidating, error }, sendDepositRequest];
}
