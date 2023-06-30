import { Link } from 'react-router-dom';
import { useCallback, useMemo, useState } from 'react';
import BigNumber from 'bignumber.js';

import TableCard, { TableCardProps } from './TableCard';

import {
  formatAmount,
  formatLongPrice,
  formatPercentage,
} from '../../lib/utils/number';
import { Token, getAmountInDenom } from '../../lib/web3/utils/tokens';

import { usePoolDepositFilterForPair } from '../../lib/web3/hooks/useUserShares';
import {
  ValuedUserPositionDepositContext,
  useUserPositionsShareValues,
} from '../../lib/web3/hooks/useUserShareValues';

import { tickIndexToPrice } from '../../lib/web3/utils/ticks';

import './PoolsTableCard.scss';
import { useStake } from '../../pages/MyLiquidity/useStaking';

interface PoolsTableCardOptions {
  tokenA: Token;
  tokenB: Token;
}

export default function MyPoolStakesTableCard<T extends string | number>({
  className,
  title = 'My Position',
  tokenA,
  tokenB,
  ...tableCardProps
}: Omit<TableCardProps<T>, 'children'> & PoolsTableCardOptions) {
  const filterForPair = usePoolDepositFilterForPair([tokenA, tokenB]);
  const userPositionsShareValues = useUserPositionsShareValues(filterForPair);

  // find all positions that have been staked
  const currentStakes: ValuedUserPositionDepositContext[] = useMemo(() => {
    return userPositionsShareValues.filter(() => false);
  }, [userPositionsShareValues]);

  //
  const [selectedStakes, setSelectedStakes] = useState<
    ValuedUserPositionDepositContext[]
  >([]);
  const [selectedUnstakes, setSelectedUnstakes] = useState<
    ValuedUserPositionDepositContext[]
  >([]);

  // update future stakes if current stakes change

  // derive future state from starting state and selected changes
  const futureStakes = useMemo<ValuedUserPositionDepositContext[]>(() => {
    const futureStakes = [...currentStakes];

    // add new stakes
    selectedStakes.forEach((selectedStake) => {
      if (!futureStakes.find((stake) => isStakeEqual(stake, selectedStake))) {
        // add up-to-date position object
        const userPosition = userPositionsShareValues.find((position) =>
          isStakeEqual(position, selectedStake)
        );
        if (userPosition) {
          futureStakes.push(userPosition);
        }
      }
    });
    // remove new unstakes
    selectedUnstakes.forEach((selectedUnstake) => {
      if (futureStakes.find((stake) => isStakeEqual(stake, selectedUnstake))) {
        futureStakes.filter((stake) => !isStakeEqual(stake, selectedUnstake));
      }
    });
    return futureStakes;
  }, [
    userPositionsShareValues,
    currentStakes,
    selectedStakes,
    selectedUnstakes,
  ]);

  const onStake = useCallback(
    (userPosition: ValuedUserPositionDepositContext) => {
      setSelectedStakes((selectedStakes) => {
        return [...selectedStakes, userPosition];
      });
      setSelectedUnstakes((selectedUnstakes) => {
        return selectedUnstakes.filter(
          (unstake) => !isStakeEqual(unstake, userPosition)
        );
      });
    },
    []
  );

  const onUnStake = useCallback(
    (userPosition: ValuedUserPositionDepositContext) => {
      setSelectedStakes((selectedStakes) => {
        return selectedStakes.filter(
          (stake) => !isStakeEqual(stake, userPosition)
        );
      });
      setSelectedUnstakes((selectedUnstakes) => {
        return [...selectedUnstakes, userPosition];
      });
    },
    []
  );

  return (
    <TableCard
      className={['pool-list-card', className].filter(Boolean).join(' ')}
      title={title}
      headerActions={
        <div className="row gap-3">
          <Link to="/portfolio/pools">
            <button className="button text-action-button nowrap">Back</button>
          </Link>
          <ConfirmStake
            currentStakes={currentStakes}
            futureStakes={futureStakes}
          />
        </div>
      }
      {...tableCardProps}
    >
      {userPositionsShareValues.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>
                Price {tokenA.symbol}/{tokenB.symbol}
              </th>
              <th>Fee</th>
              <th>Value</th>
              <th>{tokenA.symbol} Amount</th>
              <th>{tokenB.symbol} Amount</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {userPositionsShareValues.map((userPosition) => {
              const isStaked = !!futureStakes.find((stake) =>
                isStakeEqual(stake, userPosition)
              );
              return (
                // show user's positions
                <StakingRow
                  key={`${userPosition.deposit.centerTickIndex}-${userPosition.deposit.fee}`}
                  tokenA={tokenA}
                  tokenB={tokenB}
                  userPosition={userPosition}
                  onStake={isStaked ? undefined : onStake}
                  onUnstake={isStaked ? onUnStake : undefined}
                />
              );
            })}
          </tbody>
        </table>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Pool</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td align="center">No Positions Found</td>
            </tr>
          </tbody>
        </table>
      )}
    </TableCard>
  );
}

