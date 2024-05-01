import BigNumber from 'bignumber.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { decodeTxRaw } from '@cosmjs/proto-signing';
import { neutron, neutronAminoConverters } from '@duality-labs/neutronjs';
import { LimitOrderTrancheUser } from '@duality-labs/neutronjs/types/codegen/neutron/dex/limit_order_tranche_user';
import { LimitOrderTranche } from '@duality-labs/neutronjs/types/codegen/neutron/dex/limit_order_tranche';
import { MsgPlaceLimitOrder } from '@duality-labs/neutronjs/types/codegen/neutron/dex/tx';

import { orderTypeTextMap } from '../../lib/web3/utils/limitOrders';
import TableCard from '../../components/cards/TableCard';
import Table from '../../components/Table/Table';
import { RelativeAndAbsoluteTime } from '../../components/Time';

import { useWeb3 } from '../../lib/web3/useWeb3';
import {
  ChainEvent,
  DexEvent,
  DexPlaceLimitOrderEvent,
  getReceivedTokenAmount,
  getSpentTokenAmount,
  mapEventAttributes,
} from '../../lib/web3/utils/events';
import {
  Token,
  getDisplayDenomAmount,
  getTokenId,
} from '../../lib/web3/utils/tokens';
import {
  formatAmount,
  formatCurrency,
  formatPercentage,
} from '../../lib/utils/number';

import { useSimplePrice } from '../../lib/tokenPrices';
import useTransactionTableData, {
  Tx,
} from '../Pool/hooks/useTransactionTableData';

import { useUserLimitOrderTranches } from '../../lib/web3/hooks/useUserLimitOrders';
import {
  useTranche,
  useUserInactiveTranche,
} from '../../lib/web3/hooks/useTranches';
import { useWithdrawFilledLimitOrder } from './useWithdrawFilledLimitOrder';
import { useCancelLimitOrder } from './useCancelLimitOrder';
import useOnUserDexMsg from '../../lib/web3/hooks/useOnUserDexMsg';

import { getTokenPairID } from '../../lib/web3/utils/pairs';
import { tickIndexToPrice } from '../../lib/web3/utils/ticks';

import './OrderbookFooter.scss';

const switchValues: Record<'recent' | 'open', StatusFilter | undefined> = {
  recent: 'Recent Orders',
  open: 'Open Orders',
};
export default function OrderbookFooter({
  tokenA,
  tokenB,
}: {
  tokenA?: Token;
  tokenB?: Token;
}) {
  const [filter, setFilter] = useState<keyof typeof switchValues>('recent');
  return (
    <TableCard<keyof typeof switchValues>
      title="Orders"
      className="pb-5 flex"
      scrolling={false}
      switchValues={switchValues}
      switchValue={filter}
      switchOnChange={setFilter}
    >
      <div className="row orderbook-orders">
        {tokenA && tokenB && (
          <OrderbookFooterTable
            tokenA={tokenA}
            tokenB={tokenB}
            filterToStatus={switchValues[filter]}
          />
        )}
      </div>
    </TableCard>
  );
}

