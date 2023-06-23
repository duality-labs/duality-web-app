import { MouseEventHandler, useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUp } from '@fortawesome/free-solid-svg-icons';

import TableCard, { TableCardProps } from './TableCard';

import { useSimplePrice } from '../../lib/tokenPrices';
import {
  useEditLiquidity,
  EditedPosition,
} from '../../pages/MyLiquidity/useEditLiquidity';
import { useFilteredTokenList } from '../../components/TokenPicker/hooks';
import useTokens from '../../lib/web3/hooks/useTokens';

import { formatAmount } from '../../lib/utils/number';
import { Token, getAmountInDenom } from '../../lib/web3/utils/tokens';
import useTokenPairs from '../../lib/web3/hooks/useTokenPairs';
import { useTokenPairTickLiquidity } from '../../lib/web3/hooks/useTickLiquidity';
import { getPairID } from '../../lib/web3/utils/pairs';

import { UserPositionDepositContext } from '../../lib/web3/hooks/useUserShares';
import {
  ValuedUserPositionDepositContext,
  useUserPositionsShareValues,
} from '../../lib/web3/hooks/useUserShareValues';

import './PoolsTableCard.scss';

const switchValues = {
  all: 'Show All',
  mine: 'My Positions',
};

// customize the passed TableCardProps
interface PoolsTableCardProps
  extends Partial<
    Omit<
      TableCardProps<string>,
      'switchValues' | 'switchValue' | 'switchOnChange'
    >
  > {
  switchValues?: typeof switchValues;
  switchValue?: keyof typeof switchValues;
  switchOnChange?: React.Dispatch<
    React.SetStateAction<keyof typeof switchValues>
  >;
}

interface PoolsTableCardOptions {
  onTokenPairClick?: (tokens: [token0: Token, token1: Token]) => void;
}

