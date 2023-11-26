import { useEffect, useMemo, useState } from 'react';

import useTransactionTableData, {
  Tx,
} from '../Pool/hooks/useTransactionTableData';

import { useCurrentPriceFromTicks } from '../../components/Liquidity/useCurrentPriceFromTicks';
import { formatAmount, getDecimalPlaces } from '../../lib/utils/number';
import { useSimplePrice } from '../../lib/tokenPrices';
import { Token, getTokenId, getTokenValue } from '../../lib/web3/utils/tokens';

import {
  getLastPrice,
  getSpentTokenAmount,
  mapEventAttributes,
} from '../../lib/web3/utils/events';

import './OrderbookList.scss';

// ensure that a certain amount of rows are shown in the card
const pageSize = 20;
const tradeListSize = 18;

export default function OrderBookTradesList({
  tokenA,
  tokenB,
}: {
  tokenA: Token;
  tokenB: Token;
}) {
  const { data } = useTransactionTableData({
    tokenA,
    tokenB,
    action: 'PlaceLimitOrder',
    pageSize,
  });

  const [tradeList, setTradeList] = useState<Array<Tx>>([]);
  useEffect(() => {
    if (data) {
      setTradeList((prevTradeList) => {
        const prevTradeListIds = prevTradeList.map((tx) => tx.hash).join(',');
        const { txs = [] } = data;
        const nextTradeList = txs
          .concat(prevTradeList)
          // return unique txs by tx hash
          .reduce<Array<Tx>>(
            (txs, tx) =>
              txs.find((t) => t.hash === tx.hash) ? txs : [...txs, tx],
            []
          )
          .slice(0, tradeListSize + 1);
        const nextTradeListIds = nextTradeList.map((tx) => tx.hash).join(',');
        // update the trade list or not
        if (nextTradeListIds !== prevTradeListIds) {
          return nextTradeList;
        } else {
          return prevTradeList;
        }
      });
    }
  }, [data]);

  const currentPrice = useCurrentPriceFromTicks(
    getTokenId(tokenA),
    getTokenId(tokenB)
  );

  const priceDecimalPlaces =
    currentPrice !== undefined
      ? getDecimalPlaces(currentPrice.toNumber(), 6)
      : undefined;

  return (
    <div className="flex-centered orderbook-list">
      <table className="orderbook-list__table">
        <colgroup>
          {/* minimize the first column width */}
          <col width="0" />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th className="text-medium text-muted text-left">Price</th>
            <th className="text-medium text-muted text-right">Amount</th>
            <th className="text-medium text-muted text-right">Time</th>
          </tr>
        </thead>
        <tbody className="orderbook-list__table__txs">
          {tradeList.map((tx, index, txs) => {
            if (index < tradeListSize) {
              return (
                <OrderbookTradeListRow
                  key={tx.hash}
                  tx={tx}
                  nextTx={txs[index - 1]}
                  previousTx={txs[index + 1]}
                  tokenA={tokenA}
                  tokenB={tokenB}
                  priceDecimalPlaces={priceDecimalPlaces}
                />
              );
            } else {
              return null;
            }
          })}
        </tbody>
      </table>
    </div>
  );
}

function OrderbookTradeListRow({
  tx,
  nextTx,
  previousTx,
  tokenA,
  tokenB,
  priceDecimalPlaces = 6,
  amountDecimalPlaces = 2,
}: {
  tx: Tx;
  nextTx?: Tx;
  previousTx?: Tx;
  tokenA: Token;
  tokenB: Token;
  priceDecimalPlaces?: number;
  amountDecimalPlaces?: number;
}) {
  const { data: priceA } = useSimplePrice(tokenA);
  const { data: priceB } = useSimplePrice(tokenB);

  const events = useMemo(() => {
    return tx.tx_result.events.map(mapEventAttributes);
  }, [tx]);
  const previousEvents = useMemo(() => {
    return previousTx?.tx_result.events.map(mapEventAttributes) || [];
  }, [previousTx]);

  const lastPrice = useMemo(() => {
    return getLastPrice(events, { tokenA, tokenB });
  }, [events, tokenA, tokenB]);
  const prevPrice = useMemo(() => {
    return getLastPrice(previousEvents, { tokenA, tokenB });
  }, [previousEvents, tokenA, tokenB]);

  const diff = useMemo(() => {
    return lastPrice !== undefined && prevPrice !== undefined
      ? lastPrice.minus(prevPrice).toNumber()
      : 0;
  }, [lastPrice, prevPrice]);

  const value = useMemo(() => {
    const amountSpentA = getSpentTokenAmount(events, { matchToken: tokenA });
    const amountSpentB = getSpentTokenAmount(events, { matchToken: tokenB });
    const amountReceivedA = getSpentTokenAmount(events, { matchToken: tokenA });
    const amountReceivedB = getSpentTokenAmount(events, { matchToken: tokenB });
    const amountA = amountSpentA.plus(amountReceivedA);
    const amountB = amountSpentB.plus(amountReceivedB);
    const valueA = getTokenValue(tokenA, amountA.toNumber(), priceA) || 0;
    const valueB = getTokenValue(tokenB, amountB.toNumber(), priceB) || 0;
    return valueA + valueB;
  }, [events, priceA, priceB, tokenA, tokenB]);

  const nextDay =
    nextTx?.timestamp && dayFormat.format(new Date(nextTx.timestamp));
  const today = tx.timestamp && dayFormat.format(new Date(tx.timestamp));
  return (
    <>
      {nextDay && nextDay !== today && (
        <tr>
          <td className="text-right" colSpan={3}>
            {today}
          </td>
        </tr>
      )}
      <tr>
        <DiffCell className="text-right" diff={diff}>
          {lastPrice
            ? formatAmount(lastPrice?.toNumber(), {
                minimumFractionDigits: priceDecimalPlaces,
                maximumFractionDigits: priceDecimalPlaces,
              })
            : '-'}
        </DiffCell>
        <td className="text-right text-muted">
          {value !== undefined
            ? value > 0.005
              ? formatAmount(value, {
                  minimumFractionDigits: amountDecimalPlaces,
                  maximumFractionDigits: amountDecimalPlaces,
                })
              : '<0.01'
            : '...'}
        </td>
        <td className="text-right text-muted">
          {tx.timestamp ? timeFormat.format(new Date(tx.timestamp)) : '-'}
        </td>
      </tr>
    </>
  );
}

function DiffCell({
  diff = 0,
  className,
  ...props
}: JSX.IntrinsicElements['td'] & { diff?: number }) {
  return (
    // add style of diff to classnames
    <td
      className={[
        className,
        diff > 0 ? 'text-success' : diff < 0 ? 'text-error' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  );
}

const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
});

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});
