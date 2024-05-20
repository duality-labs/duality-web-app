import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import useResizeObserver from '@react-hook/resize-observer';

import { useRealtimeDisplayPrice } from '../../components/stats/hooks';
import { formatAmount } from '../../lib/utils/number';
import { useSimplePrice } from '../../lib/tokenPrices';
import { Token } from '../../lib/web3/utils/tokens';

import type { PriceOffset, BucketOffset } from './Orderbook';
import type { Bucket, Buckets } from './useBuckets';

import './OrderbookList.scss';

export default function OrderBookList({
  tokenA,
  tokenB,
  buckets,
  bucketResolution,
  priceIndication,
  setPriceOffset,
  setBucketOffsets,
}: {
  tokenA: Token;
  tokenB: Token;
  priceIndication?: number | undefined;
  buckets?: Buckets;
  bucketResolution: number;
  setPriceOffset?: React.Dispatch<
    React.SetStateAction<PriceOffset | undefined>
  >;
  setBucketOffsets?: React.Dispatch<React.SetStateAction<BucketOffset[][]>>;
}) {
  const onHighlightPrice = useCallback(
    (includeElementHeight: boolean) =>
      (
        e: React.MouseEvent<HTMLTableRowElement, MouseEvent>,
        bucketPrice: number | undefined
      ) => {
        const row = e.target as HTMLTableRowElement | null;
        const addOffset = (el: HTMLElement): number => {
          if (el.tagName === 'TBODY') return 0;
          return (
            el.offsetTop +
            (['TABLE', 'TD'].includes(el.tagName) && el.offsetParent
              ? addOffset(el.offsetParent as HTMLElement)
              : 0)
          );
        };
        setPriceOffset?.(
          row && bucketPrice
            ? [
                bucketPrice,
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

  const [, currentPrice] = useRealtimeDisplayPrice(tokenA, tokenB);

  // ensure that a certain amount of liquidity rows are shown in the card
  const [shownTickRows, setShownTickRows] = useState<number>(8);
  const spacingTicks = useMemo(
    () => Array.from({ length: shownTickRows }).map(() => undefined),
    [shownTickRows]
  );

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
  }, [currentPrice, buckets]);

  const [bucketsA, bucketsB] = buckets || [];
  const [topBuckets, bottomBuckets] = useMemo(() => {
    return [
      [...(bucketsB ?? []), ...spacingTicks].slice(0, shownTickRows).reverse(),
      [...(bucketsA ?? []), ...spacingTicks].slice(0, shownTickRows),
    ];
  }, [bucketsA, bucketsB, shownTickRows, spacingTicks]);

  // find how numbers should be displayed
  const priceDecimalPlaces = useMemo(() => {
    const decimals = bucketResolution.toFixed(18).split('.')[1] || '';
    return decimals.replace(/0+$/, '').length;
  }, [bucketResolution]);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const getTableSections = useCallback((table: HTMLDivElement) => {
    const sections = {
      header: table.querySelectorAll('thead').item(0),
      spacer: table.querySelectorAll('tbody').item(0),
      top: table.querySelectorAll('tbody').item(1),
      center: table.querySelectorAll('tbody').item(2),
      bottom: table.querySelectorAll('tbody').item(3),
    };
    if (sections.header && sections.top && sections.center && sections.bottom) {
      return sections;
    }
  }, []);
  const calculateRows = useCallback(() => {
    const table = tableContainerRef.current;
    const sections = table && getTableSections(table);
    if (table && sections) {
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
        (sections.top.childElementCount + sections.bottom.childElementCount);
      // determine how many rows we could add to the table
      const maxRowCount = tableRowHeight
        ? Math.floor(tableHeightForRows / tableRowHeight / 2)
        : 1;
      setShownTickRows(maxRowCount);
    }
  }, [getTableSections]);

  // execute on every layout update
  useResizeObserver(tableContainerRef, calculateRows);
  useLayoutEffect(calculateRows);

  // calculate measurements to send back to parent
  const updateBucketOffsets = useCallback(() => {
    const table = tableContainerRef.current;
    const sections = table && getTableSections(table);
    const tableRowHeight =
      sections &&
      (sections.top.offsetHeight + sections.bottom.offsetHeight) /
        (sections.top.childElementCount + sections.bottom.childElementCount ||
          1);
    if (tableRowHeight && tableRowHeight > 0 && currentPrice && buckets) {
      // set bucket offsets
      // measure center bucket
      const addOffset = (el: HTMLElement): number => {
        // if (el.tagName === 'TBODY') return 0;
        return (
          el.offsetTop +
          (['TABLE', 'TBODY'].includes(el.tagName) && el.offsetParent
            ? addOffset(el.offsetParent as HTMLElement)
            : 0)
        );
      };
      const centerOffset = addOffset(sections.center);
      const topCenterOffset = centerOffset;
      const bottomCenterOffset = centerOffset + sections.center.offsetHeight;

      // calculate offsets for all buckets
      const [bucketsA = [], bucketsB = []] = buckets || [];
      setBucketOffsets?.([
        [
          // add current price bucket
          [
            [currentPrice, topCenterOffset],
            [currentPrice, bottomCenterOffset],
          ],
          // add token A bucket offsets
          ...bucketsA.map(
            ([lowerBound, upperBound], index): [PriceOffset, PriceOffset] => [
              [upperBound, bottomCenterOffset + index * tableRowHeight],
              [lowerBound, bottomCenterOffset + (index + 1) * tableRowHeight],
            ]
          ),
        ],
        [
          // add current price bucket
          [
            [currentPrice, bottomCenterOffset],
            [currentPrice, topCenterOffset],
          ],
          // add token B bucket offsets
          ...bucketsB.map(
            ([lowerBound, upperBound], index): [PriceOffset, PriceOffset] => [
              [lowerBound, topCenterOffset - index * tableRowHeight],
              [upperBound, topCenterOffset - (index + 1) * tableRowHeight],
            ]
          ),
        ],
      ]);
    } else {
      // unset bucket offsets
      setBucketOffsets?.((offsets) => (offsets.length ? [] : offsets));
    }
  }, [buckets, currentPrice, getTableSections, setBucketOffsets]);
  // execute on every relevent update
  useResizeObserver(tableContainerRef, updateBucketOffsets);
  useEffect(updateBucketOffsets, [updateBucketOffsets]);

  return (
    <div className="flex-centered orderbook-list flex" ref={tableContainerRef}>
      <table className="orderbook-list__table">
        <colgroup>
          {/* minimize the first column width */}
          <col width="1" />
          <col width="*" />
          <col width="*" />
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
          {topBuckets?.map((bucket, index) => {
            const price = bucket?.[1];
            return price && bucket ? (
              <OrderbookListRow
                key={price}
                price={price}
                bucket={bucket}
                token={tokenB}
                priceDecimalPlaces={priceDecimalPlaces}
                active={price && priceIndication && price <= priceIndication}
                onHighlight={onHighlightHighPrice}
              />
            ) : (
              <EmptyRow key={price ?? `index-${index}`} />
            );
          })}
        </tbody>
        <tbody className="orderbook-list__table__tick-center">
          <tr
            onMouseEnter={() =>
              setPriceOffset?.(currentPrice ? [currentPrice] : undefined)
            }
            onMouseLeave={() => setPriceOffset?.(undefined)}
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
          {bottomBuckets?.map((bucket, index) => {
            const price = bucket?.[0];
            return price && bucket ? (
              <OrderbookListRow
                key={price}
                price={price}
                bucket={bucket}
                token={tokenA}
                priceDecimalPlaces={priceDecimalPlaces}
                active={price && priceIndication && price >= priceIndication}
                onHighlight={onHighlightLowPrice}
              />
            ) : (
              <EmptyRow key={price ?? `index-${index}`} />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmptyRow() {
  return (
    <tr>
      <td colSpan={2}>&nbsp;</td>
    </tr>
  );
}

function OrderbookListRow({
  price: bucketPrice,
  bucket: [_lowerBound, _upperBound, reserves],
  token,
  priceDecimalPlaces = 6,
  amountDecimalPlaces = 2,
  active,
  onHighlight,
}: {
  price: number;
  bucket: Bucket;
  token: Token;
  priceDecimalPlaces?: number;
  amountDecimalPlaces?: number;
  active?: boolean | 0;
  onHighlight?: (
    e: React.MouseEvent<HTMLTableRowElement, MouseEvent>,
    bucketPrice: number | undefined
  ) => void;
}) {
  const { data: price } = useSimplePrice(token);

  // keep track of hover state and use as a price indication in parents
  const [hovered, setHovered] = useState<boolean>(false);
  const onHover = useCallback(
    (
      e: React.MouseEvent<HTMLTableRowElement, MouseEvent>,
      bucketPrice: number | undefined
    ) => {
      // set hovered state
      setHovered(!!bucketPrice);
      // set parent state
      onHighlight?.(e, bucketPrice);
    },
    [onHighlight]
  );
  const onHoverIn = useCallback<React.MouseEventHandler<HTMLTableRowElement>>(
    (e) => onHover(e, bucketPrice),
    [onHover, bucketPrice]
  );
  const onHoverOut = useCallback<React.MouseEventHandler<HTMLTableRowElement>>(
    (e) => onHover(e, undefined),
    [onHover]
  );

  const value = reserves * (price || 0);
  return (
    <tr
      key={bucketPrice}
      className={[active && 'active', hovered && 'hovered']
        .filter(Boolean)
        .join(' ')}
      onMouseEnter={onHoverIn}
      onMouseLeave={onHoverOut}
    >
      <DiffCell className="text-right">
        {formatAmount(bucketPrice, {
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
