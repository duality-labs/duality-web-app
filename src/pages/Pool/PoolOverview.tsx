import BigNumber from 'bignumber.js';
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TxResponseSDKType } from '@duality-labs/dualityjs/types/codegen/cosmos/base/abci/v1beta1/abci';
import type { GetTxsEventResponseSDKType } from '@duality-labs/dualityjs/types/codegen/cosmos/tx/v1beta1/service';

import PoolLayout from './PoolLayout';
import PriceCard, { PriceCardRow } from '../../components/cards/PriceCard';
import Table from '../../components/Table';
import TableCard from '../../components/cards/TableCard';
import Tabs from '../../components/Tabs/Tabs';
import PoolChart from './PoolChart';
import SmallCard, { SmallCardRow } from '../../components/cards/SmallCard';

import { useLcdClientPromise } from '../../lib/web3/lcdClient';
import { formatAddress } from '../../lib/web3/utils/address';
import { Token, getAmountInDenom } from '../../lib/web3/utils/tokens';
import {
  getPairID,
  guessInvertedOrder,
  hasInvertedOrder,
} from '../../lib/web3/utils/pairs';
import {
  ChainEvent,
  DexDepositEvent,
  DexEvent,
  CoinReceivedEvent,
  DexMessageAction,
  DexPlaceLimitOrderEvent,
  DexWithdrawalEvent,
  decodeEvent,
  mapEventAttributes,
  CoinSpentEvent,
  parseAmountDenomString,
} from '../../lib/web3/utils/events';

import { useSimplePrice } from '../../lib/tokenPrices';
import { formatCurrency } from '../../lib/utils/number';
import { formatRelativeTime } from '../../lib/utils/time';

import './Pool.scss';
import { addressableTokenMap } from '../../lib/web3/hooks/useTokens';

export default function PoolOverview({
  tokenA,
  tokenB,
  setTokens,
}: {
  tokenA: Token;
  tokenB: Token;
  setTokens: ([tokenA, tokenB]: [Token?, Token?]) => void;
}) {
  const swap = useCallback(() => {
    setTokens([tokenB, tokenA]);
  }, [tokenA, tokenB, setTokens]);

  return (
    <PoolLayout tokenA={tokenA} tokenB={tokenB} swap={swap}>
      <div className="row mt-3 mb-xl">
        <div className="col">
          <PriceCardRow>
            <PriceCard tokenA={tokenA} tokenB={tokenB} />
            <PriceCard tokenA={tokenB} tokenB={tokenA} />
          </PriceCardRow>
        </div>
        <div className="col ml-auto">
          <div className="row gap-lg">
            <div className="col">
              <Link to={`/pools/${tokenA.symbol}/${tokenB.symbol}/manage`}>
                <button className="button button-primary py-3 px-4">
                  New Position
                </button>
              </Link>
            </div>
            <div className="col">
              <Link to={`/swap/${tokenA.symbol}/${tokenB.symbol}`}>
                <button className="button button-primary-outline py-3 px-4">
                  Trade
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
      <div className="row gap-4 my-3">
        <div className="col flex gap-4">
          <div className={'overview-card col'}>
            <div className="row gap-4 mb-5">
              <SmallCardRow>
                <SmallCard header="TVL" footer="+3.42%" footerVariant="success">
                  $970.25K
                </SmallCard>
                <SmallCard
                  header="Volume (24H)"
                  footer="-3.42%"
                  footerVariant="danger"
                >
                  $665.37K
                </SmallCard>
                <SmallCard
                  header="Fees"
                  footer="+35.25%"
                  footerVariant="success"
                >
                  $78.98K
                </SmallCard>
                <SmallCard
                  header="Volatility"
                  footer="+3.42%"
                  footerVariant="success"
                >
                  6.0%
                </SmallCard>
              </SmallCardRow>
            </div>
            <PoolChart tokenA={tokenA} tokenB={tokenB} />
          </div>
          <div className="col pt-lg col-lg-hide">
            <PairComposition tokenA={tokenA} tokenB={tokenB} />
          </div>
          <div>
            <PoolOverviewTable tokenA={tokenA} tokenB={tokenB} />
          </div>
          <div className="col pt-lg col-lg-hide">
            <Incentives />
          </div>
        </div>
        <div className="col col-lg col--left gap-4" style={{ width: 300 }}>
          <PairComposition tokenA={tokenA} tokenB={tokenB} />
          <Incentives />
        </div>
      </div>
    </PoolLayout>
  );
}

