import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BigNumber from 'bignumber.js';

import { useCurrentPriceFromTicks } from '../../components/Liquidity/useCurrentPriceFromTicks';
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

import './OrderbookList.scss';

// ensure that a certain amount of liquidity rows are shown in the card
const shownTickRows = 10;
const spacingTicks = Array.from({ length: shownTickRows }).map(() => undefined);

export default function OrderBookList({
  tokenA,
  tokenB,
}: {
  tokenA: Token;
  tokenB: Token;
}) {
  const [tokenIdA, tokenIdB] = [getTokenId(tokenA), getTokenId(tokenB)];
  const [tokenId0, tokenId1] = useOrderedTokenPair([tokenIdA, tokenIdB]) || [];
  const {
    data: [token0Ticks = [], token1Ticks = []],
  } = useTokenPairTickLiquidity([tokenId0, tokenId1]);

  const [forward, reverse] = [
    tokenId0 === tokenIdA && tokenId1 === tokenIdB,
    tokenId1 === tokenIdA && tokenId0 === tokenIdB,
  ];

  const currentPrice = useCurrentPriceFromTicks(tokenIdA, tokenIdB);
  const resolutionPercent = 0.01; // size of price steps

  // todo: this needs fixes, the comparison between prices is off because it
  //       sometimes compares price1To0 and priceBToA
  //       it would greatly benefit from useTokenPairTickLiquidity returning
  //       price and tickIndexes in BtoA form
  const getTickBuckets = useCallback(
    (forward: boolean) => {
      const resolutionOrderOfMagnitude = getOrderOfMagnitude(resolutionPercent);
      const step =
        currentPrice &&
        Math.pow(
          10,
          getOrderOfMagnitude(currentPrice.toNumber()) +
            resolutionOrderOfMagnitude
        );

      const ticks = forward ? token0Ticks : token1Ticks;
      const precision = 1 - resolutionOrderOfMagnitude;
      const tickBucketLimits = Array.from({ length: shownTickRows }).flatMap(
        (_, index) =>
          currentPrice && step
            ? forward
              ? Number(
                  currentPrice
                    .minus(index * step)
                    .toPrecision(precision, BigNumber.ROUND_FLOOR)
                )
              : Number(
                  currentPrice
                    .plus(index * step)
                    .toPrecision(precision, BigNumber.ROUND_CEIL)
                )
            : []
      );
      const limit = forward
        ? Math.min(...tickBucketLimits)
        : Math.max(...tickBucketLimits);

      const groupedTicks = ticks.reduce<{
        [roundedPrice: string]: number;
      }>((acc, tick) => {
        // add if price is within bounds
        if (
          step &&
          currentPrice &&
          (forward
            ? tick.price1To0.isGreaterThanOrEqualTo(limit)
            : tick.price1To0.isLessThanOrEqualTo(limit))
        ) {
          const roundedPrice = Number(
            tick.price1To0.toPrecision(
              precision,
              forward ? BigNumber.ROUND_FLOOR : BigNumber.ROUND_CEIL
            )
          );
          acc[roundedPrice] = acc[roundedPrice] || 0;
          acc[roundedPrice] += (
            forward ? tick.reserve0 : tick.reserve1
          ).toNumber();
        }
        return acc;
      }, {});

      // create TickInfo replacements for bucketed data
      const fakeTicks = tickBucketLimits.map((key): TickInfo => {
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

      return [...fakeTicks, ...spacingTicks].slice(0, shownTickRows);
    },
    [currentPrice, token0Ticks, token1Ticks, tokenA, tokenB]
  );

  // get tokenA as the top ascending from current price list
  const tokenATicks = useMemo<Array<TickInfo | undefined>>(() => {
    return getTickBuckets(!!forward).reverse();
  }, [forward, getTickBuckets]);
  const tokenBTicks = useMemo<Array<TickInfo | undefined>>(() => {
    return getTickBuckets(!forward);
  }, [forward, getTickBuckets]);

  const [previousTokenATicks, setPrevTokenATicks] = useState<Array<TickInfo>>(
    []
  );
  const lastTokenATicks = useRef<Array<TickInfo | undefined>>();
  useEffect(() => {
    if (
      !lastTokenATicks.current ||
      JSON.stringify(tokenATicks) !== JSON.stringify(lastTokenATicks.current)
    ) {
      // set old data
      if (lastTokenATicks.current) {
        // and remove undefined ticks from list
        setPrevTokenATicks(
          lastTokenATicks.current.filter((tick): tick is TickInfo => !!tick)
        );
      }
      // set new data
      lastTokenATicks.current = tokenATicks;
    }
  }, [tokenATicks]);

  const [previousTokenBTicks, setPrevTokenBTicks] = useState<Array<TickInfo>>(
    []
  );
  const lastTokenBTicks = useRef<Array<TickInfo | undefined>>();
  useEffect(() => {
    if (
      !lastTokenBTicks.current ||
      JSON.stringify(tokenATicks) !== JSON.stringify(lastTokenBTicks.current)
    ) {
      // set old data
      if (lastTokenBTicks.current) {
        // and remove undefined ticks from list
        setPrevTokenBTicks(
          lastTokenBTicks.current.filter((tick): tick is TickInfo => !!tick)
        );
      }
      // set new data
      lastTokenBTicks.current = tokenATicks;
    }
  }, [tokenATicks]);

  const [previousPrice, setPreviousPrice] = useState<BigNumber | undefined>();
  const lastPrice = useRef<BigNumber | undefined>(currentPrice);
  useEffect(() => {
    if (
      currentPrice &&
      (!lastPrice.current || !lastPrice.current.isEqualTo(currentPrice))
    ) {
      // set old data
      if (lastPrice.current) {
        // and remove undefined ticks from list
        setPreviousPrice(lastPrice.current);
      }
      // set new data
      lastPrice.current = currentPrice;
    }
  }, [currentPrice, tokenATicks]);

  const priceDecimalPlaces =
    currentPrice !== undefined
      ? getDecimalPlaces(
          currentPrice.toNumber(),
          1 - getOrderOfMagnitude(resolutionPercent)
        )
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
          </tr>
        </thead>
        <tbody className="orderbook-list__table__ticks-a">
          {tokenATicks.map((tick, index) => {
            return (
              <OrderbookListRow
                key={index}
                tick={tick}
                previousTicks={previousTokenATicks}
                token={tokenA}
                reserveKey={forward ? 'reserve0' : 'reserve1'}
                priceDecimalPlaces={priceDecimalPlaces}
              />
            );
          })}
        </tbody>
        <tbody className="orderbook-list__table__tick-center">
          <tr>
            <DiffCell
              colSpan={2}
              className="text-center py-3"
              diff={
                previousPrice && currentPrice?.minus(previousPrice).toNumber()
              }
            >
              {currentPrice
                ? `${formatAmount(currentPrice.toNumber())} ${tokenA.symbol}/${
                    tokenB.symbol
                  }`
                : '-'}
            </DiffCell>
          </tr>
        </tbody>
        <tbody className="orderbook-list__table__ticks-b">
          {tokenBTicks.map((tick, index) => {
            return (
              <OrderbookListRow
                key={index}
                tick={tick}
                previousTicks={previousTokenBTicks}
                token={tokenB}
                reserveKey={reverse ? 'reserve0' : 'reserve1'}
                priceDecimalPlaces={priceDecimalPlaces}
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
  previousTicks,
  token,
  reserveKey,
  priceDecimalPlaces = 6,
  amountDecimalPlaces = 2,
}: {
  tick: TickInfo | undefined;
  previousTicks: TickInfo[];
  token: Token;
  reserveKey: 'reserve0' | 'reserve1';
  priceDecimalPlaces?: number;
  amountDecimalPlaces?: number;
}) {
  const { data: price } = useSimplePrice(token);
  // add empty row
  if (!tick) {
    return (
      <tr>
        <td colSpan={2}>&nbsp;</td>
      </tr>
    );
  }
  // add tick row
  const previousTokenATick = previousTicks.find((prev) => {
    return prev.tickIndex1To0 === tick.tickIndex1To0;
  });
  const diff = previousTokenATick
    ? tick[reserveKey].minus(previousTokenATick[reserveKey])
    : new BigNumber(0);

  const value = getTokenValue(token, tick[reserveKey], price);
  return (
    <tr key={tick.tickIndex1To0.toNumber()}>
      <DiffCell className="text-right" diff={diff.toNumber()}>
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
