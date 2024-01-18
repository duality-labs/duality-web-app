import { MouseEventHandler, ReactNode, useMemo, useState } from 'react';
import { NavigateFunction, useNavigate } from 'react-router-dom';

import BigNumber from 'bignumber.js';

import TableCard, { TableCardProps } from './TableCard';

import { useSimplePrice } from '../../lib/tokenPrices';
import { useFilteredTokenList } from '../../components/TokenPicker/hooks';
import useTokens, {
  getTokenPathPart,
  matchTokenByDenom,
  useTokensWithIbcInfo,
} from '../../lib/web3/hooks/useTokens';

import { formatAmount, formatCurrency } from '../../lib/utils/number';
import { Token, getDisplayDenomAmount } from '../../lib/web3/utils/tokens';
import useTokenPairs from '../../lib/web3/hooks/useTokenPairs';
import { getPairID } from '../../lib/web3/utils/pairs';
import {
  UserValuedReserves,
  useEstimatedUserReserves,
} from '../../lib/web3/hooks/useUserReserves';

import './PoolsTableCard.scss';

interface PoolsTableCardOptions {
  onTokenPairClick?: (tokens: [token0: Token, token1: Token]) => void;
  userPositionActions?: Actions;
}

type PoolTableRow = [string, Token, Token, number, number];

