import { useEffect, useMemo } from 'react';
import { UseQueryResult, useInfiniteQuery } from '@tanstack/react-query';
import { DepositRecord } from '@duality-labs/neutronjs/types/codegen/neutron/dex/deposit_record';
import { useDeepCompareMemoize } from 'use-deep-compare-effect';

import subscriber from '../subscriptionManager';
import { useWeb3 } from '../useWeb3';
import { MessageActionEvent, TendermintTxData } from '../events';
import { CoinTransferEvent, mapEventAttributes } from '../utils/events';
import { TokenIdPair, TokenPair, resolveTokenIdPair } from '../utils/tokens';
import { minutes } from '../../utils/time';
import { useDexRestClientPromise } from '../clients/restClients';
import { QueryAllUserDepositsResponse } from '@duality-labs/neutronjs/types/codegen/neutron/dex/query';
import { useFetchAllPaginatedPages } from './useQueries';

function useAllUserDeposits(): UseQueryResult<DepositRecord[]> {
  const { address } = useWeb3();

  const restClientPromise = useDexRestClientPromise();
  const result = useInfiniteQuery({
    queryKey: ['user-deposits', address],
    enabled: !!address,
    queryFn: async ({
      pageParam: pageKey,
    }: {
      pageParam: Uint8Array | undefined;
    }): Promise<QueryAllUserDepositsResponse | undefined> => {
      if (address) {
        // get LCD client
        const lcd = await restClientPromise;
        // get all user's deposits
        const response = await lcd.dex.userDepositsAll({
          address,
          pagination: { key: pageKey },
        });
        // return unwrapped result
        return response;
      }
    },
    defaultPageParam: undefined as Uint8Array | undefined,
    getNextPageParam: (lastPage): Uint8Array | undefined => {
      // don't pass an empty array as that will trigger another page to download
      return lastPage?.pagination?.next_key?.length
        ? lastPage?.pagination?.next_key ?? undefined
        : undefined;
    },
    refetchInterval: 5 * minutes,
  });

  // fetch all pages
  useFetchAllPaginatedPages(result);

  // combine all deposits and sort them
  const userDeposits = useMemo(() => {
    console.log('result', result.data)
    return result.data?.pages
      ?.flatMap((deposits) => deposits?.deposits || [])
      .sort(
        (a, b) =>
          a.center_tick_index.sub(b.center_tick_index).toNumber() ||
          b.fee.sub(a.fee).toNumber()
      );
  }, [result.data]);

  const { refetch } = result;

  // on update to user's bank balance, we should update the user's sharesOwned
  useEffect(() => {
    if (address) {
      const onTxBalanceUpdate = (
        _event: MessageActionEvent,
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

  return { ...result, data: userDeposits } as UseQueryResult<DepositRecord[]>;
}

export function useUserDeposits(
  tokenPair?: TokenPair | TokenIdPair
): UseQueryResult<DepositRecord[] | undefined> {
  const tokenPairIDs = useDeepCompareMemoize(resolveTokenIdPair(tokenPair));

  const result = useAllUserDeposits();
  const userDeposits = useDeepCompareMemoize(result.data);
  const userDepositsOfTokenPair = useMemo(() => {
    // if a pair ID request was given then filter the response
    if (tokenPairIDs) {
      const [tokenIdA, tokenIdB] = tokenPairIDs || [];
      if (tokenIdA && tokenIdB) {
        const tokenIDs = [tokenIdA, tokenIdB];
        return userDeposits?.filter((deposit) => {
          return (
            tokenIDs.includes(deposit.pair_id.token0) &&
            tokenIDs.includes(deposit.pair_id.token1)
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

export function useUserHasDeposits(
  tokenPair?: TokenPair | TokenIdPair
): UseQueryResult<boolean | undefined> {
  const result = useUserDeposits(tokenPair);
  return {
    ...result,
    data: result.data && result.data.length > 0,
  } as UseQueryResult<boolean | undefined>;
}