type StatusFilter = 'Open Orders' | 'Recent Orders';
const pageSize = 30;
function OrderbookFooterTable({
  tokenA,
  tokenB,
  filterToStatus,
}: {
  tokenA: Token;
  tokenB: Token;
  filterToStatus?: StatusFilter;
}) {
  const { address } = useWeb3();
  const { data: txs, refetch } = useTransactionTableData({
    tokenA,
    tokenB,
    action: 'PlaceLimitOrder',
    account: address,
    pageSize,
  });

  // subscribe to updates to the user's limit orders
  useOnUserDexMsg<DexPlaceLimitOrderEvent>('PlaceLimitOrder', () => {
    refetch({ cancelRefetch: false });
  });

  const { data: userLimitOrders } = useUserLimitOrderTranches();
  const userLimitOrderMapOfPair = useMemo(() => {
    const tradePairId = tokenA && tokenB && getTokenPairID([tokenA, tokenB]);
    const denomA = getTokenId(tokenA);
    const denomB = getTokenId(tokenB);
    return tradePairId
      ? userLimitOrders
          ?.filter((limitOrderTranche) => {
            // accept tranche
            return (
              (limitOrderTranche.trade_pair_id.maker_denom === denomA &&
                limitOrderTranche.trade_pair_id.taker_denom === denomB) ||
              (limitOrderTranche.trade_pair_id.maker_denom === denomB &&
                limitOrderTranche.trade_pair_id.taker_denom === denomA)
            );
          })
          .reduce((acc, limitOrderTranche) => {
            acc.set(limitOrderTranche.tranche_key, limitOrderTranche);
            return acc;
          }, new Map<string, LimitOrderTrancheUser>())
      : null;
  }, [tokenA, tokenB, userLimitOrders]);

  const filteredTxs = useMemo(() => {
    return filterToStatus === 'Open Orders'
      ? // filter to open orders as they are available in the API
        // note: it is possible to do more, but showing this
        //       check this sub-commit to see previous filtering logic
        txs?.txs.filter((tx) => {
          const placeLimitOrderEvent = getPlaceLimitOrderEvent(tx);
          const trancheKey = placeLimitOrderEvent?.attributes.TrancheKey;
          return userLimitOrderMapOfPair?.has(trancheKey ?? '');
        })
      : txs?.txs;
  }, [filterToStatus, txs?.txs, userLimitOrderMapOfPair]);

  const [headings, columns] = useMemo(() => {
    const columnMap = new Map();
    columnMap.set('Time', TimeColumn);
    columnMap.set('Type', TypeColumn);
    columnMap.set('Side', SideColumn);
    columnMap.set('Price', PriceColumn);
    columnMap.set('Amount', AmountColumn);
    columnMap.set('Total', TotalColumn);
    if (filterToStatus === 'Open Orders') {
      columnMap.set('Filled', FilledColumn);
    }
    columnMap.set('Status', StatusColumn);
    columnMap.set('', ActionColumn);
    return [Array.from(columnMap.keys()), Array.from(columnMap.values())];
  }, [filterToStatus]);

  return (
    <Table<Tx, OrderbookFooterTableContext>
      className={
        filterToStatus
          ? `table-with-filter-${filterToStatus
              .toLowerCase()
              .replaceAll(/[^\w]/g, '-')}`
          : ''
      }
      headings={headings}
      columns={columns}
      data={filteredTxs}
      getRowKey={useCallback((tx: Tx) => tx.hash, [])}
      context={{
        tokenA,
        tokenB,
        userLimitOrderMap: userLimitOrderMapOfPair,
        filterToStatus,
      }}
    />
  );
}

interface OrderbookFooterTableContext {
  tokenA: Token;
  tokenB: Token;
  userLimitOrderMap: Map<string, LimitOrderTrancheUser> | undefined | null;
  filterToStatus?: StatusFilter;
}

function TimeColumn({ row: tx }: { row: Tx }) {
  return (
    <td>
      {tx.timestamp ? (
        <RelativeAndAbsoluteTime timestamp={tx.timestamp} />
      ) : (
        <>Block: {tx.height}</>
      )}
    </td>
  );
}

function getExpirationTime(tx: Tx) {
  const txMsg = getTxMsgPlaceLimitOrders(tx).at(0);
  return (
    txMsg?.expiration_time &&
    new Date(
      txMsg.expiration_time.seconds.multiply(1000).toNumber()
    ).toISOString()
  );
}

