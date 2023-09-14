import BigNumber from 'bignumber.js';
import { useCallback, useMemo, useState } from 'react';
import { Link, useMatch } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import PoolLayout from './PoolLayout';
import { PriceCardRow, PairPriceCard } from '../../components/cards/PriceCard';
import Table from '../../components/Table';
import TableCard from '../../components/cards/TableCard';
import Tabs from '../../components/Tabs/Tabs';
import PoolChart from './PoolChart';
import { SmallCardRow } from '../../components/cards/SmallCard';
import StatCardTVL from '../../components/stats/StatCardTVL';

import { formatAddress } from '../../lib/web3/utils/address';
import { Token, getDisplayDenomAmount } from '../../lib/web3/utils/tokens';
import {
  getPairID,
  guessInvertedOrder,
  hasInvertedOrder,
} from '../../lib/web3/utils/pairs';
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

import { useSimplePrice } from '../../lib/tokenPrices';
import {
  formatAmount,
  formatCurrency,
  formatPrice,
} from '../../lib/utils/number';
import { formatRelativeTime } from '../../lib/utils/time';

import './Pool.scss';
import useTokens, {
  matchTokenByAddress,
  useTokenPathPart,
  useTokenValue,
} from '../../lib/web3/hooks/useTokens';
import {
  usePoolDepositFilterForPair,
  useUserDeposits,
} from '../../lib/web3/hooks/useUserShares';
import StatCardVolume from '../../components/stats/StatCardVolume';
import StatCardFees from '../../components/stats/StatCardFees';
import StatCardVolatility from '../../components/stats/StatCardVolatility';
import { useStatComposition } from '../../components/stats/hooks';
import useIncentiveGauges from '../../lib/web3/hooks/useIncentives';
import { Gauge } from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/incentives/gauge';
import { tickIndexToPrice } from '../../lib/web3/utils/ticks';

const { REACT_APP__RPC_API = '' } = process.env;

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

  const pairPoolDepositFilter = usePoolDepositFilterForPair([tokenA, tokenB]);
  const userPairDeposits = useUserDeposits(pairPoolDepositFilter);

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
                  {userPairDeposits && userPairDeposits.length > 0 ? (
                    <>Add To Position</>
                  ) : (
                    <>Create New Position</>
                  )}
                </button>
              </Link>
            </div>
            {userPairDeposits && userPairDeposits.length > 0 && (
              <div className="col">
                <Link to={`/pools/${tokenAPath}/${tokenBPath}/edit`}>
                  <button className="button button-primary py-3 px-4">
                    Edit Position
                  </button>
                </Link>
              </div>
            )}
            <div className="col">
              <Link to={`/swap/${tokenAPath}/${tokenBPath}`}>
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
          <div className="col pt-lg">
            <Incentives tokenA={tokenA} tokenB={tokenB} />
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

