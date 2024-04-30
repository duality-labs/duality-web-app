import BigNumber from 'bignumber.js';
import Long from 'long';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LimitOrderTrancheUser } from '@duality-labs/neutronjs/types/codegen/neutron/dex/limit_order_tranche_user';
import type {
  QueryGetLimitOrderTrancheRequest,
  QueryGetLimitOrderTrancheResponse,
  QueryGetLimitOrderTrancheUserResponse,
} from '@duality-labs/neutronjs/types/codegen/neutron/dex/query';

import { getPairID } from '../utils/pairs';
import { orderTypeEnum } from '../utils/limitOrders';
import { GetTxsEventResponseManuallyType } from '../../../pages/Pool/hooks/useTransactionTableData';

import {
  DexCancelLimitOrderEvent,
  DexEvent,
  DexEventAction,
  DexPlaceLimitOrderEvent,
  DexWithdrawLimitOrderEvent,
  getReceivedTokenAmount,
  mapEventAttributes,
} from '../utils/events';

import { useWeb3 } from '../useWeb3';
import { useDexRpcQueryClient } from '../clients/rpcClients';
import { useDexRestClientPromise } from '../clients/restClients';
import { useSwrResponseFromReactQuery } from './useSWR';

const { REACT_APP__RPC_API = '' } = import.meta.env;

export function useTranche(placeLimitOrderEvent?: DexPlaceLimitOrderEvent) {
  // use RPC client due to denom "/" character parsing issues in the REST API
  const rpcClient = useDexRpcQueryClient();

  const trancheRequest = useMemo<
    QueryGetLimitOrderTrancheRequest | undefined
  >(() => {
    if (placeLimitOrderEvent) {
      const attr = placeLimitOrderEvent.attributes;
      return {
        pair_id: getPairID(attr.TokenZero, attr.TokenOne),
        tick_index: Long.fromString(attr.LimitTick).negate(),
        token_in: attr.TokenIn,
        tranche_key: attr.TrancheKey,
      };
    }
  }, [placeLimitOrderEvent]);

  const { data, ...state } = useQuery({
    queryKey: ['dex.limitOrderTranche', trancheRequest],
    enabled: !!rpcClient && !!trancheRequest,
    queryFn: (): Promise<QueryGetLimitOrderTrancheResponse> | undefined => {
      return trancheRequest && rpcClient?.dex.limitOrderTranche(trancheRequest);
    },
  });

  return useSwrResponseFromReactQuery(data, state);
}

export function useUserTranche(trancheKey?: string) {
  const { address } = useWeb3();
  const restClientPromise = useDexRestClientPromise();

  const { data, ...state } = useQuery({
    queryKey: ['dex.LimitOrderTrancheUser', address, trancheKey],
    enabled: !!address && !!trancheKey,
    queryFn: async (): Promise<
      QueryGetLimitOrderTrancheUserResponse | undefined
    > => {
      const client = await restClientPromise;
      return address && trancheKey
        ? client?.dex.limitOrderTrancheUser({
            address,
            tranche_key: trancheKey,
          })
        : undefined;
    },
  });

  return useSwrResponseFromReactQuery(data, state);
}

const cancelLimitOrder: DexEventAction = 'CancelLimitOrder';
const withdrawLimitOrder: DexEventAction = 'WithdrawLimitOrder';
const openLimitOrderActions: DexEventAction[] = [
  cancelLimitOrder,
  withdrawLimitOrder,
];
type DexOpenLimitOrderEvent =
  | DexCancelLimitOrderEvent
  | DexWithdrawLimitOrderEvent;

