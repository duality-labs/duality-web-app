import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import { LimitOrderTrancheUser } from '@duality-labs/neutronjs/types/codegen/neutron/dex/limit_order_tranche_user';

import { orderTypeTextMap } from '../../lib/web3/utils/limitOrders';
import Table from '../../components/Table/Table';
import { RelativeAndAbsoluteTime } from '../../components/Time';

import { useWeb3 } from '../../lib/web3/useWeb3';
import { WalletAddress } from '../../lib/web3/utils/address';
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
import { useTranche } from '../../lib/web3/hooks/useTranches';
import { getTokenPairID } from '../../lib/web3/utils/pairs';

import './OrderbookFooter.scss';

export default function OrderbookFooter({
  tokenA,
  tokenB,
}: {
  tokenA?: Token;
  tokenB?: Token;
}) {
  const { address: account } = useWeb3();
  return (
    <div className="page-card flex">
      <div className="row flex-centered mb-lg">
        <div className="col">
          <div className="row flex-centered gap-lg">
            <h4 className="h4">Orders</h4>
          </div>
        </div>
        <div className="col ml-auto"></div>
      </div>
      <div className="row orderbook-orders">
        {tokenA && tokenB && account && (
          <OrderbookFooterTable
            tokenA={tokenA}
            tokenB={tokenB}
            account={account}
          />
        )}
      </div>
    </div>
  );
}

