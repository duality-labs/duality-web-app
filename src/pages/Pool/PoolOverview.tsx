import BigNumber from 'bignumber.js';
import { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';

import PoolLayout from './PoolLayout';
import { PriceCardRow, PairPriceCard } from '../../components/cards/PriceCard';
import Table from '../../components/Table';
import TableCard from '../../components/cards/TableCard';
import Tabs from '../../components/Tabs/Tabs';
import PoolChart from './PoolChart';
import { SmallCardRow } from '../../components/cards/SmallCard';
import StatCardTVL from '../../components/stats/StatCardTVL';

import { formatAddress } from '../../lib/web3/utils/address';
import {
  Token,
  TokenPair,
  getDisplayDenomAmount,
  getTokenId,
} from '../../lib/web3/utils/tokens';
import { getPairID, hasInvertedOrder } from '../../lib/web3/utils/pairs';
import {
  ChainEvent,
  DexDepositEvent,
  DexEvent,
  DexMessageAction,
  DexPlaceLimitOrderEvent,
  DexWithdrawalEvent,
  mapEventAttributes,
  getSpentTokenAmount,
  getReceivedTokenAmount,
} from '../../lib/web3/utils/events';

import useTransactionTableData, { Tx } from './hooks/useTransactionTableData';
import { useUserHasDeposits } from '../../lib/web3/hooks/useUserDeposits';
import { useSimplePrice } from '../../lib/tokenPrices';
import { formatAmount, formatCurrency } from '../../lib/utils/number';
import { formatRelativeTime } from '../../lib/utils/time';

import './Pool.scss';
import {
  useTokenPathPart,
  useTokenValue,
} from '../../lib/web3/hooks/useTokens';
import StatCardVolume from '../../components/stats/StatCardVolume';
import StatCardFees from '../../components/stats/StatCardFees';
import StatCardVolatility from '../../components/stats/StatCardVolatility';
import { useStatComposition } from '../../components/stats/hooks';

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

  const tokenPair = useMemo<TokenPair>(
    () => [tokenA, tokenB],
    [tokenA, tokenB]
  );
  const { data: userHasDeposits } = useUserHasDeposits(tokenPair);

  const tokenAPath = useTokenPathPart(tokenA);
  const tokenBPath = useTokenPathPart(tokenB);

  return (
    <PoolLayout tokenA={tokenA} tokenB={tokenB} swap={swap}>
      <div className="row mt-3 mb-xl">
        <div className="col">
          <PriceCardRow>
            <PairPriceCard tokenA={tokenA} tokenB={tokenB} />
            <PairPriceCard tokenA={tokenB} tokenB={tokenA} />
          </PriceCardRow>
        </div>
        <div className="col ml-auto">
          <div className="row gap-lg">
            <div className="col">
              <Link to={`/pools/${tokenAPath}/${tokenBPath}/add`}>
                <button className="button button-primary py-3 px-4">
                  {userHasDeposits ? (
                    <>Add To Position</>
                  ) : (
                    <>Create New Position</>
                  )}
                </button>
              </Link>
            </div>
            {userHasDeposits && (
              <div className="col">
                <Link to={`/pools/${tokenAPath}/${tokenBPath}/edit`}>
                  <button className="button button-primary py-3 px-4">
                    Edit Position
                  </button>
                </Link>
              </div>
            )}
            <div className="col">
              <Link to={`/orderbook/${tokenAPath}/${tokenBPath}`}>
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
                <StatCardTVL tokenA={tokenA} tokenB={tokenB} />
                <StatCardVolume tokenA={tokenA} tokenB={tokenB} />
                <StatCardFees tokenA={tokenA} tokenB={tokenB} />
                <StatCardVolatility tokenA={tokenA} tokenB={tokenB} />
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
        </div>
        <div className="col col-lg col--left gap-4" style={{ width: 300 }}>
          <PairComposition tokenA={tokenA} tokenB={tokenB} />
        </div>
      </div>
    </PoolLayout>
  );
}

