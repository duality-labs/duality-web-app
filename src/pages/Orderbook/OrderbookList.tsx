import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import useResizeObserver from '@react-hook/resize-observer';

import SelectInput from '../../components/inputs/SelectInput';
import { useRealtimeDisplayPrice } from '../../components/stats/hooks';
import { formatAmount, getOrderOfMagnitude } from '../../lib/utils/number';
import { useSimplePrice } from '../../lib/tokenPrices';
import { Token } from '../../lib/web3/utils/tokens';
import { matchTokens } from '../../lib/web3/hooks/useTokens';

import type { PriceOffset, BucketOffset } from './Orderbook';
import type { Bucket, Buckets } from './useBuckets';

import './OrderbookList.scss';

export default function OrderBookList({
  tokenA,
  tokenB,
  buckets,
  bucketResolution,
  setBucketResolution,
  priceIndication,
  setPriceIndication,
  setBucketOffsets,
  setLimitPrice,
  showIndividualBuckets,
  showCumulativeBuckets,
  setShowIndividualBuckets,
  setShowCumulativeBuckets,
}: {
  tokenA: Token;
  tokenB: Token;
  priceIndication?: number | undefined;
  buckets?: Buckets;
  bucketResolution: number | undefined;
  setBucketResolution: React.Dispatch<React.SetStateAction<number | undefined>>;
  setPriceIndication?: React.Dispatch<React.SetStateAction<number | undefined>>;
  setBucketOffsets?: React.Dispatch<React.SetStateAction<BucketOffset[][]>>;
  setLimitPrice?: (limitPrice: string) => void;
  showIndividualBuckets: boolean;
  showCumulativeBuckets: boolean;
  setShowIndividualBuckets: React.Dispatch<React.SetStateAction<boolean>>;
  setShowCumulativeBuckets: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  // improve toggling behaviour to behave like a 3 option state
  const toggleShowIndividualBuckets = useCallback(() => {
    setShowIndividualBuckets((show) => !show);
    setShowCumulativeBuckets(false);
  }, [setShowCumulativeBuckets, setShowIndividualBuckets]);
  const toggleShowCumulativeBuckets = useCallback(() => {
    setShowCumulativeBuckets((show) => !show);
    setShowIndividualBuckets(false);
  }, [setShowCumulativeBuckets, setShowIndividualBuckets]);

  const onHighlightPrice = useCallback(
    (bucketPrice: number | undefined) => {
      setPriceIndication?.(bucketPrice);
    },
    [setPriceIndication]
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
  const priceDecimalPlaces = useMemo<number | undefined>(() => {
    // use same decimal places as the bucket resolution
    return (
      bucketResolution &&
      Math.max(0, -Math.round(getOrderOfMagnitude(bucketResolution)))
    );
  }, [bucketResolution]);
  const [amountDecimalPlacesA, amountDecimalPlacesB] = useMemo(() => {
    // ensure minimum displayed amount has at least 2 significant digits
    return [
      Math.max(0, 1 - getOrderOfMagnitude(getMinimumReserves(bucketsA))),
      Math.max(0, 1 - getOrderOfMagnitude(getMinimumReserves(bucketsB))),
    ];
    function getMinimumReserves(buckets: Bucket[] | undefined) {
      const bucketReserves = buckets?.slice(0, shownTickRows).map((b) => b[2]);
      return bucketReserves ? Math.min(...bucketReserves) : 1;
    }
  }, [bucketsA, bucketsB, shownTickRows]);

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
      const topCenterOffset = centerOffset + 1;
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
          ...bucketsA
            .slice(0, shownTickRows)
            .map(
              ([innerBound, outerBound], index): [PriceOffset, PriceOffset] => [
                [innerBound, bottomCenterOffset + index * tableRowHeight],
                [outerBound, bottomCenterOffset + (index + 1) * tableRowHeight],
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
          ...bucketsB
            .slice(0, shownTickRows)
            .map(
              ([innerBound, outerBound], index): [PriceOffset, PriceOffset] => [
                [innerBound, topCenterOffset - index * tableRowHeight],
                [outerBound, topCenterOffset - (index + 1) * tableRowHeight],
              ]
            ),
        ],
      ]);
    } else {
      // unset bucket offsets
      setBucketOffsets?.((offsets) => (offsets.length ? [] : offsets));
    }
  }, [
    buckets,
    currentPrice,
    getTableSections,
    setBucketOffsets,
    shownTickRows,
  ]);
  // execute on every relevent update
  useResizeObserver(tableContainerRef, updateBucketOffsets);
  useEffect(updateBucketOffsets, [updateBucketOffsets]);

  // get price information
  const {
    data: [priceTokenA, priceTokenB],
  } = useSimplePrice([tokenA, tokenB]);
  const maxReservesWeight = useMemo<number>(() => {
    const [bucketsA = [], bucketsB = []] = buckets || [];
    // find the maximum reserve equivalent value for displaying "USD" value
    // note: but we use current Dex price so we don't need to wait for price API
    return currentPrice && (bucketsA.length || bucketsB.length) > 0
      ? Math.max(
          getMaximumDisplayedReserves(bucketsA),
          getMaximumDisplayedReserves(bucketsB) * currentPrice
        )
      : Number.POSITIVE_INFINITY;
    function getMaximumDisplayedReserves(buckets: Bucket[] | undefined) {
      const bucketReserves = buckets?.slice(0, shownTickRows).map((b) => b[2]);
      return bucketReserves ? Math.max(...bucketReserves) : 0;
    }
  }, [buckets, currentPrice, shownTickRows]);

  const activeBuckets = useMemo(() => {
    if (currentPrice && priceIndication && currentPrice !== priceIndication) {
      return priceIndication > currentPrice
        ? bucketsB?.filter(([innerBound]) => priceIndication > innerBound)
        : bucketsA?.filter(([innerBound]) => priceIndication < innerBound);
    }
  }, [bucketsA, bucketsB, currentPrice, priceIndication]);

  const orderbookDepth = (
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
            <th className="text-medium text-muted text-right">Value (USD)</th>
          </tr>
        </thead>
        <tbody className="orderbook-list__table__gap">
          <tr>
            <td className="table-body-spacer"></td>
          </tr>
        </tbody>
        <tbody className="orderbook-list__table__ticks-top">
          {topBuckets?.map((bucket, index) => {
            const [minPrice, price, reserves] = bucket || [];
            const lastBucket = bucketsB?.at(-1);
            return minPrice && price && reserves && lastBucket ? (
              <OrderbookListRow
                key={price}
                price={price}
                reserves={reserves}
                reserveValueUSD={priceTokenB && reserves * priceTokenB}
                weight={(reserves * (currentPrice ?? 0)) / maxReservesWeight}
                priceDecimalPlaces={priceDecimalPlaces}
                amountDecimalPlaces={amountDecimalPlacesB}
                variant="error"
                active={bucket && activeBuckets?.includes(bucket)}
                hovered={
                  bucket &&
                  priceIndication &&
                  activeBuckets?.at(-1) === bucket &&
                  priceIndication <= lastBucket[1]
                }
                onHighlight={onHighlightPrice}
                onClick={(bucketPrice) => {
                  setLimitPrice?.(
                    formatAmount(bucketPrice, {
                      minimumFractionDigits: priceDecimalPlaces,
                      maximumFractionDigits: priceDecimalPlaces,
                    })
                  );
                }}
              />
            ) : (
              <EmptyRow key={price ?? `index-${index}`} />
            );
          })}
        </tbody>
        <tbody
          className={[
            'orderbook-list__table__tick-center',
            currentPrice === priceIndication && 'active',
            // if price indication is in the first bucket
            currentPrice &&
              priceIndication &&
              bucketsB?.[0] &&
              currentPrice < priceIndication &&
              priceIndication <= bucketsB[0][0] &&
              'active active-top',
            currentPrice &&
              priceIndication &&
              bucketsA?.[0] &&
              currentPrice > priceIndication &&
              priceIndication >= bucketsA[0][0] &&
              'active active-bottom',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <tr
            onMouseEnter={() => setPriceIndication?.(currentPrice ?? undefined)}
            onMouseLeave={() => setPriceIndication?.(undefined)}
            onClick={() => setLimitPrice?.('')}
          >
            <DiffCell
              colSpan={3}
              className="text-center py-3 px-1 nowrap"
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
            const [maxPrice, price, reserves] = bucket || [];
            const lastBucket = bucketsA?.at(-1);
            return maxPrice && price && reserves && lastBucket ? (
              <OrderbookListRow
                key={price}
                price={price}
                reserves={reserves}
                reserveValueUSD={priceTokenA && reserves * priceTokenA}
                weight={reserves / maxReservesWeight}
                priceDecimalPlaces={priceDecimalPlaces}
                amountDecimalPlaces={amountDecimalPlacesA}
                variant="success"
                active={bucket && activeBuckets?.includes(bucket)}
                hovered={
                  bucket &&
                  priceIndication &&
                  activeBuckets?.at(-1) === bucket &&
                  priceIndication >= lastBucket[1]
                }
                onHighlight={onHighlightPrice}
                onClick={(bucketPrice) => {
                  setLimitPrice?.(
                    formatAmount(bucketPrice, {
                      minimumFractionDigits: priceDecimalPlaces,
                      maximumFractionDigits: priceDecimalPlaces,
                    })
                  );
                }}
              />
            ) : (
              <EmptyRow key={price ?? `index-${index}`} />
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const [firstResolvedPrice, setFirstResolvedPrice] =
    useState<[price: number, tokenA: Token, tokenB: Token]>();
  useEffect(() => {
    if (currentPrice) {
      const [savedPrice, savedTokenA, savedTokenB] = firstResolvedPrice || [];
      // if price is not set or the tokens changed then set new price
      if (
        !savedPrice ||
        !matchTokens(savedTokenA, tokenA) ||
        !matchTokens(savedTokenB, tokenB)
      ) {
        // save this price context for next comparison
        setFirstResolvedPrice([currentPrice ?? undefined, tokenA, tokenB]);
        // set new bucket resolution
        if (currentPrice) {
          // start at ~1% increments
          const bucketResolution = getBucketResolutions(currentPrice)[2];
          setBucketResolution(bucketResolution);
        }
      }
    } else {
      setFirstResolvedPrice(undefined);
    }
  }, [currentPrice, firstResolvedPrice, setBucketResolution, tokenA, tokenB]);

  const bucketResolutions = useMemo(() => {
    return getBucketResolutions(currentPrice);
  }, [currentPrice]);

  return (
    <>
      <div className="orderbook-list__toolbar row p-1 gapx-1">
        <div className="connection-controls row gapx-1">
          <button
            className={['button', showIndividualBuckets && 'active']
              .filter(Boolean)
              .join(' ')}
            title="Bucket Depth"
            onClick={toggleShowIndividualBuckets}
          >
            <div className="button-box bg-red" style={styles.boxWidth1}></div>
            <div className="button-box bg-red" style={styles.boxWidth2}></div>
            <div className="button-box bg-red" style={styles.boxWidth3}></div>
            <div className="button-box bg-green" style={styles.boxWidth3}></div>
            <div className="button-box bg-green" style={styles.boxWidth2}></div>
            <div className="button-box bg-green" style={styles.boxWidth1}></div>
          </button>
          <button
            className={['button', showCumulativeBuckets && 'active']
              .filter(Boolean)
              .join(' ')}
            title="Cumulative Depth"
            onClick={toggleShowCumulativeBuckets}
          >
            <div className="button-box bg-red" style={styles.boxWidth5}></div>
            <div className="button-box bg-red" style={styles.boxWidth4}></div>
            <div className="button-box bg-red" style={styles.boxWidth2}></div>
            <div className="button-box bg-green" style={styles.boxWidth2}></div>
            <div className="button-box bg-green" style={styles.boxWidth4}></div>
            <div className="button-box bg-green" style={styles.boxWidth5}></div>
          </button>
        </div>
        <div
          className="col ml-auto gutter-b-3"
          style={{
            minWidth: `${
              Math.max(
                ...bucketResolutions.map((resolution) =>
                  Math.abs(getOrderOfMagnitude(resolution))
                )
              ) + 2
            }em`,
          }}
        >
          <div className="row flex">
            <SelectInput<number>
              className="focusable col flex my-0 p-0"
              list={bucketResolutions}
              value={bucketResolution}
              getLabel={(value) => value}
              onChange={setBucketResolution}
              floating
            />
          </div>
        </div>
      </div>
      {orderbookDepth}
    </>
  );
}

const styles = {
  boxWidth1: {
    width: '0.2em',
  },
  boxWidth2: {
    width: '0.45em',
  },
  boxWidth3: {
    width: '0.6em',
  },
  boxWidth4: {
    width: '0.6em',
  },
  boxWidth5: {
    width: '0.8em',
  },
};

function getBucketResolutions(currentPrice?: number | null): number[] {
  const startingOrderOfMagnitude = currentPrice
    ? getOrderOfMagnitude(currentPrice)
    : 0;
  return Array.from({ length: 4 }).map((_, index) => {
    return Math.pow(10, startingOrderOfMagnitude) / Math.pow(10, index);
  });
}

function EmptyRow() {
  return (
    <tr>
      <td colSpan={3}>&nbsp;</td>
    </tr>
  );
}

function OrderbookListRow({
  price: bucketPrice,
  reserves,
  reserveValueUSD,
  weight,
  priceDecimalPlaces = 6,
  amountDecimalPlaces = 2,
  variant,
  active,
  hovered,
  onHighlight,
  onClick,
}: {
  price: number;
  reserves: number;
  reserveValueUSD?: number;
  weight?: number;
  priceDecimalPlaces?: number;
  amountDecimalPlaces?: number;
  variant?: 'success' | 'error';
  active?: boolean | 0;
  hovered?: boolean | 0;
  onHighlight?: (bucketPrice: number | undefined) => void;
  onClick?: (bucketPrice: number) => void;
}) {
  // keep track of hover state and use as a price indication in parents
  const onHover = useCallback(
    (bucketPrice: number | undefined) => {
      // set parent state
      onHighlight?.(bucketPrice);
    },
    [onHighlight]
  );
  const onHoverIn = useCallback<React.MouseEventHandler<HTMLTableRowElement>>(
    () => onHover(bucketPrice),
    [onHover, bucketPrice]
  );
  const onHoverOut = useCallback<React.MouseEventHandler<HTMLTableRowElement>>(
    () => onHover(undefined),
    [onHover]
  );

  return (
    <tr
      key={bucketPrice}
      className={[active && 'active', hovered && 'hovered']
        .filter(Boolean)
        .join(' ')}
      onMouseEnter={onHoverIn}
      onMouseLeave={onHoverOut}
      onClick={() => onClick?.(bucketPrice)}
    >
      <DiffCell
        className={['text-right', variant && `text-${variant}`]
          .filter(Boolean)
          .join(' ')}
      >
        {formatAmount(bucketPrice, {
          minimumFractionDigits: priceDecimalPlaces,
          maximumFractionDigits: priceDecimalPlaces,
        })}
      </DiffCell>
      <td className="text-right text-muted">
        {formatAmount(reserves ?? '...', {
          minimumFractionDigits: amountDecimalPlaces,
          maximumFractionDigits: amountDecimalPlaces,
        })}
      </td>
      <td className="text-right text-muted relative">
        <div
          className="cell-background-gradient absolute filled"
          style={{ width: weight && `${Math.round(weight * 100)}%` }}
        ></div>
        <div className="relative">
          {formatAmount(reserveValueUSD ?? '...', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
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
