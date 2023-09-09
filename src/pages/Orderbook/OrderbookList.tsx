import { useMemo } from 'react';
import BigNumber from 'bignumber.js';

import { useCurrentPriceFromTicks } from '../../components/Liquidity/useCurrentPriceFromTicks';
import { formatAmount } from '../../lib/utils/number';
import { useTokenPairTickLiquidity } from '../../lib/web3/hooks/useTickLiquidity';
import { useOrderedTokenPair } from '../../lib/web3/hooks/useTokenPairs';
import { Token, getAmountInDenom } from '../../lib/web3/utils/tokens';
import { TickInfo } from '../../lib/web3/utils/ticks';

import './OrderbookList.scss';

// ensure that a certain amount of liquidity rows are shown in the card
const shownTickRows = 8;
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

  // works with shortened length and correct sort order ticks for this component
  const tokenATicks = useMemo<Array<TickInfo | undefined>>(() => {
    const tokenATicks = forward ? token0Ticks : token1Ticks;
    return [...tokenATicks, ...spacingTicks].slice(0, shownTickRows).reverse();
  }, [forward, token0Ticks, token1Ticks]);
  const tokenBTicks = useMemo<Array<TickInfo | undefined>>(() => {
    const tokenBTicks = reverse ? token0Ticks : token1Ticks;
    return [...tokenBTicks, ...spacingTicks].slice(0, shownTickRows);
  }, [reverse, token0Ticks, token1Ticks]);

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

  const currentPrice = useCurrentPriceFromTicks(tokenA.address, tokenB.address);
  const previousPrice = useMemo<BigNumber | undefined>(() => {
    // todo: replace with block height tracking and previous block height ticks
    const randomAdjustment = Math.round(Math.random() * 3 - 1.5);
    return currentPrice?.plus(randomAdjustment);
  }, [currentPrice]);

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
  amountDecimalPlaces = 3,
}: {
  tick: TickInfo | undefined;
  previousTicks: TickInfo[];
  token: Token;
  reserveKey: 'reserve0' | 'reserve1';
  priceDecimalPlaces?: number;
  amountDecimalPlaces?: number;
}) {
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
  return (
    <tr key={tick.tickIndex1To0.toNumber()}>
      <DiffCell className="text-right" diff={diff.toNumber()}>
        {formatAmount(tick.price1To0.toNumber(), {
          maximumSignificantDigits: undefined,
          maximumFractionDigits: priceDecimalPlaces,
          minimumFractionDigits: priceDecimalPlaces,
        })}
      </DiffCell>
      <td className="text-right text-muted">
        {formatAmount(
          getAmountInDenom(
            token,
            tick[reserveKey],
            token.address,
            token.display
          ) || '',
          {
            maximumSignificantDigits: undefined,
            maximumFractionDigits: amountDecimalPlaces,
            minimumFractionDigits: amountDecimalPlaces,
          }
        )}
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
