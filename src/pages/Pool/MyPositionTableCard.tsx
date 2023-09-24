import { ReactNode, useMemo } from 'react';
import BigNumber from 'bignumber.js';
import { Tick } from '../../components/LiquiditySelector/LiquiditySelector';

import { formatAmount, formatCurrency } from '../../lib/utils/number';
import {
  tickIndexToDisplayPrice,
  tickIndexToPrice,
} from '../../lib/web3/utils/ticks';
import { Token, getDisplayDenomAmount } from '../../lib/web3/utils/tokens';

import { EditedPosition } from '../MyLiquidity/useEditLiquidity';
import { guessInvertedOrder } from '../../lib/web3/utils/pairs';
import { useSimplePrice } from '../../lib/tokenPrices';
import { useStake } from '../MyLiquidity/useStaking';

import TableCard from '../../components/cards/TableCard';
import ValueBar from '../../components/Table/ValueBar';
import { matchTokens } from '../../lib/web3/hooks/useTokens';

function MyPositionTableCard({
  tokenA,
  tokenB,
  title = 'My Position',
  header,
  data,
  emptyState,
  actionColumn,
}: {
  tokenA?: Token;
  tokenB?: Token;
  title?: string;
  header?: ReactNode;
  data: ReactNode;
  emptyState?: ReactNode;
  actionColumn?: string;
}) {
  return (
    <TableCard
      className="my-position-table"
      title={title}
      headerActions={header}
      scrolling={false}
    >
      <table className="my-position-table" style={{ width: '100%' }}>
        <thead>
          <tr className={[!data && 'hide'].filter(Boolean).join(' ')}>
            <th style={{ width: '7.5%' }}>Tick</th>
            <th style={{ width: '20%' }}>Price</th>
            <th style={{ width: '20%' }}>Value</th>
            <th style={{ width: '5%' }}></th>
            <th style={{ width: '20%' }}>Token Amount</th>
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
  edgePriceIndex,
}: {
  tokenA?: Token;
  tokenB?: Token;
  userTicks: Tick[];
  edgePriceIndex: number | undefined;
}) {
  const [reserveATotal, reserveBTotal] = useMemo(() => {
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

  const { data: priceA } = useSimplePrice(tokenA);
  const { data: priceB } = useSimplePrice(tokenB);

  const edgpePriceBToA = useMemo(() => {
    return tickIndexToPrice(new BigNumber(edgePriceIndex || 0));
  }, [edgePriceIndex]);

  const maxPoolEquivalentReservesA = useMemo(() => {
    return userTicks.reduce((acc, { reserveA, reserveB }) => {
      const equivalentReservesA = reserveA?.toNumber() || 0;
      const equivalentReservesB =
        reserveB?.multipliedBy(edgpePriceBToA).toNumber() || 0;
      return Math.max(acc, equivalentReservesA, equivalentReservesB);
    }, 0);
  }, [userTicks, edgpePriceBToA]);

  const poolValues = useMemo(() => {
    return userTicks.map<[number, number]>(
      ({ reserveA, reserveB, tokenA, tokenB }) => {
        const valueA =
          (priceA || 0) *
          new BigNumber(
            (reserveA && getDisplayDenomAmount(tokenA, reserveA || 0)) || 0
          ).toNumber();
        const valueB =
          (priceB || 0) *
          new BigNumber(
            (reserveB && getDisplayDenomAmount(tokenB, reserveB || 0)) || 0
          ).toNumber();
        return [valueA, valueB];
      }
    );
  }, [userTicks, priceA, priceB]);

  const valueTotal = useMemo(() => {
    return poolValues.reduce(
      (acc, [valueA, valueB]) => acc + valueA + valueB,
      0
    );
  }, [poolValues]);

  const data =
    tokenA && tokenB && !(reserveATotal.isZero() && reserveBTotal.isZero())
      ? userTicks.map((tick, index) => {
          const { reserveA, reserveB, tickIndexBToA, tokenA, tokenB } = tick;
          const [valueA, valueB] = poolValues[index];
          const displayPriceBToA = tickIndexToDisplayPrice(
            new BigNumber(tickIndexBToA),
            tokenA,
            tokenB
          );
          // note: fix these restrictions, they are a bit off
          return (
            <tr key={index} className="pt-2">
              <td>{index + 1}</td>
              <td>
                {displayPriceBToA
                  ? formatAmount(displayPriceBToA.toNumber(), {}, 0)
                  : '-'}
              </td>
              {/* this shows the USD equivalent value of the token reserves */}
              <td>
                {reserveA.isGreaterThan(0) && (
                  <div>{formatCurrency(valueA)}</div>
                )}
                {reserveB.isGreaterThan(0) && (
                  <div>{formatCurrency(valueB)}</div>
                )}
              </td>
              {/*
               * this shows the reserveA equivalent value of the token reserves
               * (not USD equivalent) because there may not be a USD price
               */}
              <td className="min-width">
                {reserveA.isGreaterThan(0) && (
                  <ValueBar
                    variant="green"
                    value={reserveA}
                    maxValue={maxPoolEquivalentReservesA}
                  />
                )}
                {/* this looks weird, but its only because of the inconsistent use of individual priceBToA and edgePrice */}
                {reserveB.isGreaterThan(0) && (
                  <ValueBar
                    variant="blue"
                    value={reserveB.multipliedBy(edgpePriceBToA)}
                    maxValue={maxPoolEquivalentReservesA}
                  />
                )}
              </td>

              <td>
                {reserveA.isGreaterThan(0) && (
                  <div>
                    <span>{formatReserveAmount(tokenA, reserveA)}</span>{' '}
                    <span className="text-muted">{tokenA.symbol}</span>
                  </div>
                )}
                {reserveB.isGreaterThan(0) && (
                  <div>
                    <span>{formatReserveAmount(tokenB, reserveB)}</span>{' '}
                    <span className="text-muted">{tokenB.symbol}</span>
                  </div>
                )}
              </td>
            </tr>
          );
        })
      : null;

  return (
    <MyPositionTableCard
      tokenA={tokenA}
      tokenB={tokenB}
      title="New Position"
      header={
        data ? (
          <>
            <span className="text-muted">Total Assets</span>
            <strong>{valueTotal ? formatCurrency(valueTotal) : '...'}</strong>
          </>
        ) : null
      }
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
  edgePriceIndex,
}: {
  tokenA: Token;
  tokenB: Token;
  editedUserPosition: EditedPosition[];
  setEditedUserPosition: React.Dispatch<React.SetStateAction<EditedPosition[]>>;
  viewableMinIndex: number | undefined;
  viewableMaxIndex: number | undefined;
  edgePriceIndex: number | undefined;
}) {
  const invertedTokenOrder = guessInvertedOrder(tokenA.address, tokenB.address);

  const {
    data: [priceA, priceB],
  } = useSimplePrice([tokenA, tokenB]);

  const sortedPosition = useMemo(() => {
    return (
      editedUserPosition
        // sort by price
        .sort((a, b) => {
          return !!invertedTokenOrder
            ? b.deposit.centerTickIndex1To0.toNumber() -
                a.deposit.centerTickIndex1To0.toNumber()
            : a.deposit.centerTickIndex1To0.toNumber() -
                b.deposit.centerTickIndex1To0.toNumber();
        })
    );
  }, [editedUserPosition, invertedTokenOrder]);

  const edgpePriceBToA = useMemo(() => {
    return tickIndexToPrice(new BigNumber(edgePriceIndex || 0));
  }, [edgePriceIndex]);

  const maxPoolEquivalentReservesA = useMemo(() => {
    return sortedPosition.reduce(
      (acc, { token0, token0Context, token1Context }) => {
        const tokenAContext = matchTokens(tokenA, token0)
          ? token0Context
          : token1Context;
        const tokenBContext = matchTokens(tokenB, token0)
          ? token0Context
          : token1Context;
        const equivalentReserveA = tokenAContext?.userReserves.toNumber() ?? 0;
        const equivalentReserveB =
          tokenBContext?.userReserves.multipliedBy(edgpePriceBToA).toNumber() ??
          0;
        return Math.max(acc, equivalentReserveA, equivalentReserveB);
      },
      0
    );
  }, [edgpePriceBToA, sortedPosition, tokenA, tokenB]);

  const poolValues = useMemo(() => {
    return sortedPosition.map<[number, number]>(
      ({ token0, token0Context, token1Context }) => {
        const tokenAContext = matchTokens(tokenA, token0)
          ? token0Context
          : token1Context;
        const tokenBContext = matchTokens(tokenB, token0)
          ? token0Context
          : token1Context;
        const valueA =
          (priceA || 0) *
          new BigNumber(
            (tokenAContext?.userReserves &&
              getDisplayDenomAmount(
                tokenA,
                tokenAContext?.userReserves || 0
              )) ||
              0
          ).toNumber();
        const valueB =
          (priceB || 0) *
          new BigNumber(
            (tokenBContext?.userReserves &&
              getDisplayDenomAmount(
                tokenB,
                tokenBContext?.userReserves || 0
              )) ||
              0
          ).toNumber();
        return [valueA, valueB];
      }
    );
  }, [priceA, priceB, tokenA, tokenB, sortedPosition]);

  const valueTotal = useMemo(() => {
    return poolValues.reduce(
      (acc, [valueA, valueB]) => acc + valueA + valueB,
      0
    );
  }, [poolValues]);

  const [, sendStakeRequest] = useStake();

  const data = editedUserPosition
    ? sortedPosition.map((userPosition, index) => {
        if (userPosition) {
          const {
            tickDiff0,
            tickDiff1,
            deposit,
            token0Context,
            token1Context,
            stakeContext,
          } = userPosition;
          const reserveA = !invertedTokenOrder
            ? tickDiff0.plus(token0Context?.userReserves || 0)
            : tickDiff1.plus(token1Context?.userReserves || 0);
          const reserveB = !invertedTokenOrder
            ? tickDiff1.plus(token1Context?.userReserves || 0)
            : tickDiff0.plus(token0Context?.userReserves || 0);
          const [valueA, valueB] = poolValues[index];

          const tickIndexBToA = !invertedTokenOrder
            ? new BigNumber(deposit.centerTickIndex1To0.toNumber())
            : new BigNumber(deposit.centerTickIndex1To0.toNumber()).negated();

          const displayPriceBToA = tickIndexToDisplayPrice(
            tickIndexBToA,
            tokenA,
            tokenB
          );
          // show only those ticks that are in the currently visible range
          return viewableMinIndex !== undefined &&
            viewableMaxIndex !== undefined &&
            tickIndexBToA.isGreaterThanOrEqualTo(viewableMinIndex) &&
            tickIndexBToA.isLessThanOrEqualTo(viewableMaxIndex) ? (
            <tr key={index} className="pt-2">
              <td>{index + 1}</td>
              <td>
                {displayPriceBToA
                  ? formatAmount(displayPriceBToA.toNumber(), {}, 0)
                  : '-'}
              </td>
              {/* this shows the USD equivalent value of the token reserves */}
              <td>
                {reserveA.isGreaterThan(0) && (
                  <div>{formatCurrency(valueA)}</div>
                )}
                {reserveB.isGreaterThan(0) && (
                  <div>{formatCurrency(valueB)}</div>
                )}
              </td>
              {/*
               * this shows the reserveA equivalent value of the token reserves
               * (not USD equivalent) because there may not be a USD price
               */}
              <td className="min-width">
                {reserveA.isGreaterThan(0) && (
                  <ValueBar
                    variant="green"
                    value={reserveA}
                    maxValue={maxPoolEquivalentReservesA}
                  />
                )}
                {reserveB.isGreaterThan(0) && (
                  <ValueBar
                    variant="blue"
                    value={reserveB.multipliedBy(edgpePriceBToA)}
                    maxValue={maxPoolEquivalentReservesA}
                  />
                )}
              </td>

              <td>
                {reserveA.isGreaterThan(0) && (
                  <div>
                    <span>{formatReserveAmount(tokenA, reserveA)}</span>{' '}
                    <span className="text-muted">{tokenA.symbol}</span>
                  </div>
                )}
                {reserveB.isGreaterThan(0) && (
                  <div>
                    <span>{formatReserveAmount(tokenB, reserveB)}</span>{' '}
                    <span className="text-muted">{tokenB.symbol}</span>
                  </div>
                )}
              </td>
              <td className="row gap-2 ml-3 mr-3">
                {reserveA?.plus(reserveB || 0).isGreaterThan(0) &&
                  (reserveA.isZero() || reserveB.isZero()) && (
                    <button
                      type="button"
                      className={`button ${
                        stakeContext ? 'button-primary-outline' : 'button-light'
                      } ml-auto`}
                      onClick={() => {
                        if (stakeContext) {
                          return sendStakeRequest([], [userPosition]);
                        }
                        setEditedUserPosition((ticks) => {
                          return ticks.map((tick) => {
                            return tick.deposit.centerTickIndex1To0.toNumber() ===
                              deposit.centerTickIndex1To0.toNumber() &&
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
                      {stakeContext ? <>Unstake</> : <>Withdraw</>}
                    </button>
                  )}
                {(!tickDiff0.isZero() || !tickDiff1.isZero()) && (
                  <button
                    type="button"
                    className="button button-muted ml-auto"
                    onClick={() => {
                      setEditedUserPosition((ticks) => {
                        return ticks.map((tick) => {
                          return tick.deposit.centerTickIndex1To0.toNumber() ===
                            deposit.centerTickIndex1To0.toNumber() &&
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
        return null;
      })
    : null;

  return (
    <MyPositionTableCard
      tokenA={tokenA}
      tokenB={tokenB}
      header={
        <>
          <span className="text-muted">Total Assets</span>
          <strong>{valueTotal ? formatCurrency(valueTotal) : '...'}</strong>
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
      actionColumn="Actions"
    />
  );
}

function formatReserveAmount(token: Token, reserve: BigNumber) {
  return formatAmount(getDisplayDenomAmount(token, reserve) || 0);
}