function TypeColumn({ row: tx }: { row: Tx }) {
  const attributes = getPlaceLimitOrderActionEvent(tx);
  if (attributes) {
    const timestamp = getExpirationTime(tx);
    return (
      <td className="">
        <div className="row" style={{ alignItems: 'center', flexFlow: 'wrap' }}>
          <div className="col nowrap mr-3">
            {orderTypeTextMap[attributes.OrderType]}
          </div>
          {timestamp && (
            <div className="col my-2">
              <div className="text-muted nowrap">
                <RelativeAndAbsoluteTime timestamp={timestamp} />
              </div>
            </div>
          )}
        </div>
      </td>
    );
  }
  return <td></td>;
}

function SideColumn({
  row: tx,
  context: { tokenA, tokenB },
}: {
  row: Tx;
  context: OrderbookFooterTableContext;
}) {
  const attributes = getPlaceLimitOrderActionEvent(tx);
  if (attributes) {
    return (
      <td>
        {tokenA && tokenB ? (
          attributes.TokenIn === getTokenId(tokenA) ? (
            <span className="text-success">Buy</span>
          ) : (
            <span className="text-danger">Sell</span>
          )
        ) : null}
      </td>
    );
  }
  return <td></td>;
}

// price is the average price of the trade
function PriceColumn({
  row: tx,
  context,
}: {
  row: Tx;
  context: OrderbookFooterTableContext;
}) {
  const isOrdered = isContextOrdered(tx, context);
  const orderState = useOrderState(tx, context);
  const swapReserves = orderState?.swap.reserves;
  const limitOrderReserves = getLimitOrderReserves(orderState)?.reserves;

  const reservesIn = swapReserves?.maker.plus(limitOrderReserves?.maker || 0);
  const reservesOut = swapReserves?.taker.plus(limitOrderReserves?.taker || 0);

  return (
    <td className="text-right">
      {reservesIn &&
      reservesIn?.isGreaterThan(0) &&
      reservesOut?.isGreaterThan(0) ? (
        // show actual traded price
        formatCurrency(
          !isOrdered
            ? reservesOut.dividedBy(reservesIn).toNumber()
            : reservesIn.dividedBy(reservesOut).toNumber()
        )
      ) : (
        // show order limit price
        <div className="text-muted">
          {isOrdered ? '<' : '>'}
          {formatCurrency(
            tickIndexToPrice(
              new BigNumber(isOrdered ? 1 : -1).multipliedBy(
                getPlaceLimitOrderEvent(tx)?.attributes.LimitTick ?? NaN
              )
            ).toNumber()
          )}
        </div>
      )}
    </td>
  );
}

// allow decoded of tx's MsgPlaceLimitOrder msgs
type MsgTypeURL = keyof typeof neutronAminoConverters;
const msgPlaceLimitOrderTypeURL: MsgTypeURL = '/neutron.dex.MsgPlaceLimitOrder';
function useTxMsgPlaceLimitOrders(tx: Tx): Array<MsgPlaceLimitOrder> {
  return useMemo(() => {
    return getTxMsgPlaceLimitOrders(tx);
  }, [tx]);
}
function useTxMsgPlaceLimitOrder(tx: Tx): MsgPlaceLimitOrder | undefined {
  return useTxMsgPlaceLimitOrders(tx).at(0);
}
function getTxMsgPlaceLimitOrders(tx: Tx): MsgPlaceLimitOrder[] {
  const decodedTx = decodeTxRaw(Buffer.from(tx.tx, 'base64'));
  return decodedTx.body.messages
    .filter((msg) => msg.typeUrl === msgPlaceLimitOrderTypeURL)
    .map((msg) => neutron.dex.MsgPlaceLimitOrder.decode(msg.value));
}

function getDisplayReservesMain(tx: Tx, context: OrderbookFooterTableContext) {
  const events = getMappedEvents(tx);
  const attributes = getPlaceLimitOrderActionEvent(tx);
  const isOrdered = isContextOrdered(tx, context);
  const [tokenIn] = getTokenInOut(tx, context);
  const reservesIn =
    tokenIn &&
    attributes &&
    getDisplayDenomReserves(tokenIn, events, attributes);

  // convert the place limit order input if needed
  return !isOrdered
    ? reservesIn
    : new BigNumber(reservesIn || 0)
        .dividedBy(tickIndexToPrice(new BigNumber(attributes?.LimitTick || 0)))
        .toNumber();
}

