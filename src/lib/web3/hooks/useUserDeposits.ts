import { useEffect, useMemo } from 'react';
import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { dualitylabs } from '@duality-labs/dualityjs';
import { DepositRecord } from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/dex/deposit_record';
import { useDeepCompareMemoize } from 'use-deep-compare-effect';

import subscriber from '../subscriptionManager';
import { useWeb3 } from '../useWeb3';
import { MessageActionEvent, TendermintTxData } from '../events';
import { CoinTransferEvent, mapEventAttributes } from '../utils/events';
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
        return response.Deposits.sort(
          (a, b) =>
            a.centerTickIndex.sub(b.centerTickIndex).toNumber() ||
            b.fee.sub(a.fee).toNumber()
        );
      }
    },
    refetchInterval: 5 * minutes,
  });

  const refetch = result.refetch;

  // on update to user's bank balance, we should update the user's sharesOwned
  useEffect(() => {
    if (address) {
      const onTxBalanceUpdate = (
        event: MessageActionEvent,
        tx: TendermintTxData
      ) => {
        const events = tx.value.TxResult.result.events.map(mapEventAttributes);
        const transferBalanceEvents = events
          .filter(
            (event): event is CoinTransferEvent => event.type === 'transfer'
          )
          .filter(
            (event) =>
              event.attributes.recipient === address ||
              event.attributes.sender === address
          );

        // todo: use partial updates to avoid querying all of user's deposits
        //       on any balance update, but decide first whether to requests
        //       an update to all the user's deposits, or just partial updates
        if (transferBalanceEvents.length >= 3) {
          // update all known users shares
          refetch({ cancelRefetch: false });
        } else {
          // todo: add partial update logic here
          refetch({ cancelRefetch: false });
        }
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
  tokenPair?: TokenPair | TokenIdPair
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
