import { MouseEventHandler, ReactNode, useMemo, useState } from 'react';
import { NavigateFunction, useNavigate } from 'react-router-dom';

import BigNumber from 'bignumber.js';

import TableCard, { TableCardProps } from './TableCard';

import { useSimplePrice } from '../../lib/tokenPrices';
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
import useIncentiveGauges from '../../lib/web3/hooks/useIncentives';
import { Gauge } from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/incentives/gauge';
import { IncentivesButton } from './PoolStakesTableCard';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFire } from '@fortawesome/free-solid-svg-icons';

interface PoolsTableCardOptions {
  onTokenPairClick?: (tokens: [token0: Token, token1: Token]) => void;
  userPositionActions?: Actions;
}

export default function PoolsTableCard<T extends string | number>({
  className,
  title = 'All Pools',
  onTokenPairClick,
  ...tableCardProps
}: Omit<TableCardProps<T>, 'children'> & PoolsTableCardOptions) {
  const [searchValue, setSearchValue] = useState<string>('');

  const tokenList = useTokens();
  const { data: tokenPairs } = useTokenPairs();
  const allPairsList = useMemo<Array<[string, Token, Token]>>(() => {
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
          .map<[string, Token, Token]>(([token0, token1]) => {
            return [
              getPairID(token0, token1),
              tokenListByAddress[token0],
              tokenListByAddress[token1],
            ];
          })
          .filter(([, token0, token1]) => token0 && token1)
      : [];
  }, [tokenList, tokenPairs]);

  const filteredPoolTokenList = useFilteredTokenList(tokenList, searchValue);

  const filteredPoolsList = useMemo<Array<[string, Token, Token]>>(() => {
    const tokenList = filteredPoolTokenList.map(({ token }) => token);
    return allPairsList.filter(([, token0, token1]) => {
      return tokenList.includes(token0) || tokenList.includes(token1);
    });
  }, [allPairsList, filteredPoolTokenList]);

  return (
    <TableCard
      className={['pool-list-card', className].filter(Boolean).join(' ')}
      title={title}
      searchValue={searchValue}
      setSearchValue={setSearchValue}
      {...tableCardProps}
    >
      {filteredPoolsList.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th colSpan={2}>Pool</th>
              <th>TVL</th>
              <th>Volume (7 days)</th>
              <th>Volatility (7 days)</th>
            </tr>
          </thead>
          <tbody>
            {filteredPoolsList.map(([pairId, token0, token1]) => {
              const onRowClick:
                | MouseEventHandler<HTMLButtonElement>
                | undefined = onTokenPairClick
                ? () => onTokenPairClick([token0, token1])
                : undefined;
              return (
                // show general pair data
                <PairRow
                  key={pairId}
                  token0={token0}
                  token1={token1}
                  onClick={onRowClick}
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

  const { data: { gauges } = {} } = useIncentiveGauges();
  const incentives = useMemo<Gauge[]>(() => {
    const tokenAddresses = [token0.address, token1.address].filter(
      (address): address is string => !!address
    );
    return gauges && gauges.length > 0
      ? gauges.filter((gauge) => {
          return tokenAddresses.length > 0
            ? tokenAddresses.every((address) => {
                return (
                  address === gauge.distribute_to?.pairID?.token0 ||
                  address === gauge.distribute_to?.pairID?.token1
                );
              })
            : true;
        })
      : [];
  }, [gauges, token0, token1]);

  if (token0 && token1 && price0 && price1) {
    return (
      <tr>
        <td className="min-width">
          <TokenPair token0={token0} token1={token1} onClick={onClick} />
        </td>
        <td>
          {incentives && incentives.length > 0 && (
            <IncentivesButton
              className="row ml-2 gap-sm flex-centered"
              incentives={incentives}
              floating={true}
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

export function MyPoolsTableCard<T extends string | number>({
  className,
  title = 'My Pools',
  onTokenPairClick,
  userPositionActions = defaultActions,
  ...tableCardProps
}: Omit<TableCardProps<T>, 'children'> & PoolsTableCardOptions) {
  const [searchValue, setSearchValue] = useState<string>('');

  const tokenList = useTokens();

  const userPositionsShareValues = useUserPositionsShareValues();

  const myPoolsList = useMemo<
    Array<
      [
        pairID: string,
        token0: Token,
        token1: Token,
        userPositions: UserPositionDepositContext[]
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

  const filteredPoolTokenList = useFilteredTokenList(tokenList, searchValue);

  const filteredPoolsList = useMemo<
    Array<[string, Token, Token, UserPositionDepositContext[]]>
  >(() => {
    const tokenList = filteredPoolTokenList.map(({ token }) => token);
    return myPoolsList.filter(([, token0, token1]) => {
      return tokenList.includes(token0) || tokenList.includes(token1);
    });
  }, [myPoolsList, filteredPoolTokenList]);

  return (
    <TableCard
      className={['pool-list-card', className].filter(Boolean).join(' ')}
      title={title}
      searchValue={searchValue}
      setSearchValue={setSearchValue}
      {...tableCardProps}
    >
      {filteredPoolsList.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Pair</th>
              <th>Value</th>
              <th>Composition</th>
              {Object.keys(userPositionActions || {}).length > 0 && (
                <th>Action</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredPoolsList.map(
              ([pairId, token0, token1, userPositions]) => {
                const onRowClick:
                  | MouseEventHandler<HTMLButtonElement>
                  | undefined = onTokenPairClick
                  ? () => onTokenPairClick([token0, token1])
                  : undefined;
                return (
                  // show user's positions
                  <PositionRow
                    key={pairId}
                    token0={token0}
                    token1={token1}
                    userPositions={userPositions}
                    onClick={onRowClick}
                    actions={userPositionActions}
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

export interface Actions {
  [actionKey: string]: {
    title: ReactNode;
    className?: string;
    action: (action: {
      token0: Token;
      token1: Token;
      userPositions: Array<ValuedUserPositionDepositContext>;
      navigate: NavigateFunction;
    }) => void;
  };
}

const defaultActions: Actions = {
  manage: {
    title: 'Manage',
    className: 'button-light m-0',
    action: ({ navigate, token0, token1 }) =>
      navigate(`/pools/${token0.symbol}/${token1.symbol}/edit`),
  },
};

function PositionRow({
  token0,
  token1,
  userPositions,
  onClick,
  actions = {},
}: {
  token0: Token;
  token1: Token;
  userPositions: Array<ValuedUserPositionDepositContext>;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  actions?: Actions;
}) {
  const navigate = useNavigate();

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
        {Object.keys(actions).length > 0 && (
          <td>
            <div className="col">
              <div className="row gap-3 ml-auto">
                {Object.entries(actions).map(
                  ([actionKey, { action, className, title }]) => (
                    <button
                      key={actionKey}
                      type="button"
                      onClick={() => {
                        action({ token0, token1, userPositions, navigate });
                      }}
                      className={['button nowrap', className]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {title}
                    </button>
                  )
                )}
              </div>
            </div>
          </td>
        )}
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