function PairComposition({ tokenA, tokenB }: { tokenA: Token; tokenB: Token }) {
  const { columns, headings, data } = useMemo(() => {
    return {
      headings: ['Token', 'Amount', 'Value'],
      columns: [
        function TokenCell1({ row }: { row: Token }) {
          return (
            <td
              className=" flex row gap-3"
              style={{ alignItems: 'center', justifyContent: 'flex-start' }}
            >
              <div className="price-card__token-logo col my-2">
                <img
                  className="token-logo token-current"
                  alt={`${row.symbol} logo`}
                  src={row.logo_URIs?.svg ?? row.logo_URIs?.png}
                />
              </div>

              {row.symbol}
            </td>
          );
        },
        function TokenCell2({ row }: { row: Token }) {
          return <td>todo</td>;
        },
        function TokenCell3({ row }: { row: Token }) {
          return <td>todo</td>;
        },
      ],
      data: [tokenA, tokenB],
    };
  }, [tokenA, tokenB]);

  return (
    <TableCard title="Pair Composition" className="pb-5" scrolling={false}>
      <Table<Token> data={data} columns={columns} headings={headings} />
    </TableCard>
  );
}

function Incentives() {
  const tokenA = addressableTokenMap['tokenA'];
  const tokenB = addressableTokenMap['tokenF'];

  const { columns, headings, data } = useMemo(() => {
    return {
      headings: ['Token', 'Range', 'Reward'],
      columns: [
        function TokenCell1({ row }: { row: Token }) {
          return (
            <td
              className=" flex row gap-3"
              style={{ alignItems: 'center', justifyContent: 'flex-start' }}
            >
              <div className="price-card__token-logo col my-2">
                <img
                  className="token-logo token-current"
                  alt={`${row.symbol} logo`}
                  src={row.logo_URIs?.svg ?? row.logo_URIs?.png}
                />
              </div>
              {row.symbol}
            </td>
          );
        },
        function TokenCell2({ row }: { row: Token }) {
          return <td>todo</td>;
        },
        function TokenCell3({ row }: { row: Token }) {
          return <td>todo</td>;
        },
      ],
      data: [tokenA, tokenB],
    };
  }, [tokenA, tokenB]);

  return (
    <TableCard title="Incentives" className="pb-5" scrolling={false}>
      <Table<Token> data={data} columns={columns} headings={headings} />
    </TableCard>
  );
}

function PoolOverviewTable({
  tokenA,
  tokenB,
}: {
  tokenA: Token;
  tokenB: Token;
}) {
  const tabs = useMemo(() => {
    return [
      {
        nav: 'All',
        Tab: () => <TokenTransactionTable />,
      },
      {
        nav: 'Swaps',
        Tab: () => <TokenTransactionTable action="PlaceLimitOrder" />,
      },
      {
        nav: 'Adds',
        Tab: () => <TokenTransactionTable action="Deposit" />,
      },
      {
        nav: 'Removes',
        Tab: () => <TokenTransactionTable action="Withdraw" />,
      },
    ];
    // intermediary component to avoid repeating tokenA={tokenA} tokenB={tokenB}
    function TokenTransactionTable({ action }: { action?: DexMessageAction }) {
      return (
        <TransactionsTable tokenA={tokenA} tokenB={tokenB} action={action} />
      );
    }
  }, [tokenA, tokenB]);

  return (
    <TableCard title="Transactions" scrolling={false}>
      <Tabs tabs={tabs} />
    </TableCard>
  );
}

const transactionTableHeadings = [
  'Type',
  'Total Value',
  'Token A Amount',
  'Token B Amount',
  'Wallet',
  'Time',
] as const;
type TransactionTableColumnKey = typeof transactionTableHeadings[number];

function TransactionTableHeading({
  heading,
  tokenA,
  tokenB,
}: {
  tokenA: Token;
  tokenB: Token;
  heading: TransactionTableColumnKey;
}) {
  switch (heading) {
    case 'Token A Amount':
      return <th>{tokenA.symbol}&nbsp;Amount</th>;
    case 'Token B Amount':
      return <th>{tokenB.symbol}&nbsp;Amount</th>;
  }
  return <th>{heading}</th>;
}

