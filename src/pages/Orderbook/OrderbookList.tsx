import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import BigNumber from 'bignumber.js';
import useResizeObserver from '@react-hook/resize-observer';

import { useRealtimePrice } from '../../components/stats/hooks';
import {
  formatAmount,
  getDecimalPlaces,
  getOrderOfMagnitude,
} from '../../lib/utils/number';
import { useTokenPairTickLiquidity } from '../../lib/web3/hooks/useTickLiquidity';
import { useOrderedTokenPair } from '../../lib/web3/hooks/useTokenPairs';
import { useSimplePrice } from '../../lib/tokenPrices';
import { Token, getTokenId, getTokenValue } from '../../lib/web3/utils/tokens';
import { TickInfo, priceToTickIndex } from '../../lib/web3/utils/ticks';
import type { PriceOffset } from './Orderbook';

import './OrderbookList.scss';

export default function OrderBookList({
  tokenA,
  tokenB,
  priceIndication,
  setPriceOffset,
}: {
  tokenA: Token;
  tokenB: Token;
  priceIndication?: number | undefined;
  setPriceOffset?: React.Dispatch<
    React.SetStateAction<PriceOffset | undefined>
  >;
}) {
  const [tokenIdA, tokenIdB] = [getTokenId(tokenA), getTokenId(tokenB)];
  const [tokenId0, tokenId1] = useOrderedTokenPair([tokenIdA, tokenIdB]) || [];
  const {
    data: [tokenATicks = [], tokenBTicks = []],
  } = useTokenPairTickLiquidity([tokenIdA, tokenIdB]);

  const [forward, reverse] = [
    tokenId0 === tokenIdA && tokenId1 === tokenIdB,
    tokenId1 === tokenIdA && tokenId0 === tokenIdB,
  ];

  const onHighlightPrice = useCallback(
    (includeElementHeight: boolean) =>
      (
        e: React.MouseEvent<HTMLTableRowElement, MouseEvent>,
        tick: TickInfo | undefined
      ) => {
        const row = e.target as HTMLTableRowElement | null;
        const addOffset = (el: HTMLElement): number => {
          if (el.tagName === 'TBODY') return 0;
          return (
            el.offsetTop +
            (el.tagName !== 'TABLE' && el.offsetParent
              ? addOffset(el.offsetParent as HTMLElement)
              : 0)
          );
        };
        setPriceOffset?.(
          row && tick
            ? [
                tick.price1To0.toNumber(),
                addOffset(row) + (includeElementHeight ? row.offsetHeight : 1),
              ]
            : undefined
        );
      },
    [setPriceOffset]
  );

  const [onHighlightHighPrice, onHighlightLowPrice] = useMemo(
    () => [onHighlightPrice(false), onHighlightPrice(true)],
    [onHighlightPrice]
  );

  const [, currentPrice] = useRealtimePrice(tokenA, tokenB);
  const resolutionPercent = 0.01; // size of price steps

  // ensure that a certain amount of liquidity rows are shown in the card
  const [shownTickRows, setShownTickRows] = useState<number>(8);
  const spacingTicks = useMemo(
    () => Array.from({ length: shownTickRows }).map(() => undefined),
    [shownTickRows]
  );

  const getTickBuckets = useCallback(
    (forward: boolean, descendingOrder = forward) => {
      const resolutionOrderOfMagnitude = getOrderOfMagnitude(resolutionPercent);
      const step =
        currentPrice &&
        Math.pow(
          10,
          getOrderOfMagnitude(currentPrice) + resolutionOrderOfMagnitude
        );

      const ticks = forward ? tokenATicks : tokenBTicks;
      const precision = 1 - resolutionOrderOfMagnitude;
      // todo: fix bucket collect to stop when enough buckets are filled
      const tickBucketLimits = Array.from({
        length: shownTickRows * 100,
      }).flatMap((_, index) =>
        currentPrice && step
          ? descendingOrder
            ? Number(
                new BigNumber(currentPrice)
                  .minus(index * step)
                  .toPrecision(precision, BigNumber.ROUND_FLOOR)
              )
            : Number(
                new BigNumber(currentPrice)
                  .plus(index * step)
                  .toPrecision(precision, BigNumber.ROUND_CEIL)
              )
          : []
      );
      const tickBucketsLimit = descendingOrder
        ? Math.min(...tickBucketLimits)
        : Math.max(...tickBucketLimits);

      const groupedTickEntries = ticks.reduce<
        Array<[roundedPrice: number, reserves: number]>
      >(
        (acc, tick) => {
          // add if price is within bounds
          if (
            step &&
            currentPrice &&
            // select tick prices within the outer edge of price buckets
            (descendingOrder
              ? tick.price1To0.isGreaterThanOrEqualTo(tickBucketsLimit)
              : tick.price1To0.isLessThanOrEqualTo(tickBucketsLimit)) &&
            // select tick prices within the inner edge of price buckets
            (descendingOrder
              ? tick.price1To0.isLessThanOrEqualTo(currentPrice)
              : tick.price1To0.isGreaterThanOrEqualTo(currentPrice))
          ) {
            const foundEntry = acc.find(([limit]) => {
              return descendingOrder
                ? tick.price1To0.isGreaterThanOrEqualTo(limit)
                : tick.price1To0.isLessThanOrEqualTo(limit);
            });
            if (foundEntry !== undefined) {
              foundEntry[1] += (
                forward ? tick.reserve0 : tick.reserve1
              ).toNumber();
            }
          }
          return acc;
        },
        tickBucketLimits.map((limit) => [limit, 0])
      );
      const groupedTicks = Object.fromEntries(groupedTickEntries);

      // create TickInfo replacements for bucketed data
      const syntheticTicks = tickBucketLimits.map((key): TickInfo => {
        return {
          token0: forward ? tokenA : tokenB,
          token1: forward ? tokenB : tokenA,
          fee: new BigNumber(0),
          price1To0: new BigNumber(key),
          tickIndex1To0: priceToTickIndex(new BigNumber(key)),
          reserve0: new BigNumber(forward ? groupedTicks[key] || 0 : 0),
          reserve1: new BigNumber(forward ? 0 : groupedTicks[key] || 0),
        };
      });

      const nonZeroTicks = syntheticTicks.filter(
        (tick) => !tick.reserve0.isZero() || !tick.reserve1.isZero()
      );

      return [...nonZeroTicks, ...spacingTicks].slice(0, shownTickRows);
    },
    [
      currentPrice,
      tokenATicks,
      tokenBTicks,
      shownTickRows,
      spacingTicks,
      tokenA,
      tokenB,
    ]
  );

  // get tokenA as the top ascending from current price list
  const filteredTokenATicks = useMemo<Array<TickInfo | undefined>>(() => {
    return getTickBuckets(forward).reverse();
  }, [forward, getTickBuckets]);
  const filteredTokenBTicks = useMemo<Array<TickInfo | undefined>>(() => {
    return getTickBuckets(!forward);
  }, [forward, getTickBuckets]);

  const [previousPrice, setPreviousPrice] = useState<number | undefined>();
  const lastPrice = useRef<number | undefined>(currentPrice || undefined);
  useEffect(() => {
    if (
      currentPrice &&
      (!lastPrice.current || lastPrice.current !== currentPrice)
    ) {
      // set old data
      if (lastPrice.current) {
        // and remove undefined ticks from list
        setPreviousPrice(lastPrice.current);
      }
      // set new data
      lastPrice.current = currentPrice;
    }
  }, [currentPrice, filteredTokenATicks]);

  const [topTicks, bottomTicks] = useMemo(() => {
    return forward
      ? [filteredTokenBTicks.reverse(), filteredTokenATicks.reverse()]
      : [filteredTokenATicks, filteredTokenBTicks];
  }, [filteredTokenATicks, filteredTokenBTicks, forward]);

  const priceDecimalPlaces =
    currentPrice !== undefined && currentPrice !== null
      ? getDecimalPlaces(
          currentPrice,
          1 - getOrderOfMagnitude(resolutionPercent)
        )
      : undefined;

  // execute on every layout update
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const calculateRows = useCallback(() => {
    const table = tableContainerRef.current;
    const sections = table && {
      header: table.querySelector('thead'),
      spacer: table.querySelectorAll('tbody').item(0),
      top: table.querySelectorAll('tbody').item(1),
      center: table.querySelectorAll('tbody').item(2),
      bottom: table.querySelectorAll('tbody').item(3),
    };
    if (
      sections &&
      sections.header &&
      sections.top &&
      sections.center &&
      sections.bottom
    ) {
      // measure the table height
      const tableHeight = table.offsetHeight;
      // measure the table rows
      const tableHeightForRows =
        tableHeight -
        sections.spacer.offsetHeight -
        sections.header.offsetHeight -
        sections.center.offsetHeight;
      const tableRowHeight =
        (sections.top.offsetHeight + sections.bottom.offsetHeight) /
        (2 * shownTickRows);
      // determine how many rows we could add to the table
      const maxRowCount = Math.floor(tableHeightForRows / tableRowHeight / 2);
      setShownTickRows(maxRowCount);
    }
  }, [shownTickRows]);
  useResizeObserver(tableContainerRef, calculateRows);
  useLayoutEffect(calculateRows);

  return (
    <div className="flex-centered orderbook-list flex" ref={tableContainerRef}>
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
          </tr>
        </thead>
        <tbody className="orderbook-list__table__gap">
          <tr>
            <td className="table-body-spacer"></td>
          </tr>
        </tbody>
        <tbody className="orderbook-list__table__ticks-top">
          {topTicks.map((tick, index) => {
            const price = tick && tick?.price1To0.toNumber();
            return (
              <OrderbookListRow
                key={index}
                tick={tick}
                token={!forward ? tokenA : tokenB}
                reserveKey="reserve1"
                priceDecimalPlaces={priceDecimalPlaces}
                active={price && priceIndication && price <= priceIndication}
                onHighlight={onHighlightHighPrice}
              />
            );
          })}
        </tbody>
        <tbody className="orderbook-list__table__tick-center">
          <tr
            onMouseEnter={() => setPriceOffset?.([currentPrice || undefined])}
            onMouseLeave={() => setPriceOffset?.([])}
          >
            <DiffCell
              colSpan={2}
              className="text-center py-3"
              diff={
                previousPrice && currentPrice
                  ? currentPrice - previousPrice
                  : undefined
              }
            >
              {currentPrice
                ? `${formatAmount(currentPrice)} ${tokenA.symbol} per ${
                    tokenB.symbol
                  }`
                : '-'}
            </DiffCell>
          </tr>
        </tbody>
        <tbody className="orderbook-list__table__ticks-bottom">
          {bottomTicks.map((tick, index) => {
            const price = tick && tick?.price1To0.toNumber();
            return (
              <OrderbookListRow
                key={index}
                tick={tick}
                token={!reverse ? tokenA : tokenB}
                reserveKey="reserve0"
                priceDecimalPlaces={priceDecimalPlaces}
                active={price && priceIndication && price >= priceIndication}
                onHighlight={onHighlightLowPrice}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OrderbookListRow({
  tick,
  token,
  reserveKey,
  priceDecimalPlaces = 6,
  amountDecimalPlaces = 2,
  active,
  onHighlight,
}: {
  tick: TickInfo | undefined;
  token: Token;
  reserveKey: 'reserve0' | 'reserve1';
  priceDecimalPlaces?: number;
  amountDecimalPlaces?: number;
  active?: boolean | 0;
  onHighlight?: (
    e: React.MouseEvent<HTMLTableRowElement, MouseEvent>,
    tick: TickInfo | undefined
  ) => void;
}) {
  const { data: price } = useSimplePrice(token);

  // keep track of hover state and use as a price indication in parents
  const [hovered, setHovered] = useState<boolean>(false);
  const onHover = useCallback(
    (
      e: React.MouseEvent<HTMLTableRowElement, MouseEvent>,
      tick: TickInfo | undefined
    ) => {
      // set hovered state
      setHovered(!!tick);
      // set parent state
      onHighlight?.(e, tick);
    },
    [onHighlight]
  );
  const onHoverIn = useCallback<React.MouseEventHandler<HTMLTableRowElement>>(
    (e) => onHover(e, tick),
    [onHover, tick]
  );
  const onHoverOut = useCallback<React.MouseEventHandler<HTMLTableRowElement>>(
    (e) => onHover(e, undefined),
    [onHover]
  );

  // add empty row
  if (!tick) {
    return (
      <tr>
        <td colSpan={2}>&nbsp;</td>
      </tr>
    );
  }
  // add tick row
  const value = getTokenValue(token, tick[reserveKey], price);
  return (
    <tr
      key={tick.tickIndex1To0.toNumber()}
      className={[active && 'active', hovered && 'hovered']
        .filter(Boolean)
        .join(' ')}
      onMouseEnter={onHoverIn}
      onMouseLeave={onHoverOut}
    >
      <DiffCell className="text-right">
        {formatAmount(tick.price1To0.toNumber(), {
          minimumFractionDigits: priceDecimalPlaces,
          maximumFractionDigits: priceDecimalPlaces,
        })}
      </DiffCell>
      <td className="text-right text-muted">
        {formatAmount(value ?? '...', {
          minimumFractionDigits: amountDecimalPlaces,
          maximumFractionDigits: amountDecimalPlaces,
        })}
      </td>
    </tr>
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
