import { Link } from 'react-router-dom';
import {
  ChangeEventHandler,
  FormEventHandler,
  Fragment,
  ReactElement,
  ReactNode,
  useCallback,
  useMemo,
  useState,
} from 'react';
import {
  FloatingPortal,
  useClick,
  useFloating,
  useHover,
  useInteractions,
} from '@floating-ui/react';
import BigNumber from 'bignumber.js';
import { Gauge } from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/incentives/gauge';

import TableCard, { TableCardProps } from './TableCard';

import {
  formatAmount,
  formatCurrency,
  formatPercentage,
} from '../../lib/utils/number';
import {
  Token,
  getDisplayDenomAmount,
  getTokenId,
} from '../../lib/web3/utils/tokens';

import { usePoolDepositFilterForPair } from '../../lib/web3/hooks/useUserShares';
import {
  ValuedUserPositionDepositContext,
  useUserPositionsShareValues,
} from '../../lib/web3/hooks/useUserShareValues';
import IncentivesCard from './IncentivesCard';

import { tickIndexToPrice } from '../../lib/web3/utils/ticks';
import { guessInvertedOrder } from '../../lib/web3/utils/pairs';
import { matchTokens } from '../../lib/web3/hooks/useTokens';
import { useCurrentPriceFromTicks } from '../Liquidity/useCurrentPriceFromTicks';

