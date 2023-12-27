import { useEffect, useMemo } from 'react';
import { useDeepCompareMemoize } from 'use-deep-compare-effect';
import { UseQueryResult, useInfiniteQuery } from '@tanstack/react-query';
import { PageRequest } from '@duality-labs/dualityjs/types/codegen/cosmos/base/query/v1beta1/pagination';
import { QueryAllBalancesResponse } from '@duality-labs/dualityjs/types/codegen/cosmos/bank/v1beta1/query';
import { Coin } from '@cosmjs/proto-signing';

import subscriber from '../subscriptionManager';
import { Token, getDenomAmount } from '../utils/tokens';
import useTokens, {
  matchTokenByDenom,
  matchTokens,
  useTokensWithIbcInfo,
} from './useTokens';
import { useLcdClientPromise } from '../lcdClient';
import { useWeb3 } from '../useWeb3';
import { isDexShare } from '../utils/shares';
import { MessageActionEvent, TendermintTxData } from '../events';
import { CoinTransferEvent, mapEventAttributes } from '../utils/events';
import { useFetchAllPaginatedPages } from './useQueries';

// fetch all the user's bank balance
function useAllUserBankBalances(): UseQueryResult<Coin[]> {
  const lcdClientPromise = useLcdClientPromise();
  const { address } = useWeb3();

  const result = useInfiniteQuery({
    queryKey: ['cosmos.bank.v1beta1.allBalances', address],
    enabled: !!address,
    queryFn: async ({
      pageParam: pageKey,
    }: {
      pageParam: Uint8Array | undefined;
    }): Promise<QueryAllBalancesResponse> => {
      const client = await lcdClientPromise;
      return client.cosmos.bank.v1beta1.allBalances({
        address: address || '',
        pagination: {
          key: pageKey || [],
        } as PageRequest,
      });
    },
    defaultPageParam: undefined as Uint8Array | undefined,
    getNextPageParam: (lastPage): Uint8Array | undefined => {
      // don't pass an empty array as that will trigger another page to download
      return lastPage?.pagination?.next_key?.length
        ? lastPage?.pagination?.next_key ?? undefined
        : undefined;
    },
  });

  const { refetch } = result;
  // subscribe to updates to the user's bank balance
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

        // todo: use partial updates to avoid querying all of user's balances
        //       on any balance update, but decide first whether to requests
        //       an update to all the user's balances, or just partial updates
        if (transferBalanceEvents.length >= 3) {
          // update all known users balances
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

  // fetch all pages
  useFetchAllPaginatedPages(result);

  // combine all non-zero balances
  const pages = result.data?.pages;
  const allNonZeroBalances = useMemo(() => {
    const combinedBalances = pages?.flatMap((page) => page.balances);
    const nonZeroBalances = combinedBalances?.filter(
      (balance) => !!Number(balance.amount)
    );
    return nonZeroBalances;
  }, [pages]);

  return {
    ...result,
    data: useDeepCompareMemoize(allNonZeroBalances),
  } as UseQueryResult<Coin[]>;
}

export function useUserDexDenomBalances(): UseQueryResult<Coin[]> {
  const result = useAllUserBankBalances();
  // filter the data to only Dex coins
  const data = useMemo(() => {
    return result.data?.filter((balance) => !!isDexShare(balance));
  }, [result.data]);
  return {
    ...result,
    data,
  } as UseQueryResult<Coin[]>;
}

function useUserChainDenomBalances(): UseQueryResult<Coin[]> {
  const result = useAllUserBankBalances();
  // filter the data to only plain coins
  const data = useMemo(() => {
    return result.data?.filter((balance) => !isDexShare(balance));
  }, [result.data]);
  return {
    ...result,
    data,
  } as UseQueryResult<Coin[]>;
}

// define TokenCoin to represent a Coin paired with its chain-registry token
export interface TokenCoin extends Coin {
  token: Token;
}
export function useUserBankBalances(): UseQueryResult<TokenCoin[]> {
  const result = useUserChainDenomBalances();

  // add token information to balances
  const allTokensWithIBC = useTokensWithIbcInfo(useTokens());
  const data = useMemo<TokenCoin[] | undefined>(() => {
    // check all known tokens with IBC context for matching balance denoms
    return result.data?.reduce<TokenCoin[]>((result, balance) => {
      const token = allTokensWithIBC.find(matchTokenByDenom(balance.denom));
      if (token) {
        result.push({ token, ...balance });
      }
      return result;
    }, []);
  }, [result.data, allTokensWithIBC]);

  return {
    ...result,
    data,
  } as UseQueryResult<TokenCoin[]>;
}

// note: if dealing with IBC tokens, ensure Token has IBC context
//       (by fetching it with useTokensWithIbcInfo)
function useUserBankBalance(
  token: Token | undefined
): UseQueryResult<TokenCoin> {
  const { data: balances, ...rest } = useUserBankBalances();
  const balance = useMemo(() => {
    // find the balance that matches the token
    return (
      token && balances?.find((balance) => matchTokens(balance.token, token))
    );
  }, [balances, token]);
  return { data: balance, ...rest } as UseQueryResult<TokenCoin>;
}

// the bank balances may be in denoms that are neither base or display units
// convert them to base or display units with the following handler functions
export function useBankBalanceBaseAmount(
  token: Token | undefined
): UseQueryResult<string> {
  const { data: balance, ...rest } = useUserBankBalance(token);
  const balanceAmount = useMemo(() => {
    return (
      balance &&
      getDenomAmount(
        balance.token,
        balance.amount,
        balance.denom,
        balance.token.base
      )
    );
  }, [balance]);
  return { data: balanceAmount, ...rest } as UseQueryResult<string>;
}
export function useBankBalanceDisplayAmount(
  token: Token | undefined
): UseQueryResult<string> {
  const { data: balance, ...rest } = useUserBankBalance(token);
  const balanceAmount = useMemo(() => {
    return (
      balance &&
      getDenomAmount(
        balance.token,
        balance.amount,
        balance.denom,
        balance.token.display
      )
    );
  }, [balance]);
  return { data: balanceAmount, ...rest } as UseQueryResult<string>;
}
