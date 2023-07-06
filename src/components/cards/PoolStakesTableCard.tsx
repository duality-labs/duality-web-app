import { Link } from 'react-router-dom';
import { ReactNode, useCallback, useMemo, useState } from 'react';
import { useFloating, useHover, useInteractions } from '@floating-ui/react';
import BigNumber from 'bignumber.js';
import { GaugeSDKType } from '@duality-labs/dualityjs/types/codegen/duality/incentives/gauge';

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
import IncentivesCard from './IncentivesCard';

import { tickIndexToPrice } from '../../lib/web3/utils/ticks';
import { guessInvertedOrder } from '../../lib/web3/utils/pairs';

import './PoolsTableCard.scss';
import { useStake } from '../../pages/MyLiquidity/useStaking';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faFire } from '@fortawesome/free-solid-svg-icons';
import { useMatchIncentives } from '../../lib/web3/hooks/useIncentives';

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
  const userStakedShareValues = useUserPositionsShareValues(
    filterForPair,
    true
  );

  // find all positions that have been staked
  const allShareValues: ValuedUserPositionDepositContext[] = useMemo(() => {
    return [...userPositionsShareValues, ...userStakedShareValues];
  }, [userPositionsShareValues, userStakedShareValues]);

  const currentStakes: ValuedUserPositionDepositContext[] = useMemo(() => {
    return [...userStakedShareValues];
  }, [userStakedShareValues]);

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
    let futureStakes = [...currentStakes];

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
        futureStakes = futureStakes.filter(
          (stake) => !isStakeEqual(stake, selectedUnstake)
        );
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

  const stakesEqual = isStakesEqual(currentStakes, futureStakes);

  const onReset = useCallback(() => {
    setSelectedStakes([]);
    setSelectedUnstakes([]);
  }, []);

  return (
    <TableCard
      className={['pool-stakes-list-card', 'pool-list-card', className]
        .filter(Boolean)
        .join(' ')}
      title={title}
      headerActions={
        <div className="row gap-3">
          <Link to="/portfolio/pools">
            <button className="button button-light">Back</button>
          </Link>
          {!stakesEqual && (
            <>
              <button className="button" onClick={onReset}>
                Reset
              </button>
              <ConfirmStake
                currentStakes={currentStakes}
                futureStakes={futureStakes}
              />
            </>
          )}
        </div>
      }
      {...tableCardProps}
    >
      {allShareValues.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th colSpan={2}>
                Price {tokenA.symbol}/{tokenB.symbol}
              </th>
              <th>Fee</th>
              <th>Value</th>
              <th>{tokenA.symbol} Amount</th>
              <th>{tokenB.symbol} Amount</th>
              <th colSpan={2}>Staked</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {allShareValues
              .sort((a, b) => {
                return !guessInvertedOrder(tokenA.address, tokenB.address)
                  ? a.deposit.centerTickIndex
                      .subtract(b.deposit.centerTickIndex)
                      .toNumber()
                  : b.deposit.centerTickIndex
                      .subtract(a.deposit.centerTickIndex)
                      .toNumber();
              })
              .map((userPosition) => {
                const isStaked = !!currentStakes.find((stake) =>
                  isStakeEqual(stake, userPosition)
                );
                const willStake = !!futureStakes.find((stake) =>
                  isStakeEqual(stake, userPosition)
                );

                return (
                  // show user's positions
                  <StakingRow
                    key={`${userPosition.deposit.centerTickIndex}-${userPosition.deposit.fee}`}
                    tokenA={tokenA}
                    tokenB={tokenB}
                    userPosition={userPosition}
                    onCancel={
                      isStaked
                        ? willStake
                          ? undefined
                          : onStake
                        : willStake
                        ? onUnStake
                        : undefined
                    }
                    onStake={willStake ? undefined : onStake}
                    onUnstake={willStake ? onUnStake : undefined}
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
  return (
    <button
      className="button button-primary"
      disabled={isValidating}
      onClick={onClick}
    >
      Confirm stake change
    </button>
  );
}

const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', {
  style: 'short',
});

function StakingRow({
  tokenA,
  tokenB,
  userPosition,
  onStake,
  onUnstake,
  onCancel,
}: {
  tokenA: Token;
  tokenB: Token;
  userPosition: ValuedUserPositionDepositContext;
  onStake?: (userPosition: ValuedUserPositionDepositContext) => void;
  onUnstake?: (userPosition: ValuedUserPositionDepositContext) => void;
  onCancel?: (userPosition: ValuedUserPositionDepositContext) => void;
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

  const incentives = useMatchIncentives(userPosition);

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
        <td>
          {incentives && incentives.length > 0 && (
            <IncentivesButton
              className="row gap-sm flex-centered"
              incentives={incentives}
            >
              <FontAwesomeIcon
                icon={faFire}
                flip="horizontal"
                className="text-secondary"
                size="lg"
              />
              {incentives.length > 1 && <span>x{incentives.length}</span>}
            </IncentivesButton>
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
          {userPosition.stakeContext?.start_time ? (
            <FontAwesomeIcon icon={faCheck} />
          ) : null}
        </td>
        <td className="min-width">
          {userPosition.stakeContext?.start_time &&
            relativeTimeFormatter.format(
              (new Date(userPosition.stakeContext.start_time).valueOf() -
                Date.now()) /
                1000 /
                60 /
                60,
              'hours'
            )}
        </td>
        <td className="min-width">
          <div className="col">
            <div className="row gap-3 ml-auto">
              {onCancel ? (
                <div className="row flex-centered gap-3">
                  <span className="text-action-button">
                    {onStake ? <>Will unstake</> : <>Will stake</>}
                  </span>
                  <button
                    type="button"
                    className="button nowrap m-0"
                    onClick={() => onCancel(userPosition)}
                  >
                    Reset
                  </button>
                </div>
              ) : onStake ? (
                <button
                  type="button"
                  className="button nowrap button-primary m-0"
                  onClick={() => onStake(userPosition)}
                >
                  Stake
                </button>
              ) : onUnstake ? (
                <button
                  type="button"
                  className="button nowrap button-primary-outline m-0"
                  onClick={() => onUnstake(userPosition)}
                >
                  Unstake
                </button>
              ) : null}
            </div>
          </div>
        </td>
      </tr>
    );
  }
  return null;
}

function IncentivesButton({
  children,
  className,
  incentives,
}: {
  children: ReactNode;
  className?: string;
  incentives: GaugeSDKType[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { context, refs, floatingStyles } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: 'right',
  });
  const hover = useHover(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([hover]);
  return (
    // allow row to hold open the popover if the popover is already open
    <div
      key={Number(isOpen)}
      className="row"
      ref={isOpen ? refs.setReference : refs.setPositionReference}
    >
      <button
        className={['button', className].filter(Boolean).join(' ')}
        ref={refs.setReference}
        {...getReferenceProps()}
      >
        {children}
      </button>
      {isOpen && (
        <div
          ref={refs.setFloating}
          className="ml-auto"
          style={floatingStyles}
          {...getFloatingProps()}
        >
          <IncentivesCard incentives={incentives} className="popover" />
        </div>
      )}
    </div>
  );
}
