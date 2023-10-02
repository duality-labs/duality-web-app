import { useCallback, useMemo } from 'react';
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
import { Token, getTokenValue } from '../../lib/web3/utils/tokens';
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
  const [token0Address, token1Address] =
    useOrderedTokenPair([tokenA.address, tokenB.address]) || [];
  const {
    data: [token0Ticks = [], token1Ticks = []],
  } = useTokenPairTickLiquidity([token0Address, token1Address]);

  const [forward, reverse] = [
    token0Address === tokenA.address && token1Address === tokenB.address,
    token1Address === tokenA.address && token0Address === tokenB.address,
  ];

  const currentPrice = useCurrentPriceFromTicks(tokenA.address, tokenB.address);
  const resolutionPercent = 0.01; // size of price steps

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

      const tokenATicks = forward ? token0Ticks : token1Ticks;
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

      const groupedTokenATicks = tokenATicks.reduce<{
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
          reserve0: new BigNumber(forward ? groupedTokenATicks[key] || 0 : 0),
          reserve1: new BigNumber(forward ? 0 : groupedTokenATicks[key] || 0),
        };
      });

      return [...fakeTicks, ...spacingTicks].slice(0, shownTickRows).reverse();
    },
    [currentPrice, token0Ticks, token1Ticks, tokenA, tokenB]
  );

  // works with shortened length and correct sort order ticks for this component
  const tokenATicks = useMemo<Array<TickInfo | undefined>>(() => {
    return getTickBuckets(!!forward);
  }, [forward, getTickBuckets]);
  const tokenBTicks = useMemo<Array<TickInfo | undefined>>(() => {
    return getTickBuckets(!forward);
  }, [forward, getTickBuckets]);

  // keep the state of the previously seen ticks
  const previousTokenATicks = useMemo<TickInfo[]>(() => {
    // todo: replace with block height tracking and previous block height ticks
    return tokenATicks
      .filter((tick): tick is TickInfo => !!tick)
      .map((tick) => {
        const randomAdjustment = Math.round(Math.random() * 3 - 1.5);
        return {
          ...tick,
          // add -10% or 0% or 10% of reserves
          ...(forward
            ? {
                reserve0: tick.reserve0.plus(
                  tick.reserve0.div(10).times(randomAdjustment)
                ),
              }
            : {
                reserve1: tick.reserve1.plus(
                  tick.reserve1.div(10).times(randomAdjustment)
                ),
              }),
        };
      });
  }, [tokenATicks, forward]);
  const previousTokenBTicks = useMemo<TickInfo[]>(() => {
    // todo: replace with block height tracking and previous block height ticks
    return tokenBTicks
      .filter((tick): tick is TickInfo => !!tick)
      .map((tick) => {
        const randomAdjustment = Math.round(Math.random() * 3 - 1.5);
        return {
          ...tick,
          // add -10% or 0% or 10% of reserves
          ...(reverse
            ? {
                reserve0: tick.reserve0.plus(
                  tick.reserve0.div(10).times(randomAdjustment)
                ),
              }
            : {
                reserve1: tick.reserve1.plus(
                  tick.reserve1.div(10).times(randomAdjustment)
                ),
              }),
        };
      });
  }, [tokenBTicks, reverse]);

  const previousPrice = useMemo<BigNumber | undefined>(() => {
    // todo: replace with block height tracking and previous block height ticks
    const randomAdjustment = Math.round(Math.random() * 3 - 1.5);
    return currentPrice?.plus(randomAdjustment);
  }, [currentPrice]);

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
