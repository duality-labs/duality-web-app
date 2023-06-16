import { ReactNode, useMemo } from 'react';
import BigNumber from 'bignumber.js';
import { Tick } from '../../components/LiquiditySelector/LiquiditySelector';

import { formatCurrency } from '../../lib/utils/number';
import { tickIndexToPrice } from '../../lib/web3/utils/ticks';
import { Token, getAmountInDenom } from '../../lib/web3/utils/tokens';

import { EditedPosition } from '../MyLiquidity/useEditLiquidity';
import { guessInvertedOrder } from '../../lib/web3/utils/pairs';
import {
  usePoolDepositFilterForPair,
  useUserPositionsContext,
} from '../../lib/web3/hooks/useUserShares';

import TableCard from '../../components/cards/TableCard';
import { useUserPositionsShareValue } from '../../lib/web3/hooks/useUserShareValues';

function MyPositionTableCard({
  tokenA,
  tokenB,
  header,
  data,
  emptyState,
  actionColumn,
}: {
  tokenA: Token;
  tokenB: Token;
  header?: ReactNode;
  data: ReactNode;
  emptyState?: ReactNode;
  actionColumn?: string;
}) {
  return (
    <TableCard
      className="my-position-table"
      title="My Position"
      headerActions={header}
      scrolling={false}
    >
      <table className="my-position-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th style={{ width: '7.5%' }}>Tick</th>
            <th style={{ width: '20%' }}>Price</th>
            <th style={{ width: '20%' }} colSpan={2}>
              {tokenA.display.toUpperCase()} Amount
            </th>
            <th style={{ width: '20%' }} colSpan={2}>
              {tokenB.display.toUpperCase()} Amount
            </th>
            {actionColumn !== undefined && (
              <th style={{ width: '12.5%' }}>{actionColumn}</th>
            )}
          </tr>
        </thead>
        <tbody>{data || emptyState}</tbody>
      </table>
    </TableCard>
  );
}

export function MyNewPositionTableCard({
  tokenA,
  tokenB,
  userTicks,
}: {
  tokenA: Token;
  tokenB: Token;
  userTicks: Tick[];
}) {
  const [newReserveATotal, newReserveBTotal] = useMemo(() => {
    return [
      userTicks.reduce(
        (acc, tick) => acc.plus(tick.reserveA),
        new BigNumber(0)
      ),
      userTicks.reduce(
        (acc, tick) => acc.plus(tick.reserveB),
        new BigNumber(0)
      ),
    ];
  }, [userTicks]);

  const data = !(newReserveATotal.isZero() && newReserveBTotal.isZero())
    ? userTicks.map((tick, index) => {
        // note: fix these restrictions, they are a bit off
        return (
          <tr key={index} className="pt-2">
            <td>{index + 1}</td>
            <td>{new BigNumber(tick.price.toFixed(5)).toFixed(5)}</td>
            <td>
              {tick.reserveA.isGreaterThan(1e-5)
                ? tick.reserveA.toFixed(3)
                : ''}
            </td>
            <td className="text-left">
              {tick.reserveA.isGreaterThan(1e-5)
                ? `(${
                    newReserveATotal.isGreaterThan(0)
                      ? new BigNumber(
                          tick.reserveA
                            .multipliedBy(100)
                            .dividedBy(newReserveATotal)
                        ).toFixed(1)
                      : 0
                  }%)`
                : ''}
            </td>
            <td>
              {tick.reserveB.isGreaterThan(1e-5)
                ? tick.reserveB.toFixed(3)
                : ''}
            </td>
            <td className="text-left">
              {tick.reserveB.isGreaterThan(1e-5)
                ? `(${
                    newReserveBTotal.isGreaterThan(0)
                      ? new BigNumber(
                          tick.reserveB
                            .multipliedBy(100)
                            .dividedBy(newReserveBTotal)
                        ).toFixed(1)
                      : 0
                  }%)`
                : ''}
            </td>
          </tr>
        );
      })
    : null;

  return (
    <MyPositionTableCard
      tokenA={tokenA}
      tokenB={tokenB}
      data={data}
      emptyState={
        <tr>
          <td colSpan={5} className="p-5" style={{ textAlign: 'center' }}>
            Add tokens to create a new position
          </td>
        </tr>
      }
    />
  );
}