function PairComposition({ tokenA, tokenB }: { tokenA: Token; tokenB: Token }) {
  const [, amounts] = useStatComposition(tokenA, tokenB);
  const [amountA, amountB] = amounts || [];

  const valueA = useTokenValue(tokenA, amountA);
  const valueB = useTokenValue(tokenB, amountB);

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
        function TokenCell2({ row: token }: { row: Token }) {
          return (
            <td>
              {formatAmount(
                getDisplayDenomAmount(
                  token,
                  token === tokenA ? amountA : amountB
                ) || 0
              )}
            </td>
          );
        },
        function TokenCell3({ row: token }: { row: Token }) {
          return (
            <td>{formatCurrency((token === tokenA ? valueA : valueB) || 0)}</td>
          );
        },
      ],
      data: [tokenA, tokenB],
    };
  }, [amountA, amountB, tokenA, tokenB, valueA, valueB]);

  return (
    <TableCard title="Pair Composition" className="pb-5" scrolling={false}>
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

function TransactionsTable({
  tokenA,
  tokenB,
  action,
}: {
  tokenA: Token;
  tokenB: Token;
  action?: DexMessageAction;
}) {
  const query = useTransactionTableData({ tokenA, tokenB, action });

  const columns = useMemo(() => {
    return transactionTableHeadings.map(
      (heading: TransactionTableColumnKey) => {
        return function TransactionTableColumn({ row: tx }: { row: Tx }) {
          const events = tx.tx_result.events.map((event) =>
            mapEventAttributes<DexEvent>(event)
          );

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
          const withdrawalEvents = events.filter(
            (event): event is DexWithdrawalEvent =>
              event.attributes.action === 'Withdraw'
          );
          if (withdrawalEvents.length > 0) {
            return (
              <WithdrawalColumn
                tx={tx}
                events={withdrawalEvents}
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
      <Table<Tx>
        data={query.data?.txs}
        headings={transactionTableHeadings.map((heading) => (
          <TransactionTableHeading
            key={heading}
            tokenA={tokenA}
            tokenB={tokenB}
            heading={heading}
          />
        ))}
        columns={columns}
        rowDescription="Transactions"
      />
    </div>
  );
}

interface EventColumnProps<T> {
  tokenA: Token;
  tokenB: Token;
  tx: Tx;
  events: T[];
  heading: TransactionTableColumnKey;
}
interface GenericEventColumnProps<T> extends EventColumnProps<T> {
  action: 'Deposit' | 'Withdraw';
  getToken0Reserves: (event: T) => string;
  getToken1Reserves: (event: T) => string;
}

function EventColumn<
  T extends DexDepositEvent | DexWithdrawalEvent | DexPlaceLimitOrderEvent
>({
  tx,
  events,
  heading,
  tokenA,
  tokenB,
  action,
  getToken0Reserves,
  getToken1Reserves,
}: GenericEventColumnProps<T>) {
  const {
    data: [tokenAPrice, tokenBPrice],
    isValidating,
  } = useSimplePrice([tokenA, tokenB]);
  // get common attributes from first event
  const [
    {
      attributes: { Creator, TokenZero, TokenOne },
    },
  ] = events;

  const content = (() => {
    switch (heading) {
      case 'Wallet':
        return formatAddress(Creator);
      case 'Type':
        return `${action === 'Deposit' ? 'Add' : 'Remove'} ${[
          Number(getTokenAReserves()) > 0 && tokenA.symbol,
          Number(getTokenBReserves()) > 0 && tokenB.symbol,
        ]
          .filter(Boolean)
          .join(' and ')}`;
      case 'Token A Amount':
        return formatAmount(
          getTokenReservesInDenom(tokenA, getTokenAReserves().toFixed()) || 0
        );
      case 'Token B Amount':
        return formatAmount(
          getTokenReservesInDenom(tokenB, getTokenBReserves().toFixed()) || 0
        );
      case 'Total Value':
        const values = [
          new BigNumber(
            getDisplayDenomAmount(tokenA, getTokenAReserves()) || 0
          ).multipliedBy(tokenAPrice || 0),
          new BigNumber(
            getDisplayDenomAmount(tokenB, getTokenBReserves()) || 0
          ).multipliedBy(tokenBPrice || 0),
        ];
        // return loading start or calculated value
        return !tokenA && !tokenB && isValidating
          ? '...'
          : formatCurrency(values[0].plus(values[1]).toNumber());
      case 'Time':
        return tx.timestamp
          ? formatRelativeTime(tx.timestamp)
          : `Block: ${tx.height}`;
    }
    return null;

    function getHasInvertedOrder(): boolean {
      return hasInvertedOrder(getPairID(TokenZero, TokenOne), [tokenA, tokenB]);
    }

    function getTokenAReserves() {
      return getHasInvertedOrder()
        ? events.map(getToken1Reserves).reduce(sumBigNumber, new BigNumber(0))
        : events.map(getToken0Reserves).reduce(sumBigNumber, new BigNumber(0));
    }

    function getTokenBReserves() {
      return getHasInvertedOrder()
        ? events.map(getToken0Reserves).reduce(sumBigNumber, new BigNumber(0))
        : events.map(getToken1Reserves).reduce(sumBigNumber, new BigNumber(0));
    }

    function sumBigNumber(acc: BigNumber, value: string) {
      return acc.plus(value);
    }

    function getTokenReservesInDenom(token: Token, reserves: string) {
      return getDisplayDenomAmount(token, reserves, {
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

function DepositColumn(props: EventColumnProps<DexDepositEvent>) {
  const getToken0Reserves = useCallback(({ attributes }: DexDepositEvent) => {
    return attributes.ReservesZeroDeposited;
  }, []);
  const getToken1Reserves = useCallback(({ attributes }: DexDepositEvent) => {
    return attributes.ReservesOneDeposited;
  }, []);

  return (
    <EventColumn<DexDepositEvent>
      {...props}
      action="Deposit"
      getToken0Reserves={getToken0Reserves}
      getToken1Reserves={getToken1Reserves}
    />
  );
}

function WithdrawalColumn(props: EventColumnProps<DexWithdrawalEvent>) {
  const getToken0Reserves = useCallback(
    ({ attributes }: DexWithdrawalEvent) => {
      return attributes.ReservesZeroWithdrawn;
    },
    []
  );
  const getToken1Reserves = useCallback(
    ({ attributes }: DexWithdrawalEvent) => {
      return attributes.ReservesOneWithdrawn;
    },
    []
  );

  return (
    <EventColumn<DexWithdrawalEvent>
      {...props}
      action="Withdraw"
      getToken0Reserves={getToken0Reserves}
      getToken1Reserves={getToken1Reserves}
    />
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
  tx: Tx;
  event: DexPlaceLimitOrderEvent;
  events: ChainEvent[];
  heading: TransactionTableColumnKey;
}) {
  const {
    data: [tokenAPrice, tokenBPrice],
    isValidating,
  } = useSimplePrice([tokenA, tokenB]);
  const tokenIdA = getTokenId(tokenA);
  const tokenIdB = getTokenId(tokenB);

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
        return formatAmount(
          getTokenReservesInDenom(tokenA, getTokenAReserves()) || '0'
        );
      case 'Token B Amount':
        return formatAmount(
          getTokenReservesInDenom(tokenB, getTokenBReserves()) || '0'
        );
      case 'Total Value':
        const values = [
          new BigNumber(
            getDisplayDenomAmount(tokenA, getTokenAReserves()) || 0
          ).multipliedBy(tokenAPrice || 0),
          new BigNumber(
            getDisplayDenomAmount(tokenB, getTokenBReserves()) || 0
          ).multipliedBy(tokenBPrice || 0),
        ];
        // return loading start or calculated value
        return !tokenA && !tokenB && isValidating
          ? '...'
          : formatCurrency(values[0].plus(values[1]).toNumber());
      case 'Time':
        return tx.timestamp
          ? formatRelativeTime(tx.timestamp)
          : `Block: ${tx.height}`;
    }
    return null;

    function getTokenAReserves() {
      const address = attributes.Creator;
      return attributes.TokenIn === tokenIdA
        ? getSpentTokenAmount(events, { address, matchTokenId: tokenIdA })
        : getReceivedTokenAmount(events, { address, matchTokenId: tokenIdA });
    }

    function getTokenBReserves() {
      const address = attributes.Creator;
      return attributes.TokenIn === tokenIdB
        ? getSpentTokenAmount(events, { address, matchTokenId: tokenIdB })
        : getReceivedTokenAmount(events, { address, matchTokenId: tokenIdB });
    }

    function getTokenReservesInDenom(token: Token, reserves: BigNumber.Value) {
      return getDisplayDenomAmount(token, reserves, {
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