import './PoolsTableCard.scss';
import { useStake } from '../../pages/MyLiquidity/useStaking';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRightArrowLeft,
  faCheck,
  faFire,
} from '@fortawesome/free-solid-svg-icons';
import { useMatchIncentives } from '../../lib/web3/hooks/useIncentives';
import { RelativeTime } from '../Time';
import PopOver from '../PopOver/PopOver';
import ValueBar from '../Table/ValueBar';

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

  const edgePrice = useCurrentPriceFromTicks(
    getTokenId(tokenA),
    getTokenId(tokenB)
  );

  const maxPoolEquivalentReservesA = useMemo(() => {
    return edgePrice
      ? allShareValues.reduce<number>(
          (acc, { token0, token0Context, token1Context }, index) => {
            const forward = matchTokens(token0, tokenA);
            const reverse = matchTokens(token0, tokenB);
            const tokenAContext = forward ? token0Context : token1Context;
            const tokenBContext = reverse ? token0Context : token1Context;
            const tokenAValue = tokenAContext?.userReserves;
            const tokenBValue =
              tokenBContext?.userReserves.multipliedBy(edgePrice);
            return Math.max(
              acc,
              tokenAValue?.toNumber() || 0,
              tokenBValue?.toNumber() || 0
            );
          },
          0
        )
      : 0;
  }, [allShareValues, edgePrice, tokenA, tokenB]);

  const columnDecimalPlaces = useMemo(() => {
    const values = allShareValues.reduce<{
      price: number[];
      amountA: number[];
      amountB: number[];
    }>(
      (acc, userPosition) => {
        const tokensInverted = !matchTokens(tokenA, userPosition.token0);

        const { tokenAContext, tokenBContext } = !tokensInverted
          ? {
              tokenAContext: userPosition.token0Context,
              tokenBContext: userPosition.token1Context,
            }
          : {
              tokenAContext: userPosition.token1Context,
              tokenBContext: userPosition.token0Context,
            };
        // add price
        if (!isNaN(userPosition.deposit.centerTickIndex1To0?.toNumber())) {
          const tickIndex1To0 =
            userPosition.deposit.centerTickIndex1To0.toNumber();
          acc.price.push(
            tickIndexToPrice(new BigNumber(tickIndex1To0)).toNumber()
          );
        }
        // add amount A
        const amountA = Number(
          getDisplayDenomAmount(tokenA, tokenAContext?.userReserves || 0) || 0
        );
        if (!isNaN(amountA) && amountA > 0) {
          acc.amountA.push(amountA);
        }
        // add amount B
        const amountB = Number(
          getDisplayDenomAmount(tokenB, tokenBContext?.userReserves || 0) || 0
        );
        if (!isNaN(amountB) && amountB > 0) {
          acc.amountB.push(amountB);
        }
        return acc;
      },
      {
        price: [],
        amountA: [],
        amountB: [],
      }
    );

    return {
      price: dp(values.price.sort(asc).at(0)),
      fee: 2,
      value: 2,
      amountA: dp(values.amountA.sort(asc).at(0)),
      amountB: dp(values.amountB.sort(asc).at(0)),
    };

    function asc(a: number, b: number) {
      return a - b;
    }

    // get decimal places when 2 significant figures are required
    function dp(value?: number, precision = 2): number {
      if (!value) {
        return 2;
      }
      // two steps are required here so that big/small values don't become
      // scientific notation strings, eg. 1.2e-9
      const roundedValue = new BigNumber(value).toPrecision(precision);
      const stringValue = new BigNumber(roundedValue).toFixed();
      return stringValue.split('.').pop()?.length || 0;
    }
  }, [allShareValues, tokenA, tokenB]);

  // control pool selection through a selected list
  const [selectedPools, setSelectedPools] = useState<
    ValuedUserPositionDepositContext[]
  >([]);

  const [selectedAll, setSelectedAll] = useState(false);

  const onReset = useCallback<FormEventHandler<HTMLInputElement>>(() => {
    setSelectedAll(false);
    setSelectedPools([]);
  }, []);

  const toggleAll = useCallback<ChangeEventHandler<HTMLInputElement>>(
    (event) => {
      if (event.target.checked) {
        setSelectedAll(true);
        setSelectedPools([
          ...userStakedShareValues,
          ...userPositionsShareValues,
        ]);
      } else {
        setSelectedAll(false);
        setSelectedPools([]);
      }
    },
    [userPositionsShareValues, userStakedShareValues]
  );

  const onChange = useCallback<ChangeEventHandler<HTMLInputElement>>(
    (event) => {
      const selectedPool = getUserPositionFromID(
        selectedPools,
        event.target.value
      );
      if (selectedPool) {
        setSelectedPools((selectedPools) => {
          return selectedPools.filter((pool) => pool !== selectedPool);
        });
      } else {
        setSelectedPools((selectedPools) => {
          const newPool =
            // add staked pool
            getUserPositionFromID(userStakedShareValues, event.target.value) ||
            // or add unstaked pool
            getUserPositionFromID(userPositionsShareValues, event.target.value);
          return newPool ? [...selectedPools, newPool] : selectedPools;
        });
      }
    },
    [selectedPools, userPositionsShareValues, userStakedShareValues]
  );

  // create form submission methods and state
  const [{ isValidating }, sendStakeRequest] = useStake();
  const onStake = useCallback(() => {
    const stakePositions = selectedPools.filter(
      (pool) => !pool.stakeContext?.ID
    );
    sendStakeRequest(stakePositions, []);
  }, [selectedPools, sendStakeRequest]);
  const onUnstake = useCallback(() => {
    const unstakePositions = selectedPools.filter(
      (pool) => pool.stakeContext?.ID
    );
    sendStakeRequest([], unstakePositions);
  }, [selectedPools, sendStakeRequest]);
  const onSubmit = useCallback<FormEventHandler<HTMLFormElement>>((event) => {
    // don't execute default behavior, we have two action buttons not one
    // and need to decide which to do, there is no default
    event.preventDefault();
  }, []);

  const hasContext = useMemo<boolean>(() => {
    return allShareValues.some(
      (share) => share.token0Context || share.token1Context
    );
  }, [allShareValues]);

  return (
    <TableCard
      as={'form'}
      className={['pool-stakes-list-card', 'pool-list-card', className]
        .filter(Boolean)
        .join(' ')}
      title={
        <div className="row gap-3">
          <span>{title}</span>
          <Link to={`/portfolio/pools/${tokenB.symbol}/${tokenA.symbol}`}>
            <button className="button px-1 py-0">
              <FontAwesomeIcon icon={faArrowRightArrowLeft} />
            </button>
          </Link>
        </div>
      }
      headerActions={
        <div className="row gap-3">
          <Link to="/portfolio/pools">
            <button className="button button-muted">Back</button>
          </Link>
          {selectedPools.length > 0 && (
            <>
              <input
                type="reset"
                className="button"
                value="Reset"
                onClick={onReset}
              />
            </>
          )}
          <button
            className="button button-primary-outline"
            // check if validating or action wil produce a result
            disabled={
              isValidating ||
              !selectedPools.some((pool) => pool.stakeContext?.ID)
            }
            onClick={onUnstake}
          >
            Unstake All
          </button>
          <button
            className="button button-primary"
            // check if validating or action wil produce a result
            disabled={
              isValidating ||
              !selectedPools.some((pool) => !pool.stakeContext?.ID)
            }
            onClick={onStake}
          >
            Stake All
          </button>
        </div>
      }
      onSubmit={onSubmit}
      {...tableCardProps}
    >
      <table>
        <thead>
          <tr>
            {hasContext && (
              <th>
                <input
                  type="checkbox"
                  checked={selectedAll}
                  onChange={toggleAll}
                />
              </th>
            )}
            <th className="min-width">
              Price: {tokenA.symbol}/{tokenB.symbol}
            </th>
            <th></th>
            <th>Fee</th>
            <th>Value</th>
            <th></th>
            <th>Token Amount</th>
            <th className="pl-lg">Staked</th>
          </tr>
        </thead>
        <tbody>
          {hasContext ? (
            allShareValues
              .sort((a, b) => {
                return !guessInvertedOrder([tokenA, tokenB])
                  ? a.deposit.centerTickIndex1To0
                      .subtract(b.deposit.centerTickIndex1To0)
                      .toNumber()
                  : b.deposit.centerTickIndex1To0
                      .subtract(a.deposit.centerTickIndex1To0)
                      .toNumber();
              })
              .map((userPosition) => {
                const isSelected = !!selectedPools.find((stake) =>
                  isStakeEqual(stake, userPosition)
                );

                const checkbox = (
                  <input
                    type="checkbox"
                    name="selected-pool-ids"
                    value={getUserPositionID(userPosition)}
                    checked={isSelected}
                    onChange={onChange}
                  />
                );
                return (
                  // show user's positions
                  <StakingRow
                    key={`${userPosition.deposit.centerTickIndex1To0}-${userPosition.deposit.fee}`}
                    tokenA={tokenA}
                    tokenB={tokenB}
                    userPosition={userPosition}
                    maxPoolEquivalentReservesA={maxPoolEquivalentReservesA}
                    columnDecimalPlaces={columnDecimalPlaces}
                    checkbox={checkbox}
                  />
                );
              })
          ) : (
            <tr>
              <td colSpan={7}>No Position Found</td>
            </tr>
          )}
        </tbody>
      </table>
    </TableCard>
  );
}

