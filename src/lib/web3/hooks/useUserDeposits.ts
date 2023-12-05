import { useEffect, useMemo } from 'react';
import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { dualitylabs } from '@duality-labs/dualityjs';
import { DepositRecord } from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/dex/deposit_record';
import { useDeepCompareMemoize } from 'use-deep-compare-effect';

import subscriber from '../subscriptionManager';
import { useWeb3 } from '../useWeb3';
import { TokenIdPair, TokenPair, resolveTokenIdPair } from '../utils/tokens';
import { minutes } from '../../utils/time';

const { REACT_APP__REST_API = '' } = process.env;

export function useUserDeposits(): UseQueryResult<DepositRecord[] | undefined> {
  const { address } = useWeb3();

  const result = useQuery({
    queryKey: ['user-deposits', address],
    enabled: !!address,
    queryFn: async (): Promise<DepositRecord[] | undefined> => {
      if (address) {
        // get LCD client
        const lcd = await dualitylabs.ClientFactory.createLCDClient({
          restEndpoint: REACT_APP__REST_API,
        });
        // get all user's deposits
        const response = await lcd.dualitylabs.duality.dex.userDepositsAll({
          address,
        });
        // return unwrapped result
        return response.Deposits;
      }
    },
    refetchInterval: 5 * minutes,
  });

  const refetch = result.refetch;

  // on update to user's bank balance, we should update the user's sharesOwned
  useEffect(() => {
    if (address) {
      // todo: use partial updates to avoid querying all of the user's deposits
      //       on any balance update, though sometimes it may be better if
      //       all updates are processed together like this.
      //       eg. a 30 tick deposit can trigger 30 requests or use "update all"
      const onTxBalanceUpdate = () => {
        refetch({ cancelRefetch: false });
      };
      // subscribe to changes in the user's bank balance
      subscriber.subscribeMessage(onTxBalanceUpdate, {
        transfer: { recipient: address },
      });
      subscriber.subscribeMessage(onTxBalanceUpdate, {
        transfer: { sender: address },
      });
      return () => {
        subscriber.unsubscribeMessage(onTxBalanceUpdate);
      };
    }
  }, [refetch, address]);

  return result;
}

export function useUserDepositsOfTokenPair(
  tokenPair: TokenPair | TokenIdPair | undefined
): UseQueryResult<DepositRecord[] | undefined> {
  const tokenPairIDs = useDeepCompareMemoize(resolveTokenIdPair(tokenPair));

  const result = useUserDeposits();
  const userDeposits = useDeepCompareMemoize(result.data);
  const userDepositsOfTokenPair = useMemo(() => {
    // if a pair ID request was given then filter the response
    if (tokenPairIDs) {
      const [tokenIdA, tokenIdB] = tokenPairIDs || [];
      if (tokenIdA && tokenIdB) {
        const tokenIDs = [tokenIdA, tokenIdB];
        return userDeposits?.filter((deposit) => {
          return (
            tokenIDs.includes(deposit.pairID.token0) &&
            tokenIDs.includes(deposit.pairID.token1)
          );
        });
      }
      // return filtered deposits with no match
      return [];
    }
    // return unfiltered deposits with all matches
    return userDeposits;
  }, [tokenPairIDs, userDeposits]);

  return {
    ...result,
    data: userDepositsOfTokenPair,
  } as UseQueryResult<DepositRecord[] | undefined>;
}