function AmountColumn({
  row: tx,
  context,
}: {
  row: Tx;
  context: OrderbookFooterTableContext;
}) {
  const tokenMain = context.tokenB;
  // convert the place limit order input if needed
  const reservesMain = getDisplayReservesMain(tx, context);
  return (
    <td className="text-right">
      {formatAmount(reservesMain || 0)} {tokenMain?.symbol}
    </td>
  );
}

interface ReservesState {
  maker: BigNumber;
  taker: BigNumber;
}
interface OrderState {
  swap: {
    reserves: ReservesState;
  };
  limitOrder: {
    trancheKey: string;
    userShares: {
      owned: BigNumber;
      withdrawn: BigNumber;
      cancelled: BigNumber;
    };
    tranche: {
      total: ReservesState;
      reserves: ReservesState;
    };
  };
}

function getTokenInOut(
  tx: Tx,
  { tokenA, tokenB }: OrderbookFooterTableContext
): [Token?, Token?] {
  const placeLimitOrderEvent = getPlaceLimitOrderEvent(tx);

  return tokenA && tokenB && placeLimitOrderEvent?.attributes
    ? placeLimitOrderEvent.attributes.TokenIn === getTokenId(tokenA)
      ? [tokenA, tokenB]
      : [tokenB, tokenA]
    : [];
}

function isContextOrdered(tx: Tx, context: OrderbookFooterTableContext) {
  const [tokenIn, tokenOut] = getTokenInOut(tx, context);
  return tokenIn === context.tokenA && tokenOut === context.tokenB;
}

function getPlaceLimitOrderEvent(
  tx: Tx,
  events: DexEvent[] = getMappedEvents(tx)
): DexPlaceLimitOrderEvent | undefined {
  return events.find(
    (event): event is DexPlaceLimitOrderEvent =>
      event.attributes['action'] === 'PlaceLimitOrder'
  );
}