function isStakeEqual(
  stakeA: ValuedUserPositionDepositContext,
  stakeB: ValuedUserPositionDepositContext
): boolean {
  return (
    stakeA.deposit.centerTickIndex1To0.equals(
      stakeB.deposit.centerTickIndex1To0
    ) &&
    stakeA.deposit.fee.equals(stakeB.deposit.fee) &&
    stakeA.deposit.pairID.token0 === stakeB.deposit.pairID.token0 &&
    stakeA.deposit.pairID.token1 === stakeB.deposit.pairID.token1 &&
    stakeA.deposit.sharesOwned === stakeB.deposit.sharesOwned
  );
}

function getUserPositionID(
  userPosition: ValuedUserPositionDepositContext
): string {
  return [
    userPosition.deposit.centerTickIndex1To0.toString(),
    userPosition.deposit.fee.toString(),
    userPosition.stakeContext?.ID,
  ]
    .filter((string) => string !== undefined)
    .join(',');
}

function getUserPositionFromID(
  userPositions: ValuedUserPositionDepositContext[],
  userPositionID: string
): ValuedUserPositionDepositContext | undefined {
  return userPositions.find((userPosition) => {
    return getUserPositionID(userPosition) === userPositionID;
  });
}

function StakingRow({
  tokenA,
  tokenB,
  userPosition,
  maxPoolEquivalentReservesA = 0,
  columnDecimalPlaces,
  checkbox,
}: {
  tokenA: Token;
  tokenB: Token;
  userPosition: ValuedUserPositionDepositContext;
  maxPoolEquivalentReservesA: number;
  columnDecimalPlaces: {
    price: number;
    fee: number;
    value: number;
    amountA: number;
    amountB: number;
  };
  checkbox?: ReactElement;
}) {
  const tokensInverted = !matchTokens(tokenA, userPosition.token0);

  const edgePrice = useCurrentPriceFromTicks(
    getTokenId(tokenA),
    getTokenId(tokenB)
  );
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

  const isStaked = userPosition.stakeContext;
  const isIncentivized = !!incentives && incentives?.length > 0;

  if (
    edgePrice &&
    maxPoolEquivalentReservesA &&
    (tokenAContext || tokenBContext)
  ) {
    return (
      <tr>
        <td className="min-width">
          {/* use label to extend to click area */}
          <label className="pt-0 pb-2 pr-3">{checkbox}</label>
        </td>
        <td className="min-width pl-3">
          {formatAmount(
            tickIndexToPrice(
              !tokensInverted
                ? new BigNumber(
                    userPosition.deposit.centerTickIndex1To0.toNumber()
                  )
                : new BigNumber(
                    userPosition.deposit.centerTickIndex1To0.toNumber()
                  ).negated()
            ).toFixed(),
            {
              useGrouping: true,
              minimumFractionDigits: columnDecimalPlaces.price,
              maximumFractionDigits: columnDecimalPlaces.price,
            }
          )}{' '}
          <span className="text-muted">
            {tokenA.symbol}/{tokenB.symbol}
          </span>
        </td>
        <td className="py-0">
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
        <td>
          {formatPercentage(userPosition.deposit.fee.toNumber() / 10000, {
            minimumFractionDigits: 2,
          })}
        </td>
        {/* this shows the USD equivalent value of the user's token reserves */}
        <td>{formatCurrency(tokenAValue.plus(tokenBValue).toNumber())}</td>
        {/*
         * this shows the reserveA equivalent value of the token reserves
         * (not USD equivalent) because there may not be a USD price
         */}
        <td className="min-width">
          {tokenAContext?.userReserves.isGreaterThan(0) && (
            <ValueBar
              className={isStaked && isIncentivized && 'highlighted'}
              variant="green"
              value={tokenAContext?.userReserves}
              maxValue={maxPoolEquivalentReservesA}
            />
          )}
          {tokenBContext?.userReserves.isGreaterThan(0) && (
            <ValueBar
              className={isStaked && isIncentivized && 'highlighted'}
              variant="blue"
              value={tokenBContext?.userReserves.multipliedBy(edgePrice)}
              maxValue={maxPoolEquivalentReservesA}
            />
          )}
        </td>
        <td>
          {tokenAContext?.userReserves.isGreaterThan(0) && (
            <div>
              <span>
                {formatAmount(
                  getDisplayDenomAmount(
                    tokenA,
                    tokenAContext?.userReserves || 0,
                    {
                      fractionalDigits: columnDecimalPlaces.amountA,
                    }
                  ) || 0,
                  {
                    useGrouping: true,
                  }
                )}
              </span>{' '}
              <span className="text-muted">{tokenA.symbol}</span>
            </div>
          )}
          {tokenBContext?.userReserves.isGreaterThan(0) && (
            <div>
              <span>
                {formatAmount(
                  getDisplayDenomAmount(
                    tokenB,
                    tokenBContext?.userReserves || 0,
                    {
                      fractionalDigits: columnDecimalPlaces.amountB,
                    }
                  ) || 0,
                  {
                    useGrouping: true,
                  }
                )}
              </span>{' '}
              <span className="text-muted">{tokenB.symbol}</span>
            </div>
          )}
        </td>
        <td className="min-width">
          {isStaked ? (
            <PopOver
              floating={
                <RelativeTime
                  timestamp={
                    userPosition.stakeContext?.startTimeUnix
                      ? userPosition.stakeContext.startTimeUnix * 1000
                      : undefined
                  }
                />
              }
            >
              <FontAwesomeIcon className="mr-3" icon={faCheck} />
            </PopOver>
          ) : null}
        </td>
      </tr>
    );
  }
  return null;
}

export function IncentivesButton({
  children,
  className,
  incentives,
  floating = false,
}: {
  children: ReactNode;
  className?: string;
  incentives: Gauge[];
  floating?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { context, refs, floatingStyles } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: 'right',
  });
  const hover = useHover(context, { mouseOnly: true });
  const click = useClick(context, { ignoreMouse: true, toggle: true });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    click,
  ]);

  const Floating = floating ? FloatingPortal : Fragment;
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
        <Floating>
          <div
            ref={refs.setFloating}
            className="ml-auto"
            style={{ ...floatingStyles, zIndex: 1 }}
            {...getFloatingProps()}
          >
            <IncentivesCard incentives={incentives} className="popover" />
          </div>
        </Floating>
      )}
    </div>
  );
}
