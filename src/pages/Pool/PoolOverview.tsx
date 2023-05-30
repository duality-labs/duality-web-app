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

import { useLcdClientPromise } from '../../lib/web3/lcdClient';
import { formatAddress } from '../../lib/web3/utils/address';
import { Token, getAmountInDenom } from '../../lib/web3/utils/tokens';
import { getPairID, hasInvertedOrder } from '../../lib/web3/utils/pairs';
import {
  DexDepositEvent,
  DexMessageAction,
  decodeEvent,
  getEventAttributeMap,
} from '../../lib/web3/utils/events';

import { useSimplePrice } from '../../lib/tokenPrices';
import { formatCurrency } from '../../lib/utils/number';

import './Pool.scss';

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
          <div className={'overview-card col'}>Body</div>
          <div className="col pt-lg col-lg-hide">Sidebar 1a</div>
          <div>
            <PoolOverviewTable tokenA={tokenA} tokenB={tokenB} />
          </div>
          <div className="col pt-lg col-lg-hide">Sidebar 1b</div>
        </div>
        <div className="col col-lg col--left gap-4">Sidebar 2</div>
      </div>
    </PoolLayout>
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
  const [pageKey] = useState<string>();
  const query = useQuery({
    queryKey: ['events', action, pageKey],
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

      return await lcd.cosmos.tx.v1beta1.req.get(
        `cosmos/tx/v1beta1/txs?${
          // create Query string (with all appropriate characters escaped)
          new URLSearchParams({
            events: [
              "message.module='dex'",
              action && `message.action='${action}'`,
            ]
              .filter(Boolean)
              .join(' AND '),
            order_by: 'ORDER_BY_DESC',
            'pagination.limit': `${pageSize || 10}`,
            // add page key if it exists
            ...(pageKey && {
              'pagination.key': pageKey,
            }),
          })
        }`
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
          const events = tx.events.map(decodeEvent).map(getEventAttributeMap);
          const depositEvent = events.find(
            (event): event is DexDepositEvent => event.action === 'Deposit'
          );

          // return function component that accepts row as data prop
          if (depositEvent) {
            return (
              <DepositColumn
                tx={tx}
                event={depositEvent}
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
  event,
  heading,
  tokenA,
  tokenB,
}: {
  tokenA: Token;
  tokenB: Token;
  tx: TxResponseSDKType;
  event: DexDepositEvent;
  heading: TransactionTableColumnKey;
}) {
  const {
    data: [tokenAPrice, tokenBPrice],
    isValidating,
  } = useSimplePrice([tokenA, tokenB]);

  const content = (() => {
    switch (heading) {
      case 'Wallet':
        return formatAddress(event?.Creator);
      case 'Type':
        return `Add ${[
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
        return tx.timestamp;
    }
    return null;

    function getHasInvertedOrder(): boolean {
      return hasInvertedOrder(
        getPairID(event.Token0, event.Token1),
        tokenA.address,
        tokenB.address
      );
    }

    function getTokenAReserves() {
      return getHasInvertedOrder()
        ? event?.Reserves1Deposited
        : event?.Reserves0Deposited;
    }

    function getTokenBReserves() {
      return getHasInvertedOrder()
        ? event?.Reserves0Deposited
        : event?.Reserves1Deposited;
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