function useOrderState(
  tx: Tx,
  { tokenA, tokenB, userLimitOrderMap }: OrderbookFooterTableContext
): OrderState | undefined {
  const events = getMappedEvents(tx);
  const placeLimitOrderEvent = getPlaceLimitOrderEvent(tx, events);

  // calculate the swap state
  const swap = useMemo<OrderState['swap'] | undefined>(() => {
    if (placeLimitOrderEvent) {
      const [_tokenIn, tokenOut] =
        tokenA && tokenB && placeLimitOrderEvent.attributes
          ? placeLimitOrderEvent.attributes.TokenIn === getTokenId(tokenA)
            ? [tokenA, tokenB]
            : [tokenB, tokenA]
          : [];
      const amountOut =
        (tokenOut &&
          getTokenReserves(
            tokenOut,
            events,
            placeLimitOrderEvent.attributes
          )) ??
        '0';

      // determine the swapped reserves
      return {
        reserves: {
          maker: new BigNumber(placeLimitOrderEvent.attributes.AmountIn).minus(
            placeLimitOrderEvent.attributes.Shares
          ),
          taker: new BigNumber(amountOut),
        },
      };
    }
  }, [events, placeLimitOrderEvent, tokenA, tokenB]);

  // calculate limit order states: only note tranche keys that have shares
  const trancheKey =
    Number(placeLimitOrderEvent?.attributes.Shares) > 0
      ? placeLimitOrderEvent?.attributes.TrancheKey
      : undefined;

  // workaround: there is a mismatch in the userLimitOrderTranches and whether
  //             a withdrawal/cancel action can be applied to either
  const expiredState = useExpiredState(tx);
  const userTrancheActive = useMemo(() => {
    // only accept shares above a certain tolerance
    const initialShares = new BigNumber(
      (tx && getPlaceLimitOrderEvent(tx)?.attributes.Shares) || 0
    );
    const userLimitOrder = userLimitOrderMap?.get(trancheKey ?? '');
    const belowTolerance =
      initialShares.isGreaterThan(0) &&
      new BigNumber(userLimitOrder?.shares_owned ?? 0)
        .dividedBy(initialShares)
        .isLessThan(0.01);
    // filter here
    // only accept non-expired userLimitOrderTranches
    if (!expiredState && !belowTolerance) {
      return userLimitOrder;
    }
  }, [tx, userLimitOrderMap, trancheKey, expiredState]);

  const userTrancheInactive = useUserInactiveTranche(
    trancheKey && !userTrancheActive ? placeLimitOrderEvent : undefined
  ).data?.limit_order_tranche_user;

  // get user shares: there are expected to be active or inactive shares
  // for a valid trancheKey but they may be still loading or have failed to load
  const userTranche = userTrancheActive || userTrancheInactive;
  const userShares = userTranche && getSharesState(userTranche);
  const hasOpenShares = userShares?.owned
    .minus(userShares.cancelled)
    .minus(userShares.withdrawn)
    ?.isGreaterThan(0);

  // fetch the details of the tranche only if the user has open (active) shares
  // the general tranche does not contain usable information after closed
  const dexTranche = useTranche(
    hasOpenShares ? placeLimitOrderEvent : undefined
  ).data?.limit_order_tranche;

  return useMemo<OrderState | undefined>(() => {
    if (swap) {
      // if a valid tranche exists we need to find the limit order information:
      // - the user's limit order shares (active or inactive)
      // - the general tranche state (to determine if filled or not)
      if (trancheKey) {
        if (userShares) {
          const tranche = getTrancheState(dexTranche);
          // create a fake dex tranche for closed tranches (to avoid lookup)
          if (trancheKey) {
            return {
              swap,
              limitOrder: {
                trancheKey,
                userShares,
                tranche: tranche || {
                  reserves: {
                    maker: new BigNumber(userShares.cancelled),
                    taker: new BigNumber(userShares.withdrawn),
                  },
                  total: {
                    maker: new BigNumber(userShares.owned),
                    taker: new BigNumber(userShares.owned),
                  },
                },
              },
            };
          }
        }
      } else {
        return {
          swap,
          // add empty limit order state for orders that generate no limit order
          limitOrder: {
            trancheKey: '',
            userShares: {
              owned: new BigNumber(0),
              withdrawn: new BigNumber(0),
              cancelled: new BigNumber(0),
            },
            tranche: {
              total: {
                maker: new BigNumber(0),
                taker: new BigNumber(0),
              },
              reserves: {
                maker: new BigNumber(0),
                taker: new BigNumber(0),
              },
            },
          },
        };
      }
    }
  }, [dexTranche, swap, trancheKey, userShares]);

  // user shares state: may be still loading or have failed to load
  function getSharesState(
    tranche: LimitOrderTrancheUser
  ): OrderState['limitOrder']['userShares'] {
    return {
      owned: new BigNumber(tranche.shares_owned),
      withdrawn: new BigNumber(tranche.shares_withdrawn),
      cancelled: new BigNumber(tranche.shares_cancelled),
    };
  }
  // general tranche state: may be still loading or have failed to load
  function getTrancheState(
    tranche: LimitOrderTranche | undefined
  ): OrderState['limitOrder']['tranche'] | undefined {
    return (
      tranche && {
        total: {
          maker: new BigNumber(tranche.total_maker_denom),
          taker: new BigNumber(tranche.total_taker_denom),
        },
        reserves: {
          maker: new BigNumber(tranche.reserves_maker_denom),
          taker: new BigNumber(tranche.reserves_taker_denom),
        },
      }
    );
  }
}