function Incentives({ tokenA, tokenB }: { tokenA?: Token; tokenB?: Token }) {
  const tokens = useTokens();

  const { data: { gauges } = {} } = useIncentiveGauges();
  const filteredGauges = useMemo(() => {
    const tokenAddresses = [tokenA?.address, tokenB?.address].filter(
      (address): address is string => !!address
    );
    return tokenAddresses.length > 0
      ? gauges?.filter((gauge) => {
          return tokenAddresses.every((address) => {
            return (
              address === gauge.distribute_to?.pairID?.token0 ||
              address === gauge.distribute_to?.pairID?.token1
            );
          });
        })
      : gauges;
  }, [gauges, tokenA, tokenB]);

  const { columns, headings } = useMemo(() => {
    return {
      headings: ['Token', 'Range', 'Reward'],
      columns: [
        function TokenCellLogo({ row }: { row: Gauge }) {
          return (
            <td
              className=" flex row gap-3"
              style={{ alignItems: 'center', justifyContent: 'flex-start' }}
            >
              <div className="row gap-4">
                {row.coins.map((coin) => {
                  const token = tokens.find(matchTokenByAddress(coin.denom));
                  return token ? (
                    <div
                      key={coin.denom}
                      className="price-card__token-logo row flex-centered gap-2 my-2"
                    >
                      <img
                        className="token-logo token-current"
                        alt={`${coin.denom} logo`}
                        src={token.logo_URIs?.svg ?? token.logo_URIs?.png}
                      />{' '}
                      {token.name}
                    </div>
                  ) : null;
                })}
              </div>
            </td>
          );
        },
        function TokenCellRange({ row }: { row: Gauge }) {
          if (row.distribute_to?.pairID) {
            const Token0 = tokens.find(
              matchTokenByAddress(row.distribute_to.pairID.token0)
            );
            const Token1 = tokens.find(
              matchTokenByAddress(row.distribute_to.pairID.token1)
            );
            return (
              <td>
                {row.distribute_to && Token0 && Token1 && (
                  <div className="row gap-2">
                    <div className="col ml-auto">
                      {formatPrice(
                        tickIndexToPrice(
                          new BigNumber(`${row.distribute_to.startTick}`) || 0
                        ).toNumber(),
                        { useGrouping: true, minimumSignificantDigits: 2 }
                      )}
                      &nbsp;-&nbsp;
                      {formatPrice(
                        tickIndexToPrice(
                          new BigNumber(`${row.distribute_to.endTick}`) || 0
                        ).toNumber(),
                        {
                          useGrouping: true,
                          minimumSignificantDigits: 2,
                        }
                      )}
                    </div>
                    <div className="col text-muted">
                      {Token0.symbol}/{Token1.symbol}
                    </div>
                  </div>
                )}
              </td>
            );
          } else {
            return <td></td>;
          }
        },
        function TokenCellReward({ row }: { row: Gauge }) {
          return (
            <td>
              {row.coins.map((coin) => {
                const token = tokens.find(matchTokenByAddress(coin.denom));
                return token ? (
                  <div key={coin.denom} className="row gap-2">
                    <div className="col ml-auto">
                      {formatAmount(
                        Number(coin.amount) / Number(row.num_epochs_paid_over)
                      )}
                    </div>
                    <div className="col text-muted">{token.symbol} Per Day</div>
                  </div>
                ) : null;
              })}
            </td>
          );
        },
      ],
      data: [tokenA, tokenB],
    };
  }, [tokenA, tokenB, tokens]);

  const isOnPortfolioPage = useMatch('/portfolio');

  return (
    <TableCard
      title="Incentives"
      subtitle={
        <>
          Bond your LPs tokens{' '}
          {!isOnPortfolioPage ? (
            <>
              from the{' '}
              <Link
                className="text-secondary"
                style={{ textDecoration: 'underline' }}
                to="/portfolio"
              >
                portfolio page
              </Link>{' '}
            </>
          ) : null}
          to qualify for incentives provided by external sources.
        </>
      }
      className="pb-5"
      scrolling={filteredGauges && filteredGauges.length > 3}
    >
      <Table<Gauge>
        data={filteredGauges}
        columns={columns}
        headings={headings}
        rowDescription="Incentives"
      />
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

type Hash = string;
type EncodedData = string;
type NumericString = string;
interface Tx {
  hash: Hash;
  height: NumericString;
  index: 0;
  timestamp?: string; // this should be added to making a block height data lookup
  tx_result: {
    code: 0;
    data: EncodedData;
    log: EncodedData;
    info: string;
    gas_wanted: NumericString;
    gas_used: NumericString;
    events: Array<{
      type: string;
      attributes: Array<{
        key: string;
        value: string;
        index: boolean;
      }>;
    }>;
    codespace: string;
  };
  tx: EncodedData;
}
interface GetTxsEventResponseManuallyType {
  jsonrpc: '2.0';
  id: -1;
  result: {
    txs: Array<Tx>;
    total_count: NumericString;
  };
}

const blockTimestamps: { [height: string]: string } = {};

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
  const [pageOffset] = useState<number>(0);
  const query = useQuery({
    queryKey: ['events', action, tokenA.address, tokenB.address, pageOffset],
    queryFn: async (): Promise<GetTxsEventResponseManuallyType['result']> => {
      const invertedOrder = guessInvertedOrder(tokenA.address, tokenB.address);

      /*
       * note: you would expect the following to work, but the ABCI query check
       * fails the event query of attribute Token0 and Token1 for numeric chars
       * see: https://github.com/cosmos/cosmos-sdk/commit/18da0e9c15e0210fdd289e3f1f0f5fefe3f6b72a#diff-53f84248611b4e705fd4106d3f6f46eed9258656b0b3db22bd56fdde5628cebdR47
       *
       * const QueryClientImpl = cosmos.tx.v1beta1.ServiceClientImpl;
       * const dualityClient = new QueryClientImpl(rpc);
       * const response = await dualityClient.getTxsEvent({
       *   events: [
       *     `message.module='${'dex'}'`,
       *     !invertedOrder
       *       ? `message.Token='${tokenA.address}'`
       *       : `message.Token0='${tokenB.address}'`,
       *     !invertedOrder
       *       ? `message.Token='${tokenB.address}'`
       *       : `message.Token1='${tokenA.address}'`,
       *     action ? `message.action='${action}'` : '',
       *   ].filter(Boolean),
       *   orderBy: cosmos.tx.v1beta1.OrderBy.ORDER_BY_ASC,
       *   page: Long.fromString(pageOffset + 1),
       *   limit: Long.fromString(pageSize),
       * });
       *
       * instead we will create the query string ourself and add the return type
       */

      const response = await fetch(
        `${REACT_APP__RPC_API}/tx_search?query="${encodeURIComponent(
          [
            `message.module='${'dex'}'`,
            !invertedOrder
              ? `message.Token0='${tokenA.address}'`
              : `message.Token0='${tokenB.address}'`,
            !invertedOrder
              ? `message.Token1='${tokenB.address}'`
              : `message.Token1='${tokenA.address}'`,
            action ? `message.action='${action}'` : '',
          ]
            .filter(Boolean)
            .join(' AND ')
        )}"&per_page=${pageSize}&page=${pageOffset + 1}`
      );
      const result = (await response.json()) as GetTxsEventResponseManuallyType;
      const { total_count, txs } = result['result'];

      // mutate the txs to contain block height timestamps
      const txsWithTimestamps = await Promise.all(
        txs.map(async (tx) => {
          if (!blockTimestamps[tx.height]) {
            const response = await fetch(
              `${REACT_APP__RPC_API}/header?height=${tx.height}`
            );
            if (response.status === 200) {
              const { result } = (await response.json()) as {
                result: {
                  header: {
                    height: string;
                    time: string;
                  };
                };
              };
              blockTimestamps[tx.height] = result.header.time;
            }
          }
          return {
            ...tx,
            timestamp: blockTimestamps[tx.height],
          };
        })
      );

      return {
        total_count,
        txs: txsWithTimestamps,
      };
    },
  });

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
      return hasInvertedOrder(
        getPairID(Token0, Token1),
        tokenA.address,
        tokenB.address
      );
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
    return attributes.Reserves0Deposited;
  }, []);
  const getToken1Reserves = useCallback(({ attributes }: DexDepositEvent) => {
    return attributes.Reserves1Deposited;
  }, []);

  return (
    <EventColumn<DexDepositEvent>
      {...props}
      getToken0Reserves={getToken0Reserves}
      getToken1Reserves={getToken1Reserves}
    />
  );
}

