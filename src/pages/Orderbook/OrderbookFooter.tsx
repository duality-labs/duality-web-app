import BigNumber from 'bignumber.js';

import { orderTypeTextMap } from '../../components/cards/LimitOrderContext';
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
import { Token, getDisplayDenomAmount } from '../../lib/web3/utils/tokens';
import {
  formatAmount,
  formatCurrency,
  formatPercentage,
} from '../../lib/utils/number';

import { useSimplePrice } from '../../lib/tokenPrices';
import useTransactionTableData, {
  Tx,
} from '../Pool/hooks/useTransactionTableData';

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

  return (
    <Table<Tx, OrderbookFooterTableContext>
      headings={headings}
      columns={columns}
      data={data?.txs}
      context={{ tokenA, tokenB }}
    />
  );
}

interface OrderbookFooterTableContext {
  tokenA?: Token;
  tokenB?: Token;
}

const headings = [
  'Time',
  'Type',
  'Side',
  'Price',
  'Amount',
  'Filled',
  'Total',
  'Status',
];
const columns = [
  TimeColumn,
  TypeColumn,
  SideColumn,
  PriceColumn,
  AmountColumn,
  FilledColumn,
  TotalColumn,
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
  context: { tokenA, tokenB } = {},
}: {
  row: Tx;
  context?: OrderbookFooterTableContext;
}) {
  const attributes = getPlaceLimitOrderActionEvent(tx);
  if (attributes) {
    return (
      <td>
        {tokenA && tokenB ? (
          attributes.TokenIn === tokenA.address ? (
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
  context: { tokenA, tokenB } = {},
}: {
  row: Tx;
  context?: OrderbookFooterTableContext;
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
  context: { tokenA, tokenB } = {},
}: {
  row: Tx;
  context?: OrderbookFooterTableContext;
}) {
  const events = getMappedEvents(tx);
  const attributes = getPlaceLimitOrderActionEvent(tx);
  const tokenIn =
    tokenA &&
    tokenB &&
    attributes &&
    (attributes.TokenIn === tokenA.address ? tokenA : tokenB);
  const reservesIn =
    tokenIn && getDisplayDenomReserves(tokenIn, events, attributes);
  return (
    <td className="text-right">
      {formatAmount(reservesIn || 0)} {tokenIn?.symbol}
    </td>
  );
}

function FilledColumn({
  row: tx,
  context: { tokenA, tokenB } = {},
}: {
  row: Tx;
  context?: OrderbookFooterTableContext;
}) {
  const events = getMappedEvents(tx);
  const attributes = getPlaceLimitOrderActionEvent(tx);
  const [tokenIn] =
    tokenA && tokenB && attributes
      ? attributes.TokenIn === tokenA.address
        ? [tokenA, tokenB]
        : [tokenB, tokenA]
      : [];
  const reservesIn =
    tokenIn && attributes && getTokenReserves(tokenIn, events, attributes);
  // todo: fix, this doesn't calculated filled amount
  //       to calculate filled amount we would need to know the number of reserves
  //       used in TickUpdates (but this shows a new token total, not the diff)
  return (
    <td className="text-right">
      {formatPercentage(
        Number(reservesIn) / (Number(attributes?.AmountIn) || 1)
      )}
    </td>
  );
}

function TotalColumn({
  row: tx,
  context: { tokenA, tokenB } = {},
}: {
  row: Tx;
  context?: OrderbookFooterTableContext;
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
    (attributes.TokenIn === tokenA.address
      ? new BigNumber(
          getDisplayDenomReserves(tokenA, events, attributes) || 0
        ).multipliedBy(tokenAPrice || 0)
      : new BigNumber(
          getDisplayDenomReserves(tokenB, events, attributes) || 0
        ).multipliedBy(tokenBPrice || 0));
  return <td>{formatCurrency(value?.toNumber() || 0)}</td>;
}

function StatusColumn() {
  // todo: un-hardcode
  return <td>Filled</td>;
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
  return attributes.TokenIn === token.address
    ? getSpentTokenAmount(events, { address, matchToken: token })
    : getReceivedTokenAmount(events, { address, matchToken: token });
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