function getOpenShares(
  userShares: OrderState['limitOrder']['userShares']
): BigNumber {
  return userShares.owned
    .minus(userShares.withdrawn)
    .minus(userShares.cancelled);
}
function getOpenState(
  orderState: OrderState,
  openShares = getOpenShares(orderState?.limitOrder.userShares)
): boolean {
  // note: add workaround here, rounding may leave a small number of shares
  // todo: revert this sub-commit when bug is merged and released
  //       https://github.com/neutron-org/neutron/pull/479
  return openShares.isGreaterThan(3);
}
function getExpiredState(tx: Tx): boolean {
  const expiration = getExpirationTime(tx);
  return !!expiration && new Date(expiration).valueOf() < Date.now();
}
function useExpiredState(tx: Tx) {
  // tracke current expired state and update value when it expires
  const [expired, setExpired] = useState(() => getExpiredState(tx));
  useEffect(() => {
    const checkIfExpired = () => {
      setExpired((expired) => expired || getExpiredState(tx));
    };
    const expiration = getExpirationTime(tx);
    const msLeftToExpiration = new Date(expiration || 0).valueOf() - Date.now();
    if (msLeftToExpiration > 0) {
      const timeout = setTimeout(checkIfExpired, msLeftToExpiration + 1);
      return () => clearTimeout(timeout);
    }
  }, [tx]);
  return expired;
}
function getLimitOrderFilledFraction(order: OrderState): BigNumber | undefined {
  const hasOpenShares = getOpenState(order);
  if (hasOpenShares) {
    const { limitOrder } = order;
    const shareTotal = limitOrder.tranche.total.maker;
    const sharesFilled = shareTotal.minus(limitOrder.tranche.reserves.maker);
    return shareTotal.isGreaterThan(0)
      ? sharesFilled?.div(shareTotal)
      : undefined;
  }
}

function getLimitOrderReserves(
  order: OrderState | undefined
): OrderState['swap'] | undefined {
  if (order) {
    const filledFraction = getLimitOrderFilledFraction(order);
    const limitOrder = order.limitOrder;
    // calculate the equivalent reserves based off general tranche data
    const maxReservesIn = limitOrder.userShares.owned;
    const maxReservesOut = limitOrder.tranche.total.maker.isGreaterThan(0)
      ? limitOrder.userShares.owned
          .dividedBy(limitOrder.tranche.total.maker)
          .multipliedBy(limitOrder.tranche.total.taker)
      : new BigNumber(0);

    return getOpenState(order)
      ? filledFraction
        ? // if state is open then report reserves that would be available on withdraw
          {
            reserves: {
              maker: filledFraction.multipliedBy(maxReservesIn),
              taker: filledFraction.multipliedBy(maxReservesOut),
            },
          }
        : undefined
      : // if the state was closed then how many reserves were actually in/out
        {
          reserves: {
            maker: limitOrder.userShares.owned.minus(
              limitOrder.userShares.cancelled
            ),
            taker: limitOrder.tranche.total.maker.isGreaterThan(0)
              ? limitOrder.userShares.withdrawn
                  .dividedBy(limitOrder.tranche.total.maker)
                  .multipliedBy(limitOrder.tranche.total.taker)
              : new BigNumber(0),
          },
        };
  }
}