function WithdrawalColumn(props: EventColumnProps<DexWithdrawalEvent>) {
  const getToken0Reserves = useCallback(
    ({ attributes }: DexWithdrawalEvent) => {
      return attributes.Reserves0Withdrawn;
    },
    []
  );
  const getToken1Reserves = useCallback(
    ({ attributes }: DexWithdrawalEvent) => {
      return attributes.Reserves1Withdrawn;
    },
    []
  );

  return (
    <EventColumn<DexWithdrawalEvent>
      {...props}
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
            getDisplayDenomAmount(tokenA, getTokenAReserves()) || 0
          ).multipliedBy(tokenAPrice || 0),
          new BigNumber(
            getDisplayDenomAmount(tokenB, getTokenBReserves()) || 0
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
        return tx.timestamp
          ? formatRelativeTime(tx.timestamp)
          : `Block: ${tx.height}`;
    }
    return null;

    function getTokenAReserves() {
      const address = attributes.Creator;
      return attributes.TokenIn === tokenA.address
        ? getSpentTokenAmount(events, address, { matchToken: tokenA })
        : getReceivedTokenAmount(events, address, { matchToken: tokenA });
    }

    function getTokenBReserves() {
      const address = attributes.Creator;
      return attributes.TokenIn === tokenB.address
        ? getSpentTokenAmount(events, address, { matchToken: tokenB })
        : getReceivedTokenAmount(events, address, { matchToken: tokenB });
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