const pageSize = 10;
function TransactionsTable({
  tokenA,
  tokenB,
  action,
}: {
  tokenA: Token;
  tokenB: Token;
  action?: DexMessageAction;
}) {
  const lcdClientPromise = useLcdClientPromise();
  const [pageOffset] = useState<number>(0);
  const query = useQuery({
    queryKey: ['events', action, tokenA.address, tokenB.address, pageOffset],
    queryFn: async (): Promise<GetTxsEventResponseSDKType> => {
      const lcd = await lcdClientPromise;
      /*
       * note: you would expect the follow to work, but it mangles the query
       * parameters into a form that isn't accepted by the API:
       *
       *   lcd.cosmos.tx.v1beta1.getTxsEvent({
       *     events: [filter],
       *     orderBy: 2 as OrderBy.ORDER_BY_DESC,
       *     pagination: { limit: Long.fromNumber(10) , countTotal: true},
       *   })
       *
       * instead we will create the query string ourself and add the return type
       */

      // create Query string (with all appropriate characters escaped)
      const queryParams = new URLSearchParams({
        events: `message.module='${'dex'}'`,
        order_by: 'ORDER_BY_DESC',
        'pagination.limit': `${pageSize || 10}`,
        // add page offset if it is non-zero
        ...(pageOffset && {
          'pagination.offset': (pageOffset * pageSize).toFixed(),
        }),
      });

      const invertedOrder = guessInvertedOrder(tokenA.address, tokenB.address);

      // append multiple event keys
      // search specific token types
      if (!invertedOrder) {
        queryParams.append('events', `message.Token0='${tokenA.address}'`);
        queryParams.append('events', `message.Token1='${tokenB.address}'`);
      } else {
        queryParams.append('events', `message.Token0='${tokenB.address}'`);
        queryParams.append('events', `message.Token1='${tokenA.address}'`);
      }
      // search specific action types
      if (action) {
        queryParams.append('events', `message.action='${action}'`);
      }

      return await lcd.cosmos.tx.v1beta1.req.get(
        `cosmos/tx/v1beta1/txs?${queryParams}`
      );
    },
  });

  const columns = useMemo(() => {
    return transactionTableHeadings.map(
      (heading: TransactionTableColumnKey) => {
        return function TransactionTableColumn({
          row: tx,
        }: {
          row: TxResponseSDKType;
        }) {
          const events = tx.events
            .map(decodeEvent)
            .map((event) => mapEventAttributes<DexEvent>(event));

          // try swap event
          const swapEvent = events.find(
            (event): event is DexPlaceLimitOrderEvent =>
              event.attributes.action === 'PlaceLimitOrder'
          );
          if (swapEvent) {
            return (
              <SwapColumn
                tx={tx}
                event={swapEvent}
                events={events as ChainEvent[]}
                heading={heading}
                tokenA={tokenA}
                tokenB={tokenB}
              />
            );
          }

          // try deposit event
          const depositEvents = events.filter(
            (event): event is DexDepositEvent =>
              event.attributes.action === 'Deposit'
          );
          if (depositEvents.length > 0) {
            return (
              <DepositColumn
                tx={tx}
                events={depositEvents}
                heading={heading}
                tokenA={tokenA}
                tokenB={tokenB}
              />
            );
          }

          // try withdrawal event
          const withdrawalEvent = events.find(
            (event): event is DexWithdrawalEvent =>
              event.attributes.action === 'Withdraw'
          );
          if (withdrawalEvent) {
            return (
              <WithdrawalColumn
                tx={tx}
                event={withdrawalEvent}
                heading={heading}
                tokenA={tokenA}
                tokenB={tokenB}
              />
            );
          }
          return null;
        };
      }
    );
  }, [tokenA, tokenB]);

  return (
    <div>
      <Table<TxResponseSDKType>
        data={query.data?.tx_responses}
        headings={transactionTableHeadings.map((heading) => (
          <TransactionTableHeading
            key={heading}
            tokenA={tokenA}
            tokenB={tokenB}
            heading={heading}
          />
        ))}
        columns={columns}
      />
    </div>
  );
}