export default function PoolsTableCard({
  className,
  title = 'All Pools',
  switchValue: givenSwitchValue = 'mine',
  switchOnChange: givenSwitchOnChange,
  onTokenPairClick,
  ...props
}: PoolsTableCardProps & PoolsTableCardOptions) {
  const [searchValue, setSearchValue] = useState<string>('');

  const tokenList = useTokens();
  const { data: tokenPairs } = useTokenPairs();
  const allPairsList = useMemo<Array<[string, Token, Token, undefined]>>(() => {
    const tokenListByAddress = tokenList.reduce<{ [address: string]: Token }>(
      (acc, token) => {
        if (token.address) {
          acc[token.address] = token;
        }
        return acc;
      },
      {}
    );
    return tokenPairs
      ? tokenPairs
          .map<[string, Token, Token, undefined]>(([token0, token1]) => {
            return [
              getPairID(token0, token1),
              tokenListByAddress[token0],
              tokenListByAddress[token1],
              undefined,
            ];
          })
          .filter(([, token0, token1]) => token0 && token1)
      : [];
  }, [tokenList, tokenPairs]);

  const userPositionsShareValues = useUserPositionsShareValues();

  const myPoolsList = useMemo<
    Array<
      [
        pairID: string,
        token0: Token,
        token1: Token,
        userPositions: UserPositionDepositContext[] | undefined
      ]
    >
  >(() => {
    // collect positions into token pair groups
    const userPositionsShareValueMap = userPositionsShareValues.reduce<{
      [pairID: string]: {
        token0: Token;
        token1: Token;
        userPositions: UserPositionDepositContext[];
      };
    }>((map, userPosition) => {
      const { token0: token0Address, token1: token1Address } =
        userPosition.deposit.pairID;
      const pairID = getPairID(token0Address, token1Address);
      const token0 = tokenList.find((token) => token.address === token0Address);
      const token1 = tokenList.find((token) => token.address === token1Address);
      if (pairID && token0 && token1) {
        map[pairID] = map[pairID] || { token0, token1, userPositions: [] };
        map[pairID].userPositions.push(userPosition);
      }
      return map;
    }, {});

    return userPositionsShareValueMap
      ? Object.entries(userPositionsShareValueMap).map<
          [string, Token, Token, UserPositionDepositContext[]]
        >(([pairId, { token0, token1, userPositions }]) => {
          return [pairId, token0, token1, userPositions];
        })
      : [];
  }, [userPositionsShareValues, tokenList]);

  // enforce switch state and non-interactivity if the user has no pools
  // fix this with useState, it switches on updates sometimes
  const switchValue = !myPoolsList.length ? 'all' : givenSwitchValue;
  const switchOnChange = !myPoolsList.length ? undefined : givenSwitchOnChange;
  const filteredPoolTokenList = useFilteredTokenList(tokenList, searchValue);

  const filteredPoolsList = useMemo<
    Array<[string, Token, Token, UserPositionDepositContext[] | undefined]>
  >(() => {
    const tokenList = filteredPoolTokenList.map(({ token }) => token);
    const poolList = switchValue === 'mine' ? myPoolsList : allPairsList;
    return poolList.filter(([, token0, token1]) => {
      return tokenList.includes(token0) || tokenList.includes(token1);
    });
  }, [switchValue, myPoolsList, allPairsList, filteredPoolTokenList]);

  return (
    <TableCard
      className={['pool-list-card', className].filter(Boolean).join(' ')}
      title={title}
      searchValue={searchValue}
      setSearchValue={setSearchValue}
      switchValues={switchValues}
      switchValue={switchValue}
      switchOnChange={switchOnChange}
      {...props}
    >
      {filteredPoolsList.length > 0 ? (
        <table>
          <thead>
            {switchValue === 'mine' ? (
              <tr>
                <th>Pool</th>
                <th>Value</th>
                <th>Composition</th>
                <th>Withdraw</th>
              </tr>
            ) : (
              <tr>
                <th>Pool</th>
                <th>TVL</th>
                <th>Volume (7 days)</th>
                <th>Volatility (7 days)</th>
              </tr>
            )}
          </thead>
          <tbody>
            {filteredPoolsList.map(
              ([pairId, token0, token1, userPositions]) => {
                const onRowClick:
                  | MouseEventHandler<HTMLButtonElement>
                  | undefined = onTokenPairClick
                  ? () => onTokenPairClick([token0, token1])
                  : undefined;
                return userPositions ? (
                  // show user's positions
                  <PositionRow
                    key={pairId}
                    token0={token0}
                    token1={token1}
                    userPositions={userPositions}
                    onClick={onRowClick}
                  />
                ) : (
                  // show general pair data
                  <PairRow
                    key={pairId}
                    token0={token0}
                    token1={token1}
                    onClick={onRowClick}
                  />
                );
              }
            )}
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
              <td align="center">
                No {!!searchValue ? 'Matching' : ''} Pools Found
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </TableCard>
  );
}

function PairRow({
  token0,
  token1,
  onClick,
}: {
  token0: Token;
  token1: Token;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}) {
  const {
    data: [price0, price1],
  } = useSimplePrice([token0, token1]);
  const {
    data: [token0Ticks = [], token1Ticks = []],
  } = useTokenPairTickLiquidity([token0.address, token1.address]);

  const [value0, value1] = useMemo(() => {
    const initialValues: [BigNumber, BigNumber] = [
      new BigNumber(0),
      new BigNumber(0),
    ];
    if (price0 && price1) {
      return [
        token0Ticks.reduce<BigNumber>((acc, tick) => {
          return acc.plus(
            getAmountInDenom(
              token0,
              tick.reserve0.multipliedBy(price0),
              token0.address,
              token0.display
            ) || 0
          );
        }, initialValues[0]),
        token1Ticks.reduce<BigNumber>((acc, tick) => {
          return acc.plus(
            getAmountInDenom(
              token1,
              tick.reserve1.multipliedBy(price1),
              token1.address,
              token1.display
            ) || 0
          );
        }, initialValues[1]),
      ];
    }
    return initialValues;
  }, [token0Ticks, token1Ticks, token0, token1, price0, price1]);

  if (token0 && token1 && price0 && price1) {
    return (
      <tr>
        <td>
          <TokenPair token0={token0} token1={token1} onClick={onClick} />
        </td>
        {/* TVL col */}
        <td>{value0 && value1 && <>${value0.plus(value1).toFixed(2)}</>}</td>
        {/* Volume (7 days) col */}
        <td>-</td>
        {/* Volatility (7 days) col */}
        <td>-</td>
      </tr>
    );
  }
  return (
    <tr>
      <td colSpan={100}>Fetching price data ...</td>
    </tr>
  );
}

function PositionRow({
  token0,
  token1,
  userPositions,
  onClick,
}: {
  token0: Token;
  token1: Token;
  userPositions: Array<ValuedUserPositionDepositContext>;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}) {
  const total0 = userPositions.reduce<BigNumber>((acc, { token0Context }) => {
    return acc.plus(token0Context?.userReserves || 0);
  }, new BigNumber(0));
  const total1 = userPositions.reduce<BigNumber>((acc, { token1Context }) => {
    return acc.plus(token1Context?.userReserves || 0);
  }, new BigNumber(0));

  const value0 = userPositions.reduce<BigNumber>((acc, { token0Value }) => {
    return acc.plus(token0Value || 0);
  }, new BigNumber(0));
  const value1 = userPositions.reduce<BigNumber>((acc, { token1Value }) => {
    return acc.plus(token1Value || 0);
  }, new BigNumber(0));

  const [{ isValidating }, sendEditRequest] = useEditLiquidity();

  const withdrawPair = useCallback<
    Awaited<(shareValues: Array<ValuedUserPositionDepositContext>) => void>
  >(
    async (userPositions: Array<ValuedUserPositionDepositContext>) => {
      if (!isValidating) {
        // get relevant tick diffs
        const sharesDiff: Array<EditedPosition> = userPositions.flatMap(
          (userPosition: ValuedUserPositionDepositContext) => {
            return {
              ...userPosition,
              // remove user's reserves if found
              tickDiff0:
                userPosition.token0Context?.userReserves.negated() ??
                new BigNumber(0),
              tickDiff1:
                userPosition.token1Context?.userReserves.negated() ??
                new BigNumber(0),
            };
          }
        );

        await sendEditRequest(sharesDiff);
      }
    },
    [isValidating, sendEditRequest]
  );

  const withdraw: MouseEventHandler<HTMLButtonElement> | undefined =
    userPositions.length > 0 ? () => withdrawPair(userPositions) : undefined;

  if (total0 && total1) {
    return (
      <tr>
        <td>
          <TokenPair token0={token0} token1={token1} onClick={onClick} />
        </td>
        <td>{value0 && value1 && <>${value0.plus(value1).toFixed(2)}</>}</td>
        <td>
          <span className="token-compositions">
            {formatAmount(
              getAmountInDenom(
                token0,
                total0,
                token0.address,
                token0.display
              ) || 0
            )}
            &nbsp;{token0.symbol}
            {' / '}
            {formatAmount(
              getAmountInDenom(
                token1,
                total1,
                token1.address,
                token1.display
              ) || 0
            )}
            &nbsp;{token1.symbol}
          </span>
        </td>
        <td>
          <button type="button" onClick={withdraw} className="button nowrap">
            {[
              total0.isGreaterThan(0) && token0.display.toUpperCase(),
              total1.isGreaterThan(0) && token1.display.toUpperCase(),
            ]
              .filter(Boolean)
              .join(' / ')}
            <FontAwesomeIcon icon={faArrowUp} className="ml-3" />
          </button>
        </td>
      </tr>
    );
  }
  return null;
}

function TokenPair({
  token0,
  token1,
  onClick,
  as = !!onClick ? 'button' : 'div',
}: {
  token0: Token;
  token1: Token;
  as?: React.ElementType;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}) {
  const BaseElement = as;
  return (
    <BaseElement
      type={as === 'button' ? 'button' : undefined}
      className="row gap-3 token-and-chain"
      onClick={onClick}
    >
      <div className="row flex-centered flow-nowrap">
        <img
          className="token-logo"
          src={token0.logo_URIs?.svg || token0.logo_URIs?.png || ''}
          alt={`${token0.name} logo`}
        />
        <img
          className="token-logo"
          src={token1.logo_URIs?.svg || token1.logo_URIs?.png || ''}
          alt={`${token1.name} logo`}
        />
      </div>
      <div className="col">
        <div className="row">
          <div className="col token-denom">
            {token0.display.toUpperCase()}
            {' / '}
            {token1.display.toUpperCase()}
          </div>
        </div>
        <div className="row">
          <div className="col subtext">
            {token0.chain.chain_name === token1.chain.chain_name ? (
              <span className="nowrap">
                {token0.chain.chain_name
                  .split('')
                  .map((v, i) => (i > 0 ? v : v.toUpperCase()))
                  .join('')}
              </span>
            ) : (
              <>
                <span className="nowrap">
                  {token0.chain.chain_name
                    .split('')
                    .map((v, i) => (i > 0 ? v : v.toUpperCase()))
                    .join('')}
                </span>
                <span> / </span>
                <span>
                  {token1.chain.chain_name
                    .split('')
                    .map((v, i) => (i > 0 ? v : v.toUpperCase()))
                    .join('')}
                  `
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </BaseElement>
  );
}