function isStakeEqual(
  stakeA: ValuedUserPositionDepositContext,
  stakeB: ValuedUserPositionDepositContext
): boolean {
  return (
    stakeA.deposit.centerTickIndex.equals(stakeB.deposit.centerTickIndex) &&
    stakeA.deposit.fee.equals(stakeB.deposit.fee) &&
    stakeA.deposit.pairID.token0 === stakeB.deposit.pairID.token0 &&
    stakeA.deposit.pairID.token1 === stakeB.deposit.pairID.token1 &&
    stakeA.deposit.sharesOwned === stakeB.deposit.sharesOwned
  );
}

function isStakesEqual(
  stakesA: ValuedUserPositionDepositContext[],
  stakesB: ValuedUserPositionDepositContext[]
): boolean {
  return (
    stakesA.length === stakesB.length &&
    stakesA.every((stakeA, index) => {
      return isStakeEqual(stakeA, stakesB[index]);
    })
  );
}

function ConfirmStake({
  currentStakes,
  futureStakes,
}: {
  currentStakes: ValuedUserPositionDepositContext[];
  futureStakes: ValuedUserPositionDepositContext[];
}) {
  const [{ isValidating }, sendStakeRequest] = useStake();
  const stakesEqual = isStakesEqual(currentStakes, futureStakes);
  const onClick = useCallback(() => {
    const stakePositions = futureStakes.filter(
      (futureStake) =>
        !currentStakes.find((currentStake) =>
          isStakeEqual(futureStake, currentStake)
        )
    );
    const unstakePositions = currentStakes.filter(
      (currentStake) =>
        !futureStakes.find((futureStake) =>
          isStakeEqual(futureStake, currentStake)
        )
    );
    sendStakeRequest(stakePositions, unstakePositions);
  }, [currentStakes, futureStakes, sendStakeRequest]);
  return !stakesEqual ? (
    <button
      className="button button-primary"
      disabled={isValidating}
      onClick={onClick}
    >
      Confirm stake change
    </button>
  ) : null;
}

function StakingRow({
  tokenA,
  tokenB,
  userPosition,
  onStake,
  onUnstake,
}: {
  tokenA: Token;
  tokenB: Token;
  userPosition: ValuedUserPositionDepositContext;
  onStake?: (userPosition: ValuedUserPositionDepositContext) => void;
  onUnstake?: (userPosition: ValuedUserPositionDepositContext) => void;
}) {
  const tokensInverted = tokenA.address !== userPosition.token0.address;

  const {
    tokenAContext,
    tokenBContext,
    tokenAValue = new BigNumber(0),
    tokenBValue = new BigNumber(0),
  } = !tokensInverted
    ? {
        tokenAContext: userPosition.token0Context,
        tokenBContext: userPosition.token1Context,
        tokenAValue: userPosition.token0Value,
        tokenBValue: userPosition.token1Value,
      }
    : {
        tokenAContext: userPosition.token1Context,
        tokenBContext: userPosition.token0Context,
        tokenAValue: userPosition.token1Value,
        tokenBValue: userPosition.token0Value,
      };

  if (tokenAValue.isGreaterThan(0) || tokenBValue.isGreaterThan(0)) {
    return (
      <tr>
        <td>
          {formatLongPrice(
            tickIndexToPrice(
              !tokensInverted
                ? new BigNumber(userPosition.deposit.centerTickIndex.toNumber())
                : new BigNumber(
                    userPosition.deposit.centerTickIndex.toNumber()
                  ).negated()
            ).toFixed()
          )}
        </td>
        <td>{formatPercentage(userPosition.deposit.fee.toNumber() / 10000)}</td>
        <td>${tokenAValue.plus(tokenBValue).toFixed(2)}</td>
        <td>
          {tokenAContext?.userReserves.isGreaterThan(0) &&
            formatAmount(
              getAmountInDenom(
                tokenA,
                tokenAContext?.userReserves || 0,
                tokenA.address,
                tokenA.display
              ) || 0
            )}
        </td>
        <td>
          {tokenBContext?.userReserves.isGreaterThan(0) &&
            formatAmount(
              getAmountInDenom(
                tokenB,
                tokenBContext?.userReserves || 0,
                tokenB.address,
                tokenB.display
              ) || 0
            )}
        </td>
        <td>
          <div className="col">
            <div className="row gap-3 ml-auto">
              {onStake && (
                <button
                  type="button"
                  className="button nowrap button-primary m-0"
                  onClick={() => onStake(userPosition)}
                >
                  Stake
                </button>
              )}
              {onUnstake && (
                <button
                  type="button"
                  className="button nowrap button-primary-outline m-0"
                  onClick={() => onUnstake(userPosition)}
                >
                  Unstake
                </button>
              )}
            </div>
          </div>
        </td>
      </tr>
    );
  }
  return null;
}
