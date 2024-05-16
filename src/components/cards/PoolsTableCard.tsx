import { MouseEventHandler, ReactNode, useMemo, useState } from 'react';
import { NavigateFunction, useNavigate } from 'react-router-dom';

import BigNumber from 'bignumber.js';

import TableCard, { TableCardProps } from './TableCard';
import TokenPairInput from '../inputs/TokenPairInput';

import { useSimplePrice } from '../../lib/tokenPrices';
import { useFilteredTokenList } from '../../components/TokenPicker/hooks';
import { useStatVolatility, useStatVolume } from '../stats/hooks';

import {
  formatAmount,
  formatCurrency,
  formatUnavailableStates,
} from '../../lib/utils/number';
import { Token, getDisplayDenomAmount } from '../../lib/web3/utils/tokens';
import useTokenPairs, {
  ValuedTokenPair,
  useValuedTokenPairs,
} from '../../lib/web3/hooks/useTokenPairs';
import { useTokenByDenom } from '../../lib/web3/hooks/useDenomClients';
import { getPairID } from '../../lib/web3/utils/pairs';
import {
  UserValuedReserves,
  useEstimatedUserReserves,
  useValuedUserReserves,
} from '../../lib/web3/hooks/useUserReserves';
import {
  UserPair,
  useUserValuedPairs,
} from '../../lib/web3/hooks/useUserPairs';
import { filterToTokenPairsWhitelist } from '../../lib/web3/hooks/useDenomsFromRegistry';

import './PoolsTableCard.scss';

interface PoolsTableCardOptions {
  showUnknownTokens?: boolean;
  onTokenPairClick?: (tokens: [token0: Token, token1: Token]) => void;
  userPositionActions?: Actions;
}

export default function PoolsTableCard<T extends string | number>({
  className,
  title = 'Dex Pools',
  onTokenPairClick,
  showUnknownTokens = false,
  ...tableCardProps
}: Omit<TableCardProps<T>, 'children'> & PoolsTableCardOptions) {
  const [searchValue, setSearchValue] = useState<string>('');

  const { data: tokenPairs } = useTokenPairs();
  const { data: valuedTokenPairs } = useValuedTokenPairs(tokenPairs);
  const { data: tokenByDenom } = useTokenByDenom(
    valuedTokenPairs?.flatMap(({ denom0, denom1 }) => [denom0, denom1])
  );
  const tokenList = useMemo(() => {
    const tokenList = Array.from((tokenByDenom || [])?.values());
    return showUnknownTokens
      ? tokenList
      : tokenList.filter((token) => !!token.chain.chain_id);
  }, [tokenByDenom, showUnknownTokens]);

  const allPairsList = useMemo<Array<ValuedTokenPair>>(() => {
    return valuedTokenPairs
      ? valuedTokenPairs
          // find the tokens that match our known pair token IDs
          .filter((pair) => {
            const { token0, token1 } = pair;
            if (token0 && token1) {
              // show unknown tokens or test that both tokens are known
              if (
                showUnknownTokens ||
                (token0.chain.chain_id && token1.chain.chain_id)
              ) {
                return true;
              }
            }
          })
      : [];
  }, [showUnknownTokens, valuedTokenPairs]);

  const filteredPoolTokenList = useFilteredTokenList(tokenList, searchValue);
  const filteredPoolsList = useMemo<Array<ValuedTokenPair>>(() => {
    return (
      allPairsList
        .filter(({ token0, token1 }) => {
          return (
            filteredPoolTokenList.includes(token0) ||
            filteredPoolTokenList.includes(token1)
          );
        })
        .filter(filterToTokenPairsWhitelist || ((v) => v))
        // sort by descending token pair values
        .sort((a, b) => b.value - a.value)
    );
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
              <th style={{ width: '25%' }}>Pool</th>
              <th style={{ width: '25%' }}>TVL</th>
              <th style={{ width: '25%' }}>Volume (24h)</th>
              <th style={{ width: '25%' }}>Volatility (10 days)</th>
            </tr>
          </thead>
          <tbody>
            {filteredPoolsList.map((pair: ValuedTokenPair) => {
              const { token0, token1, reserves0, reserves1 } = pair;
              const onRowClick:
                | MouseEventHandler<HTMLButtonElement>
                | undefined = onTokenPairClick
                ? () => onTokenPairClick([token0, token1])
                : undefined;
              return (
                // show general pair data
                <PairRow
                  key={getPairID(pair.denom0, pair.denom1)}
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
    isValidating,
    data: [price0, price1],
  } = useSimplePrice([token0, token1]);

  const tvl = useMemo<number | undefined | null>(() => {
    if (price0 && price1) {
      const value0 = Number(getDisplayDenomAmount(token0, reserves0)) * price0;
      const value1 = Number(getDisplayDenomAmount(token1, reserves1)) * price1;
      return (value0 || 0) + (value1 || 0);
    }
    // return null only if prices are non-zero and the request is not validating
    return !isValidating ? null : undefined;
  }, [price0, price1, isValidating, token0, reserves0, token1, reserves1]);

  const [, volume] = useStatVolume(token0, token1);
  const [, volatility] = useStatVolatility(token0, token1);

  if (token0 && token1) {
    return (
      <tr>
        <td className="min-width">
          <TokenPairInput tokenA={token0} tokenB={token1} onClick={onClick} />
        </td>
        {/* TVL col */}
        <td>{formatUnavailableStates(tvl, formatCurrency)}</td>
        {/* Volume (24 hours) col */}
        <td>{formatUnavailableStates(volume, formatCurrency)}</td>
        {/* Volatility (7 days) col */}
        <td>{formatUnavailableStates(volatility, formatAmount)}</td>
      </tr>
    );
  }
  return null;
}

export function MyPoolsTableCard<T extends string | number>({
  className,
  title = 'My Pools',
  onTokenPairClick,
  userPositionActions,
  ...tableCardProps
}: Omit<TableCardProps<T>, 'children'> & PoolsTableCardOptions) {
  const [searchValue, setSearchValue] = useState<string>('');

  const { data: userReserves } = useEstimatedUserReserves();
  const { data: userValuedReserves } = useValuedUserReserves(userReserves);
  const { data: userValuedPairsList } = useUserValuedPairs(userValuedReserves);
  const { data: tokenByDenom } = useTokenByDenom(
    userReserves?.flatMap(({ deposit }) => [
      deposit.pair_id.token0,
      deposit.pair_id.token1,
    ])
  );
  const tokenList = useMemo(
    () => Array.from((tokenByDenom || [])?.values()),
    [tokenByDenom]
  );

  const filteredPoolTokenList = useFilteredTokenList(tokenList, searchValue);
  const filteredPoolsList = useMemo<UserPair<UserValuedReserves>[]>(() => {
    return (
      (userValuedPairsList || [])
        // filter to tokens that match the search query
        .filter(({ token0, token1 }) => {
          return (
            filteredPoolTokenList.includes(token0) ||
            filteredPoolTokenList.includes(token1)
          );
        })
        // sort by descending value
        .sort((a, b) => b.value - a.value)
    );
  }, [userValuedPairsList, filteredPoolTokenList]);

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
              <th style={{ width: '20%' }}>Pool</th>
              <th style={{ width: '20%' }}>Value</th>
              <th style={{ width: '40%' }}>Composition</th>
              {Object.keys(userPositionActions || {}).length > 0 && (
                <th style={{ width: '20%' }}>Action</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredPoolsList.map(
              ({ pairId, token0, token1, userReserves }) => {
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
                    userValuedReserves={userReserves}
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
          <TokenPairInput tokenA={token0} tokenB={token1} onClick={onClick} />
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
