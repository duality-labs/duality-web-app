import { Link } from 'react-router-dom';
import { useCallback } from 'react';
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

  const onStake = useCallback(
    (userPosition: ValuedUserPositionDepositContext) => {
      return;
    },
    []
  );

  const onUnStake = useCallback(
    (userPosition: ValuedUserPositionDepositContext) => {
      return;
    },
    []
  );

  return (
    <TableCard
      className={['pool-list-card', className].filter(Boolean).join(' ')}
      title={title}
      headerActions={
        <Link to="/portfolio/pools">
          <button className="button text-action-button nowrap">Back</button>
        </Link>
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
              return (
                // show user's positions
                <StakingRow
                  key={`${userPosition.deposit.centerTickIndex}-${userPosition.deposit.fee}`}
                  tokenA={tokenA}
                  tokenB={tokenB}
                  userPosition={userPosition}
                  onStake={onStake}
                  onUnstake={onUnStake}
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

function StakingRow({
  tokenA,
  tokenB,
  userPosition,
  onStake,
}: {
  tokenA: Token;
  tokenB: Token;
  userPosition: ValuedUserPositionDepositContext;
  onStake: (userPosition: ValuedUserPositionDepositContext) => void;
  onUnstake: (userPosition: ValuedUserPositionDepositContext) => void;
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
              <button
                type="button"
                className="button nowrap button-primary m-0"
                onClick={() => onStake(userPosition)}
              >
                Stake
              </button>
            </div>
          </div>
        </td>
      </tr>
    );
  }
  return null;
}
