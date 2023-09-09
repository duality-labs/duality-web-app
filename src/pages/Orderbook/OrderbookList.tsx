import { useMemo } from 'react';
import { useCurrentPriceFromTicks } from '../../components/Liquidity/useCurrentPriceFromTicks';
import { formatAmount, formatLongPrice } from '../../lib/utils/number';
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

  const currentPrice = useCurrentPriceFromTicks(tokenA.address, tokenB.address);

  return (
    <div className="flex-centered orderbook-list">
      <div className="orderbook-list__tabs row pb-2">
        <div className="flex col active">Orderbook</div>
        <div className="flex col">Trades</div>
      </div>
      <table className="orderbook-list__table">
        <thead>
          <tr>
            <th className="text-medium text-muted text-left py-1">Price</th>
            <th className="text-medium text-muted text-right py-1">Amount</th>
          </tr>
        </thead>
        <tbody className="orderbook-list__table__ticks-a">
          {tokenATicks.map((tick, index) => {
            return (
              <OrderbookListRow
                key={index}
                tick={tick}
                token={tokenA}
                reserveKey={forward ? 'reserve0' : 'reserve1'}
              />
            );
          })}
        </tbody>
        <tbody className="orderbook-list__table__tick-center">
          <tr>
            <td colSpan={2} className="text-center py-3">
              {currentPrice
                ? `${formatLongPrice(currentPrice.toNumber())} ${
                    tokenA.symbol
                  }/${tokenB.symbol}`
                : '-'}
            </td>
          </tr>
        </tbody>
        <tbody className="orderbook-list__table__ticks-b">
          {tokenBTicks.map((tick, index) => {
            return (
              <OrderbookListRow
                key={index}
                tick={tick}
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
  token,
  reserveKey,
}: {
  tick: TickInfo | undefined;
  token: Token;
  reserveKey: 'reserve0' | 'reserve1';
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
  return (
    <tr>
      <td className="text-left">
        {formatLongPrice(tick.price1To0.toNumber())}
      </td>
      <td className="text-right text-muted">
        {formatAmount(
          getAmountInDenom(
            token,
            tick[reserveKey],
            token.address,
            token.display
          ) || ''
        )}
      </td>
    </tr>
  );
}