function FilledColumn({
  row: tx,
  context,
}: {
  row: Tx;
  context: OrderbookFooterTableContext;
}) {
  const orderState = useOrderState(tx, context);
  const isImmediate = orderState?.limitOrder.userShares.owned.isZero();
  const hasOpenShares = orderState && getOpenState(orderState);

  const msgPlaceLimitOrder = useTxMsgPlaceLimitOrder(tx);
  const isUsingMaxOut = isImmediate && !!msgPlaceLimitOrder?.max_amount_out;
  const msgReservesIn = new BigNumber(msgPlaceLimitOrder?.amount_in ?? 0);
  const msgReservesOut = new BigNumber(msgPlaceLimitOrder?.max_amount_out ?? 0);
  const userShares = orderState?.limitOrder.userShares;

  const reservesFilledFraction = isImmediate
    ? // calculate immediately swapped percentage ("Filled%" = "Swapped%")
      isUsingMaxOut
      ? // use percentage of maxOut limit asked for
        orderState?.swap.reserves.taker.dividedBy(msgReservesOut)
      : // use percentage of reserves in asked for
        orderState?.swap.reserves.maker.dividedBy(msgReservesIn)
    : // calculate limit order "fill" percentage
    !hasOpenShares
    ? // calculate limit order withdrawn percentage ("Filled%" = "Withdrawn%")
      userShares?.withdrawn.dividedBy(userShares.owned)
    : // calculate limit order fill percentage
      orderState && getLimitOrderFilledFraction(orderState);
  return (
    <td className="text-right">
      {formatPercentage(reservesFilledFraction?.toNumber() ?? 0)}
    </td>
  );
}

function TotalColumn({
  row: tx,
  context,
}: {
  row: Tx;
  context: OrderbookFooterTableContext;
}) {
  const reservesMain = getDisplayReservesMain(tx, context);
  const tokenMain = context.tokenB;
  const {
    data: [priceMain],
  } = useSimplePrice([tokenMain]);

  const value = new BigNumber(reservesMain ?? 0).multipliedBy(priceMain || 0);
  return <td>{formatCurrency(value?.toNumber() || 0)}</td>;
}

function StatusColumn({
  row: tx,
  context,
}: {
  row: Tx;
  context: OrderbookFooterTableContext;
}) {
  // if shares are withdrawable then the status is Open
  const orderState = useOrderState(tx, context);
  const statusOpen = orderState && getOpenState(orderState);
  const statusExpired = useExpiredState(tx);
  return (
    <td>
      <div className="row">
        <div className="col badge badge-lg badge-muted my-2 ml-auto">
          {statusOpen ? (statusExpired ? 'Expired' : 'Open') : 'Closed'}
        </div>
      </div>
    </td>
  );
}