function DepositColumn({
  tx,
  events,
  heading,
  tokenA,
  tokenB,
}: {
  tokenA: Token;
  tokenB: Token;
  tx: TxResponseSDKType;
  events: DexDepositEvent[];
  heading: TransactionTableColumnKey;
}) {
  const {
    data: [tokenAPrice, tokenBPrice],
    isValidating,
  } = useSimplePrice([tokenA, tokenB]);
  // get common attributes from first event
  const [
    {
      attributes: { Creator, Token0, Token1 },
    },
  ] = events;

  const content = (() => {
    switch (heading) {
      case 'Wallet':
        return formatAddress(Creator);
      case 'Type':
        return `Add ${[
          Number(getTokenAReserves()) > 0 && tokenA.symbol,
          Number(getTokenBReserves()) > 0 && tokenB.symbol,
        ]
          .filter(Boolean)
          .join(' and ')}`;
      case 'Token A Amount':
        return getTokenReservesInDenom(tokenA, getTokenAReserves().toFixed());
      case 'Token B Amount':
        return getTokenReservesInDenom(tokenB, getTokenBReserves().toFixed());
      case 'Total Value':
        const values = [
          new BigNumber(
            getAmountInDenom(
              tokenA,
              getTokenAReserves(),
              tokenA.base,
              tokenA.display
            ) || 0
          ).multipliedBy(tokenAPrice || 0),
          new BigNumber(
            getAmountInDenom(
              tokenB,
              getTokenBReserves(),
              tokenB.base,
              tokenB.display
            ) || 0
          ).multipliedBy(tokenBPrice || 0),
        ];
        const value = values[0].plus(values[1]);
        // return loading start or calculated value
        return !tokenA && !tokenB && isValidating
          ? '...'
          : value.isLessThan(0.005)
          ? `< ${formatCurrency(0.01)}`
          : formatCurrency(values[0].plus(values[1]).toNumber());
      case 'Time':
        return formatRelativeTime(tx.timestamp);
    }
    return null;

    function getHasInvertedOrder(): boolean {
      return hasInvertedOrder(
        getPairID(Token0, Token1),
        tokenA.address,
        tokenB.address
      );
    }

    function getTokenAReserves() {
      return getHasInvertedOrder()
        ? events
            .map(({ attributes }) => attributes.Reserves1Deposited)
            .reduce(sumBigNumber, new BigNumber(0))
        : events
            .map(({ attributes }) => attributes.Reserves0Deposited)
            .reduce(sumBigNumber, new BigNumber(0));
    }

    function getTokenBReserves() {
      return getHasInvertedOrder()
        ? events
            .map(({ attributes }) => attributes.Reserves0Deposited)
            .reduce(sumBigNumber, new BigNumber(0))
        : events
            .map(({ attributes }) => attributes.Reserves1Deposited)
            .reduce(sumBigNumber, new BigNumber(0));
    }

    function sumBigNumber(acc: BigNumber, value: string) {
      return acc.plus(value);
    }

    function getTokenReservesInDenom(token: Token, reserves: string) {
      return getAmountInDenom(token, reserves, token.base, token.display, {
        fractionalDigits: 3,
        significantDigits: 3,
      });
    }
  })();

  return (
    <td
      className={
        heading === 'Wallet' || heading === 'Type' ? 'cell-highlighted' : ''
      }
    >
      {content}
    </td>
  );
}

function WithdrawalColumn({
  tx,
  event: { attributes },
  heading,
  tokenA,
  tokenB,
}: {
  tokenA: Token;
  tokenB: Token;
  tx: TxResponseSDKType;
  event: DexWithdrawalEvent;
  heading: TransactionTableColumnKey;
}) {
  const {
    data: [tokenAPrice, tokenBPrice],
    isValidating,
  } = useSimplePrice([tokenA, tokenB]);

  const content = (() => {
    switch (heading) {
      case 'Wallet':
        return formatAddress(attributes.Creator);
      case 'Type':
        return `Remove ${[
          Number(getTokenAReserves()) > 0 && tokenA.symbol,
          Number(getTokenBReserves()) > 0 && tokenB.symbol,
        ]
          .filter(Boolean)
          .join(' and ')}`;
      case 'Token A Amount':
        return getTokenReservesInDenom(tokenA, getTokenAReserves());
      case 'Token B Amount':
        return getTokenReservesInDenom(tokenB, getTokenBReserves());
      case 'Total Value':
        const values = [
          new BigNumber(
            getAmountInDenom(
              tokenA,
              getTokenAReserves(),
              tokenA.base,
              tokenA.display
            ) || 0
          ).multipliedBy(tokenAPrice || 0),
          new BigNumber(
            getAmountInDenom(
              tokenB,
              getTokenBReserves(),
              tokenB.base,
              tokenB.display
            ) || 0
          ).multipliedBy(tokenBPrice || 0),
        ];
        const value = values[0].plus(values[1]);
        // return loading start or calculated value
        return !tokenA && !tokenB && isValidating
          ? '...'
          : value.isLessThan(0.005)
          ? `< ${formatCurrency(0.01)}`
          : formatCurrency(values[0].plus(values[1]).toNumber());
      case 'Time':
        return formatRelativeTime(tx.timestamp);
    }
    return null;

    function getHasInvertedOrder(): boolean {
      return hasInvertedOrder(
        getPairID(attributes.Token0, attributes.Token1),
        tokenA.address,
        tokenB.address
      );
    }

    function getTokenAReserves() {
      return getHasInvertedOrder()
        ? attributes.Reserves1Withdrawn
        : attributes.Reserves0Withdrawn;
    }

    function getTokenBReserves() {
      return getHasInvertedOrder()
        ? attributes.Reserves0Withdrawn
        : attributes.Reserves1Withdrawn;
    }

    function getTokenReservesInDenom(token: Token, reserves: string) {
      return getAmountInDenom(token, reserves, token.base, token.display, {
        fractionalDigits: 3,
        significantDigits: 3,
      });
    }
  })();

  return (
    <td
      className={
        heading === 'Wallet' || heading === 'Type' ? 'cell-highlighted' : ''
      }
    >
      {content}
    </td>
  );
}