export function useUserInactiveTranche(
  placeLimitOrderEvent?: DexPlaceLimitOrderEvent
) {
  const { address } = useWeb3();

  const trancheKey = placeLimitOrderEvent?.attributes.TrancheKey;
  const tokenZero = placeLimitOrderEvent?.attributes.TokenZero;
  const tokenOne = placeLimitOrderEvent?.attributes.TokenOne;
  const { data, ...state } = useQuery({
    queryKey: [
      'dex.LimitOrderTrancheUser',
      address,
      tokenZero,
      tokenOne,
      trancheKey,
    ],
    enabled: !!address && !!trancheKey,
    queryFn: async (): Promise<
      QueryGetLimitOrderTrancheUserResponse | undefined
    > => {
      if (placeLimitOrderEvent && tokenZero && tokenOne) {
        const response = await fetch(
          `${REACT_APP__RPC_API}/tx_search?query="${encodeURIComponent(
            [
              `message.module='${'dex'}'`,
              `message.TokenZero='${tokenZero}'`,
              `message.TokenOne='${tokenOne}'`,
              `message.TrancheKey='${trancheKey}'`,
              // don't filter to action here: query does not support "OR"
              // don't filter to user here: user may not be the action Creator
            ]
              .filter(Boolean)
              .join(' AND ')
          )}"`
        );
        const result: GetTxsEventResponseManuallyType = await response.json();
        const txs = result.result.txs.filter((tx) => {
          const events = tx.tx_result.events.map(mapEventAttributes);
          return (
            address &&
            // filter to txs that have the expected action
            events.find((event): event is DexEvent =>
              openLimitOrderActions.includes(
                (event as DexEvent).attributes.action
              )
            ) &&
            // filter to txs that include an event with the user receiving tokens
            getReceivedTokenAmount(events, { address })
          );
        });
        const events = txs.flatMap((tx) => {
          return (
            tx.tx_result.events
              .map(mapEventAttributes)
              // filter to only open LimitOrder events
              .filter((event): event is DexEvent => event.type === 'message')
              .filter((event): event is DexOpenLimitOrderEvent =>
                openLimitOrderActions.includes(event.attributes.action)
              )
          );
        });

        const tokenIn = placeLimitOrderEvent.attributes.TokenIn;
        const tokenOut = tokenIn === tokenZero ? tokenOne : tokenZero;
        // create an estimation of the userTranche state
        const initialUserTrancheState = {
          trade_pair_id: {
            maker_denom: tokenIn,
            taker_denom: tokenOut,
          },
          tick_index_taker_to_maker: Long.fromString(
            placeLimitOrderEvent.attributes.LimitTick
          ),
          tranche_key: placeLimitOrderEvent.attributes.TrancheKey,
          address: placeLimitOrderEvent.attributes.Receiver,
          shares_owned: placeLimitOrderEvent.attributes.Shares,
          shares_withdrawn: '0',
          shares_cancelled: '0',
          order_type: orderTypeEnum[placeLimitOrderEvent.attributes.OrderType],
        };
        // replay open limit order actions matching the user across the state
        const userTranche = events.reduce<LimitOrderTrancheUser>(
          (acc, event) => {
            // accumulate withdrawn shares
            if (event.attributes.action === 'WithdrawLimitOrder') {
              const takerAmountOut = new BigNumber(event.attributes.AmountOut);
              const makerAmountIn = takerAmountOut.multipliedBy(
                placeLimitOrderEvent.attributes.LimitTick
              );
              acc.shares_withdrawn = new BigNumber(acc.shares_withdrawn)
                .plus(makerAmountIn)
                .toFixed(0, BigNumber.ROUND_UP);
            }
            // accumulate cancelled shares
            else if (event.attributes.action === 'CancelLimitOrder') {
              acc.shares_cancelled = new BigNumber(acc.shares_cancelled)
                .plus(event.attributes.AmountOut)
                .toFixed(0);
            }
            return acc;
          },
          initialUserTrancheState
        );

        // because the accumulation math could be incorrect, adjust it here:
        const owned = new BigNumber(userTranche.shares_owned);
        if (owned.isLessThan(userTranche.shares_withdrawn)) {
          userTranche.shares_withdrawn = userTranche.shares_owned;
        } else if (owned.isLessThan(userTranche.shares_cancelled)) {
          userTranche.shares_cancelled = userTranche.shares_owned;
        }

        return {
          limit_order_tranche_user: userTranche,
        };
      }
    },
  });

  return useSwrResponseFromReactQuery(data, state);
}