function ActionColumn({
  row: tx,
  context,
}: {
  row: Tx;
  context: OrderbookFooterTableContext;
}) {
  // if shares are withdrawable then the status is Open
  const orderState = useOrderState(tx, context);
  const trancheKey = orderState?.limitOrder.trancheKey;
  // get shares state
  const swapReserves = orderState?.swap.reserves;
  const shares = orderState?.limitOrder.userShares;
  const totalMakerAmount = shares?.owned.plus(swapReserves?.maker ?? 0) ?? 1;
  const swappedFraction = swapReserves?.maker.div(totalMakerAmount);
  const withdrawnFraction = shares?.withdrawn?.div(totalMakerAmount);
  const cancelledFraction = shares?.cancelled?.div(totalMakerAmount);
  // get filled state
  const limitOrderFilledFraction =
    orderState && getLimitOrderFilledFraction(orderState);

  const statusOpen = orderState && getOpenState(orderState);
  const statusExpired = useExpiredState(tx);
  // get withdrawing/cancelling tranche state
  const { address } = useWeb3();
  const [withdrawingState, withdrawTranche] = useWithdrawFilledLimitOrder();
  const [cancellingState, cancelTranche] = useCancelLimitOrder();
  const loading = withdrawingState.isValidating || cancellingState.isValidating;

  return (
    <td className="actions gapx-3 gapy-sm">
      <div className="row flow-wrap gapx-3 gapy-sm">
        {swappedFraction && swappedFraction.isGreaterThan(0) && (
          <div className="col badge badge-lg badge-muted">
            Swapped
            {
              // show detail only if less that ~100% swapped state
              swappedFraction.isLessThan(0.995)
                ? ` (${formatPercentage(swappedFraction.toNumber())})`
                : ''
            }
          </div>
        )}
        {withdrawnFraction && withdrawnFraction.isGreaterThan(0) && (
          <div className="col badge badge-lg badge-muted">
            Withdrawn
            {
              // show detail only if less that ~100% withdrawn state
              withdrawnFraction.isLessThan(0.995)
                ? ` (${formatPercentage(withdrawnFraction.toNumber())})`
                : ''
            }
          </div>
        )}
        {cancelledFraction && cancelledFraction.isGreaterThan(0) && (
          <div className="col badge badge-lg badge-muted">
            Cancelled
            {
              // show detail only if less that ~100% cancelled state
              cancelledFraction.isLessThan(0.995)
                ? ` (${formatPercentage(cancelledFraction.toNumber())})`
                : ''
            }
          </div>
        )}
      </div>
      <div className="row flow-wrap gapx-3 gapy-sm">
        {statusOpen && context.filterToStatus !== 'Open Orders' && (
          <div className="col my-xs ml-1 mr-3 pt-1">
            Filled:{' '}
            {formatPercentage(limitOrderFilledFraction?.toNumber() ?? 0)}
          </div>
        )}
        {(limitOrderFilledFraction?.isGreaterThan(0) ||
          (statusExpired && limitOrderFilledFraction?.isZero())) && (
          <div className="col">
            <button
              className="button-primary-outline mx-0"
              disabled={loading}
              onClick={() => {
                !loading &&
                  address &&
                  trancheKey &&
                  withdrawTranche([
                    {
                      creator: address,
                      tranche_key: trancheKey,
                    },
                  ]);
              }}
            >
              {withdrawingState.isValidating ? 'Withdrawing...' : 'Withdraw'}
            </button>
          </div>
        )}
        {!statusExpired && limitOrderFilledFraction?.isLessThan(1) && (
          <div className="col">
            <button
              className="button-primary-outline mx-0"
              disabled={loading}
              onClick={() => {
                !loading &&
                  address &&
                  trancheKey &&
                  cancelTranche([
                    {
                      creator: address,
                      tranche_key: trancheKey,
                    },
                  ]);
              }}
            >
              {cancellingState.isValidating ? 'Cancelling...' : 'Cancel'}
            </button>
          </div>
        )}
      </div>
    </td>
  );
}

// helper functions
function getDisplayDenomReserves(
  token: Token,
  events: ChainEvent[],
  attributes: DexPlaceLimitOrderEvent['attributes']
) {
  const reserves = getTokenReserves(token, events, attributes);
  return getDisplayDenomAmount(token, reserves, {
    fractionalDigits: 3,
    significantDigits: 3,
  });
}

function getTokenReserves(
  token: Token,
  events: ChainEvent[],
  attributes: DexPlaceLimitOrderEvent['attributes']
) {
  const address = attributes.Creator;
  const tokenId = getTokenId(token);
  return attributes.TokenIn === tokenId
    ? getSpentTokenAmount(events, { address, matchTokenId: tokenId })
    : getReceivedTokenAmount(events, { address, matchTokenId: tokenId });
}

function getPlaceLimitOrderActionEvent(tx: Tx) {
  const event = tx.tx_result.events.find(findPlaceLimitOrderActionEvent);
  return event
    ? mapEventAttributes<DexPlaceLimitOrderEvent>(event).attributes
    : undefined;
}

function getMappedEvents(tx: Tx) {
  return tx.tx_result.events.map((event) =>
    mapEventAttributes<DexEvent>(event)
  );
}

function findPlaceLimitOrderActionEvent({
  attributes,
}: Tx['tx_result']['events'][number]) {
  return (
    attributes
      // .filter((event): event is DexPlaceLimitOrderEvent => event.key === 'action' && event.value === 'PlaceLimitOrder' )
      .find(({ key, value }) => key === 'action' && value === 'PlaceLimitOrder')
  );
}