export function MyEditedPositionTableCard({
  tokenA,
  tokenB,
  editedUserPosition,
  setEditedUserPosition,
  viewableMinIndex,
  viewableMaxIndex,
}: {
  tokenA: Token;
  tokenB: Token;
  editedUserPosition: EditedPosition[];
  setEditedUserPosition: React.Dispatch<React.SetStateAction<EditedPosition[]>>;
  viewableMinIndex: number | undefined;
  viewableMaxIndex: number | undefined;
}) {
  const pairPoolDepositFilter = usePoolDepositFilterForPair([tokenA, tokenB]);
  const userPositionsContext = useUserPositionsContext(pairPoolDepositFilter);

  const [userReserveATotal, userReserveBTotal] = useMemo(() => {
    return [
      userPositionsContext?.reduce((acc, { token0Context }) => {
        return acc.plus(token0Context?.userReserves || 0);
      }, new BigNumber(0)),
      userPositionsContext?.reduce((acc, { token1Context }) => {
        return acc.plus(token1Context?.userReserves || 0);
      }, new BigNumber(0)),
    ];
  }, [userPositionsContext]);

  const invertedTokenOrder = guessInvertedOrder(tokenA.address, tokenB.address);

  const totalPairValue = useUserPositionsShareValue(pairPoolDepositFilter);

  const data = editedUserPosition
    ? editedUserPosition
        // sort by price
        .sort((a, b) => {
          return !!invertedTokenOrder
            ? b.deposit.centerTickIndex.toNumber() -
                a.deposit.centerTickIndex.toNumber()
            : a.deposit.centerTickIndex.toNumber() -
                b.deposit.centerTickIndex.toNumber();
        })
        .map(
          (
            { tickDiff0, tickDiff1, deposit, token0Context, token1Context },
            index
          ) => {
            const reserveA = !invertedTokenOrder
              ? tickDiff0.plus(token0Context?.userReserves || 0)
              : tickDiff1.plus(token1Context?.userReserves || 0);
            const reserveB = !invertedTokenOrder
              ? tickDiff1.plus(token1Context?.userReserves || 0)
              : tickDiff0.plus(token0Context?.userReserves || 0);

            const tickIndex = !invertedTokenOrder
              ? new BigNumber(deposit.centerTickIndex.toNumber())
              : new BigNumber(deposit.centerTickIndex.toNumber()).negated();

            const price = tickIndexToPrice(tickIndex.negated());
            // show only those ticks that are in the currently visible range
            return viewableMinIndex !== undefined &&
              viewableMaxIndex !== undefined &&
              tickIndex.isGreaterThanOrEqualTo(viewableMinIndex) &&
              tickIndex.isLessThanOrEqualTo(viewableMaxIndex) ? (
              <tr key={index} className="pt-2">
                <td>{index + 1}</td>
                <td>{new BigNumber(1).div(price).toFixed(5)}</td>
                <td>
                  {reserveA.isGreaterThan(1e-5)
                    ? getAmountInDenom(
                        tokenA,
                        reserveA,
                        tokenA.address,
                        tokenA.display,
                        {
                          fractionalDigits: 3,
                          significantDigits: 3,
                        }
                      )
                    : ''}
                </td>
                <td>
                  {userReserveATotal && reserveA.isGreaterThan(1e-5)
                    ? `${
                        userReserveATotal.isGreaterThan(0)
                          ? new BigNumber(
                              reserveA
                                .multipliedBy(100)
                                .dividedBy(userReserveATotal)
                            ).toFixed(1)
                          : 0
                      }%`
                    : ''}
                </td>
                <td>
                  {reserveB.isGreaterThan(1e-5)
                    ? getAmountInDenom(
                        tokenB,
                        reserveB,
                        tokenB.address,
                        tokenB.display,
                        {
                          fractionalDigits: 3,
                          significantDigits: 3,
                        }
                      )
                    : ''}
                </td>
                <td>
                  {userReserveBTotal && reserveB.isGreaterThan(1e-5)
                    ? `${
                        userReserveBTotal.isGreaterThan(0)
                          ? new BigNumber(
                              reserveB
                                .multipliedBy(100)
                                .dividedBy(userReserveBTotal)
                            ).toFixed(1)
                          : 0
                      }%`
                    : ''}
                </td>
                <td className="row gap-2 ml-4">
                  {reserveA?.plus(reserveB || 0).isGreaterThan(0) &&
                    (reserveA.isZero() || reserveB.isZero()) && (
                      <button
                        type="button"
                        className="button button-light my-3"
                        onClick={() => {
                          setEditedUserPosition((ticks) => {
                            return ticks.map((tick) => {
                              return tick.deposit.centerTickIndex.toNumber() ===
                                deposit.centerTickIndex.toNumber() &&
                                tick.deposit.fee.toNumber() ===
                                  deposit.fee.toNumber()
                                ? {
                                    ...tick,
                                    tickDiff0:
                                      tick.token0Context?.userReserves.negated() ||
                                      new BigNumber(0),
                                    tickDiff1:
                                      tick.token1Context?.userReserves.negated() ||
                                      new BigNumber(0),
                                  }
                                : tick;
                            });
                          });
                        }}
                      >
                        Withdraw
                      </button>
                    )}
                  {(!tickDiff0.isZero() || !tickDiff1.isZero()) && (
                    <button
                      type="button"
                      className="button button-default my-3"
                      onClick={() => {
                        setEditedUserPosition((ticks) => {
                          return ticks.map((tick) => {
                            return tick.deposit.centerTickIndex.toNumber() ===
                              deposit.centerTickIndex.toNumber() &&
                              tick.deposit.fee.toNumber() ===
                                deposit.fee.toNumber()
                              ? {
                                  ...tick,
                                  tickDiff0: new BigNumber(0),
                                  tickDiff1: new BigNumber(0),
                                }
                              : tick;
                          });
                        });
                      }}
                    >
                      Reset
                    </button>
                  )}
                </td>
              </tr>
            ) : null;
          }
        )
    : null;

  return (
    <MyPositionTableCard
      tokenA={tokenA}
      tokenB={tokenB}
      header={
        <>
          <span className="text-muted">Total Assets</span>
          <strong>{formatCurrency(totalPairValue.toFixed())}</strong>
        </>
      }
      data={data}
      emptyState={
        <tr>
          <td colSpan={5} className="p-5" style={{ textAlign: 'center' }}>
            No deposits made yet
          </td>
        </tr>
      }
      actionColumn=""
    />
  );
}