export default function PoolsTableCard<T extends string | number>({
  className,
  title = 'All Pools',
  onTokenPairClick,
  ...tableCardProps
}: Omit<TableCardProps<T>, 'children'> & PoolsTableCardOptions) {
  const [searchValue, setSearchValue] = useState<string>('');

  const tokenList = useTokensWithIbcInfo(useTokens());
  const { data: tokenPairs } = useTokenPairs();
  const allPairsList = useMemo<Array<PoolTableRow>>(() => {
    return tokenPairs
      ? tokenPairs
          // find the tokens that match our known pair token IDs
          .map(([token0, token1, reserves0, reserves1]) => {
            return [
              getPairID(token0, token1),
              tokenList.find(matchTokenByDenom(token0)),
              tokenList.find(matchTokenByDenom(token1)),
              reserves0,
              reserves1,
            ];
          })
          // remove pairs with unfound tokens
          .filter<PoolTableRow>((tokenPair): tokenPair is PoolTableRow =>
            tokenPair.every(Boolean)
          )
      : [];
  }, [tokenList, tokenPairs]);

  const filteredPoolTokenList = useFilteredTokenList(tokenList, searchValue);

  const filteredPoolsList = useMemo<Array<PoolTableRow>>(() => {
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
              <th>Pool</th>
              <th>TVL</th>
              <th>Volume (7 days)</th>
              <th>Volatility (7 days)</th>
            </tr>
          </thead>
          <tbody>
            {filteredPoolsList.map((row: PoolTableRow) => {
              const [pairId, token0, token1, reserves0, reserves1] = row;
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
                  reserves0={reserves0}
                  reserves1={reserves1}
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
                No {searchValue ? 'Matching' : ''} Pools Found
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
  reserves0 = 0,
  reserves1 = 0,
  onClick,
}: {
  token0: Token;
  token1: Token;
  reserves0: number;
  reserves1: number;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}) {
  const {
    data: [price0, price1],
  } = useSimplePrice([token0, token1]);

  const [value0, value1] = useMemo<[number, number]>(() => {
    if (price0 && price1) {
      return [
        Number(getDisplayDenomAmount(token0, reserves0)) * price0 || 0,
        Number(getDisplayDenomAmount(token1, reserves1)) * price1 || 0,
      ];
    }
    return [0, 0];
  }, [price0, price1, token0, reserves0, token1, reserves1]);

  if (token0 && token1 && price0 !== undefined && price1 !== undefined) {
    return (
      <tr>
        <td className="min-width">
          <TokenPair token0={token0} token1={token1} onClick={onClick} />
        </td>
        {/* TVL col */}
        <td>{formatCurrency(value0 + value1)}</td>
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

  const tokenList = useTokensWithIbcInfo(useTokens());

  const { data: userValuedReserves } = useEstimatedUserReserves();

  const myPoolsList = useMemo<
    Array<
      [
        pairID: string,
        token0: Token,
        token1: Token,
        userValuedReserves: UserValuedReserves[]
      ]
    >
  >(() => {
    console.log('userValuedReserves', userValuedReserves);
    // collect positions into token pair groups
    const userValuedReservesMap = (userValuedReserves || []).reduce<{
      [pairID: string]: {
        token0: Token;
        token1: Token;
        userValuedReserves: UserValuedReserves[];
      };
    }>((map, userPosition) => {
      const { token0: token0Address, token1: token1Address } =
        userPosition.deposit.pair_id;
      const pairID = getPairID(token0Address, token1Address);
      const token0 = tokenList.find(matchTokenByDenom(token0Address));
      const token1 = tokenList.find(matchTokenByDenom(token1Address));
      if (pairID && token0 && token1) {
        map[pairID] = map[pairID] || {
          token0,
          token1,
          userValuedReserves: [],
        };
        map[pairID].userValuedReserves.push(userPosition);
      }
      return map;
    }, {});

    return userValuedReservesMap
      ? Object.entries(userValuedReservesMap).map<
          [string, Token, Token, UserValuedReserves[]]
        >(([pairId, { token0, token1, userValuedReserves }]) => {
          return [pairId, token0, token1, userValuedReserves];
        })
      : [];
  }, [userValuedReserves, tokenList]);

  const filteredPoolTokenList = useFilteredTokenList(tokenList, searchValue);

  const filteredPoolsList = useMemo<
    Array<[string, Token, Token, UserValuedReserves[]]>
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
              ([pairId, token0, token1, userValuedReserves]) => {
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
                    userValuedReserves={userValuedReserves}
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
                No {searchValue ? 'Matching' : ''} Pools Found
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
      userValuedReserves: Array<UserValuedReserves>;
      navigate: NavigateFunction;
    }) => void;
  };
}

const defaultActions: Actions = {
  manage: {
    title: 'Manage',
    className: 'button-light m-0',
    action: ({ navigate, token0, token1 }) => {
      return navigate(
        `/pools/${getTokenPathPart(token0)}/${getTokenPathPart(token1)}/edit`
      );
    },
  },
};

function PositionRow({
  token0,
  token1,
  userValuedReserves,
  onClick,
  actions = {},
}: {
  token0: Token;
  token1: Token;
  userValuedReserves: Array<UserValuedReserves>;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  actions?: Actions;
}) {
  const navigate = useNavigate();

  const total0 = userValuedReserves.reduce<BigNumber>((acc, estimate) => {
    return acc.plus(estimate.reserves.reserves0 || 0);
  }, new BigNumber(0));
  const total1 = userValuedReserves.reduce<BigNumber>((acc, estimate) => {
    return acc.plus(estimate.reserves.reserves1 || 0);
  }, new BigNumber(0));
  const value = userValuedReserves.reduce<BigNumber>((acc, { value }) => {
    return acc.plus(value || 0);
  }, new BigNumber(0));

  if (total0 && total1) {
    return (
      <tr>
        <td>
          <TokenPair token0={token0} token1={token1} onClick={onClick} />
        </td>
        <td>{formatCurrency(value.toNumber())}</td>
        <td>
          <span className="token-compositions">
            {formatAmount(getDisplayDenomAmount(token0, total0) || 0)}
            &nbsp;{token0.symbol}
            {' / '}
            {formatAmount(getDisplayDenomAmount(token1, total1) || 0)}
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
                        action({
                          token0,
                          token1,
                          userValuedReserves,
                          navigate,
                        });
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
  as = onClick ? 'button' : 'div',
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
          <div className="col subtext text-left">
            {token0.chain.chain_name === token1.chain.chain_name ? (
              <span className="nowrap">{token0.chain.pretty_name}</span>
            ) : (
              <>
                <span className="nowrap">{token0.chain.pretty_name} /</span>
                <span>{token1.chain.pretty_name}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </BaseElement>
  );
}