const pageSize = 10;
function OrderbookFooterTable({
  tokenA,
  tokenB,
  account,
}: {
  tokenA: Token;
  tokenB: Token;
  account: WalletAddress;
}) {
  const { data } = useTransactionTableData({
    tokenA,
    tokenB,
    action: 'PlaceLimitOrder',
    account,
    pageSize,
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

  return (
    <Table<Tx, OrderbookFooterTableContext>
      headings={headings}
      columns={columns}
      data={data?.txs}
      context={{ tokenA, tokenB, userLimitOrderMap: userLimitOrderMapOfPair }}
    />
  );
}

interface OrderbookFooterTableContext {
  tokenA: Token;
  tokenB: Token;
  userLimitOrderMap: Map<string, LimitOrderTrancheUser> | undefined | null;
}

const headings = [
  'Time',
  'Type',
  'Side',
  'Price',
  'Amount',
  'Total',
  'Filled',
  'Withdrawn',
  'Status',
];
const columns = [
  TimeColumn,
  TypeColumn,
  SideColumn,
  PriceColumn,
  AmountColumn,
  TotalColumn,
  FilledColumn,
  WithdrawnColumn,
  StatusColumn,
];

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

function TypeColumn({ row: tx }: { row: Tx }) {
  const attributes = getPlaceLimitOrderActionEvent(tx);
  if (attributes) {
    return <td>{orderTypeTextMap[attributes.OrderType]}</td>;
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

// price is the end price of the trade
function PriceColumn({
  row: tx,
  context: { tokenA, tokenB },
}: {
  row: Tx;
  context: OrderbookFooterTableContext;
}) {
  const events = getMappedEvents(tx);
  const attributes = getPlaceLimitOrderActionEvent(tx);
  const reservesIn =
    tokenA && attributes && getTokenReserves(tokenA, events, attributes);
  const reservesOut =
    tokenB && attributes && getTokenReserves(tokenB, events, attributes);

  return (
    <td className="text-right">
      {Number(reservesOut) && Number(reservesIn)
        ? formatCurrency(Number(reservesOut) / Number(reservesIn))
        : '-'}
    </td>
  );
}

function AmountColumn({
  row: tx,
  context: { tokenA, tokenB },
}: {
  row: Tx;
  context: OrderbookFooterTableContext;
}) {
  const events = getMappedEvents(tx);
  const attributes = getPlaceLimitOrderActionEvent(tx);
  const tokenIn =
    tokenA &&
    tokenB &&
    attributes &&
    (attributes.TokenIn === getTokenId(tokenA) ? tokenA : tokenB);
  const reservesIn =
    tokenIn && getDisplayDenomReserves(tokenIn, events, attributes);
  return (
    <td className="text-right">
      {formatAmount(reservesIn || 0)} {tokenIn?.symbol}
    </td>
  );
}

function getUserShares(
  userTranche: Pick<
    LimitOrderTrancheUser,
    'shares_cancelled' | 'shares_owned' | 'shares_withdrawn'
  >
) {
  const shares = {
    owned: new BigNumber(userTranche.shares_owned),
    cancelled: new BigNumber(userTranche.shares_cancelled),
    withdrawn: new BigNumber(userTranche.shares_withdrawn),
  };
  // derive more properties
  const uncancelled = shares.owned.minus(shares.cancelled);
  const unwithdrawn = uncancelled.minus(shares.withdrawn);
  return {
    ...shares,
    uncancelled,
    unwithdrawn,
  };
}

function FilledColumn({
  row: tx,
  context: { userLimitOrderMap },
}: {
  row: Tx;
  context: OrderbookFooterTableContext;
}) {
  const events = getMappedEvents(tx);
  const placeLimitOrderEvent: DexPlaceLimitOrderEvent | undefined = events.find(
    (event) =>
      event.attributes['action'] === 'PlaceLimitOrder' &&
      Number(event.attributes['Shares']) > 0
  ) as DexPlaceLimitOrderEvent | undefined;
  const attributes = getPlaceLimitOrderActionEvent(tx);

  const userTranche = userLimitOrderMap?.get(attributes?.TrancheKey || '');
  const sharesFromLimitOrder = userTranche && getUserShares(userTranche);

  // conditionally fetch the details of this tranche
  const { data: tranche } = useTranche(
    sharesFromLimitOrder?.unwithdrawn.isGreaterThan(0)
      ? placeLimitOrderEvent
      : undefined
  );
  const makerReservesFromLimitOrder = tranche?.limit_order_tranche && {
    total: new BigNumber(tranche.limit_order_tranche.total_maker_denom),
    unfilled: new BigNumber(tranche.limit_order_tranche.reserves_maker_denom),
  };

  const makerReservesUnfilledFraction =
    makerReservesFromLimitOrder?.total &&
    makerReservesFromLimitOrder?.unfilled.div(
      makerReservesFromLimitOrder.total
    );
  return (
    <td className="text-right">
      {formatPercentage(1 - (makerReservesUnfilledFraction?.toNumber() ?? 0))}
    </td>
  );
}

function WithdrawnColumn({
  row: tx,
  context: { tokenA, tokenB, userLimitOrderMap },
}: {
  row: Tx;
  context: OrderbookFooterTableContext;
}) {
  const events = getMappedEvents(tx);
  const attributes = getPlaceLimitOrderActionEvent(tx);
  const [tokenIn, tokenOut] =
    tokenA && tokenB && attributes
      ? attributes.TokenIn === getTokenId(tokenA)
        ? [tokenA, tokenB]
        : [tokenB, tokenA]
      : [];

  const userTranche = userLimitOrderMap?.get(attributes?.TrancheKey || '');
  const sharesFromLimitOrder = userTranche && getUserShares(userTranche);

  if (tokenIn && tokenOut && attributes) {
    const makerReservesUserTotal = getTokenReserves(
      tokenIn,
      events,
      attributes
    );
    // only show if reserves entered were greater than zero
    // note: sometimes an IMMEDIATE_OR_CANCEL order may use 0 reserves
    if (makerReservesUserTotal.isGreaterThan(0)) {
      const makerSwapReserves = makerReservesUserTotal.minus(attributes.Shares);
      const sharesFromInitialSwap = getUserShares({
        shares_owned: makerSwapReserves.toFixed(0),
        shares_cancelled: '0',
        shares_withdrawn: makerSwapReserves.toFixed(0),
      });

      const withdrawn = sharesFromInitialSwap.withdrawn.plus(
        sharesFromLimitOrder?.withdrawn ?? 0
      );
      const withdrawnFraction = withdrawn.div(makerReservesUserTotal);
      return (
        <td className="text-right">
          {formatPercentage(withdrawnFraction.toNumber())}
        </td>
      );
    }
  }
  return <td>-</td>;
}

function TotalColumn({
  row: tx,
  context: { tokenA, tokenB },
}: {
  row: Tx;
  context: OrderbookFooterTableContext;
}) {
  const {
    data: [tokenAPrice, tokenBPrice],
  } = useSimplePrice([tokenA, tokenB]);
  const events = getMappedEvents(tx);
  const attributes = getPlaceLimitOrderActionEvent(tx);

  const value =
    tokenA &&
    tokenB &&
    attributes &&
    (attributes.TokenIn === getTokenId(tokenA)
      ? new BigNumber(
          getDisplayDenomReserves(tokenA, events, attributes) || 0
        ).multipliedBy(tokenAPrice || 0)
      : new BigNumber(
          getDisplayDenomReserves(tokenB, events, attributes) || 0
        ).multipliedBy(tokenBPrice || 0));
  return <td>{formatCurrency(value?.toNumber() || 0)}</td>;
}

function StatusColumn({
  row: tx,
  context: { userLimitOrderMap },
}: {
  row: Tx;
  context: OrderbookFooterTableContext;
}) {
  const attributes = getPlaceLimitOrderActionEvent(tx);
  const userTranche = userLimitOrderMap?.get(attributes?.TrancheKey || '');
  const shares = userTranche && getUserShares(userTranche);
  return <td>{shares?.unwithdrawn.isGreaterThan(0) ? 'Open' : 'Closed'}</td>;
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