function SwapColumn({
  tx,
  event: { attributes },
  events,
  heading,
  tokenA,
  tokenB,
}: {
  tokenA: Token;
  tokenB: Token;
  tx: TxResponseSDKType;
  event: DexPlaceLimitOrderEvent;
  events: ChainEvent[];
  heading: TransactionTableColumnKey;
}) {
  const {
    data: [tokenAPrice, tokenBPrice],
    isValidating,
  } = useSimplePrice([tokenA, tokenB]);

  const content = (() => {
    switch (heading) {
      case 'Wallet':
        return formatAddress(attributes.Creator);
      case 'Type':
        return `Swap ${[
          Number(getTokenAReserves()) > 0 && tokenA.symbol,
          Number(getTokenBReserves()) > 0 && tokenB.symbol,
        ]
          .filter(Boolean)
          .join(' and ')}`;
      case 'Token A Amount':
        return getTokenReservesInDenom(tokenA, getTokenAReserves());
      case 'Token B Amount':
        return getTokenReservesInDenom(tokenB, getTokenBReserves());
      case 'Total Value':
        const values = [
          new BigNumber(
            getAmountInDenom(
              tokenA,
              getTokenAReserves(),
              tokenA.base,
              tokenA.display
            ) || 0
          ).multipliedBy(tokenAPrice || 0),
          new BigNumber(
            getAmountInDenom(
              tokenB,
              getTokenBReserves(),
              tokenB.base,
              tokenB.display
            ) || 0
          ).multipliedBy(tokenBPrice || 0),
        ];
        const value = values[0].plus(values[1]);
        // return loading start or calculated value
        return !tokenA && !tokenB && isValidating
          ? '...'
          : value.isLessThan(0.005)
          ? `< ${formatCurrency(0.01)}`
          : formatCurrency(values[0].plus(values[1]).toNumber());
      case 'Time':
        return formatRelativeTime(tx.timestamp);
    }
    return null;

    function getTokenAReserves() {
      const tokenEvent =
        attributes.TokenIn === tokenA.address
          ? // find tokens spent
            events.find(
              (event): event is CoinSpentEvent =>
                event.type === 'coin_spent' &&
                event.attributes.spender === attributes.Receiver
            )
          : // find tokens received
            events.find(
              (event): event is CoinReceivedEvent =>
                event.type === 'coin_received' &&
                event.attributes.receiver === attributes.Receiver
            );
      const [amount] = tokenEvent
        ? parseAmountDenomString(tokenEvent.attributes.amount)
        : [];
      return amount?.toFixed() || '0';
    }

    function getTokenBReserves() {
      const tokenEvent =
        attributes.TokenIn === tokenB.address
          ? // find tokens spent
            events.find(
              (event): event is CoinSpentEvent =>
                event.type === 'coin_spent' &&
                event.attributes.spender === attributes.Receiver
            )
          : // find tokens received
            events.find(
              (event): event is CoinReceivedEvent =>
                event.type === 'coin_received' &&
                event.attributes.receiver === attributes.Receiver
            );
      const [amount] = tokenEvent
        ? parseAmountDenomString(tokenEvent.attributes.amount)
        : [];
      return amount?.toFixed() || '0';
    }

    function getTokenReservesInDenom(token: Token, reserves: string) {
      return getAmountInDenom(token, reserves, token.base, token.display, {
        fractionalDigits: 3,
        significantDigits: 3,
      });
    }
  })();

  return (
    <td
      className={
        heading === 'Wallet' || heading === 'Type' ? 'cell-highlighted' : ''
      }
    >
      {content}
    </td>
  );
}
