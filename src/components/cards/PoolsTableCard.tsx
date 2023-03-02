import { MouseEventHandler, useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import BigNumber from 'bignumber.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUp } from '@fortawesome/free-solid-svg-icons';

import TableCard from './TableCard';

import { useSimplePrice } from '../../lib/tokenPrices';
import useShareValueMap, {
  ShareValue,
  TickShareValue,
} from '../../pages/MyLiquidity/useShareValueMap';
import {
  useEditLiquidity,
  EditedTickShareValue,
} from '../../pages/MyLiquidity/useEditLiquidity';
import {
  Token,
  useFilteredTokenList,
  useTokens,
} from '../../components/TokenPicker/hooks';

import { formatAmount } from '../../lib/utils/number';

import './PoolsTableCard.scss';

export default function PoolsTableCard({
  className,
  title = 'Pools',
  ...props
}: {
  className?: string;
  title?: string;
}) {
  const [searchValue, setSearchValue] = useState<string>('');

  const tokenList = useTokens();
  const shareValueMap = useShareValueMap();

  const filteredPoolTokenList = useFilteredTokenList(tokenList, searchValue);

  const myPoolsList = useMemo<Array<[string, TickShareValue[]]>>(() => {
    const tokenList = filteredPoolTokenList.map(({ token }) => token);
    return shareValueMap
      ? Object.entries(shareValueMap).filter(([, [{ token0, token1 }]]) => {
          return tokenList.includes(token0) || tokenList.includes(token1);
        })
      : [];
  }, [shareValueMap, filteredPoolTokenList]);

  const [{ isValidating }, sendEditRequest] = useEditLiquidity();
  const withdrawPair = useCallback<
    Awaited<(shareValues: Array<TickShareValue>) => void>
  >(
    async (shareValues: Array<TickShareValue>) => {
      if (!isValidating) {
        // get relevant tick diffs
        const sharesDiff: Array<EditedTickShareValue> = shareValues.flatMap(
          (share: TickShareValue) => {
            return {
              ...share,
              // remove user's reserves if found
              tickDiff0: share.userReserves0?.negated() ?? new BigNumber(0),
              tickDiff1: share.userReserves1?.negated() ?? new BigNumber(0),
            };
          }
        );

        await sendEditRequest(sharesDiff);
      }
    },
    [isValidating, sendEditRequest]
  );

  return (
    <TableCard
      className={['pool-list-card', className].filter(Boolean).join(' ')}
      title={title}
      searchValue={searchValue}
      setSearchValue={setSearchValue}
      {...props}
    >
      {shareValueMap && Object.entries(shareValueMap).length > 0 ? (
        myPoolsList.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Pool</th>
                <th>Value</th>
                <th>Composition</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {myPoolsList.map(([pairID, shareValues]) => {
                return (
                  <PositionRow
                    key={pairID}
                    token0={shareValues[0].token0}
                    token1={shareValues[0].token1}
                    shareValues={shareValues}
                    onClick={withdrawPair}
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
        )
      ) : (
        <Link to="/liquidity" className="m-auto">
          <button className="button-primary text-medium px-4 py-4 mb-lg">
            Add Liquidity
          </button>
        </Link>
      )}
    </TableCard>
  );
}

function PositionRow({
  token0,
  token1,
  shareValues,
  onClick: givenOnClick,
}: {
  token0: Token;
  token1: Token;
  shareValues: Array<TickShareValue>;
  onClick?: (shareValues: Array<TickShareValue>) => void;
}) {
  const [total0, total1] = useUserReserves(shareValues);
  const [value0, value1] = useUserReservesNominalValues(shareValues);
  const onClick = useCallback<MouseEventHandler<HTMLButtonElement>>(() => {
    return givenOnClick?.(shareValues);
  }, [givenOnClick, shareValues]);
  if (total0 && total1) {
    return (
      <tr>
        <td>
          <>
            <div className="row gap-3 token-and-chain">
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
            </div>
          </>
        </td>
        <td>{value0 && value1 && <>${value0.plus(value1).toFixed(2)}</>}</td>
        <td>
          <span className="token-compositions">
            {formatAmount(total0.toFixed())}&nbsp;{token0.symbol}
            {' / '}
            {formatAmount(total1.toFixed())}&nbsp;{token1.symbol}
          </span>
        </td>
        <td>
          <button onClick={onClick} className="button nowrap">
            <FontAwesomeIcon icon={faArrowUp} className="mr-3" />
            Withdraw
          </button>
        </td>
      </tr>
    );
  }
  return null;
}

function useUserReserves(shareValues: Array<TickShareValue>) {
  return useMemo(
    () =>
      shareValues.reduce<[BigNumber, BigNumber]>(
        ([total0, total1], shareValue) => {
          return [
            total0.plus(shareValue.userReserves0 || 0),
            total1.plus(shareValue.userReserves1 || 0),
          ];
        },
        [new BigNumber(0), new BigNumber(0)]
      ),
    [shareValues]
  );
}

function useUserReservesNominalValues(shareValues: Array<TickShareValue>) {
  const tokens = getShareTokens(shareValues);
  const {
    data: [price0, price1],
  } = useSimplePrice(tokens);
  const [total0, total1] = useUserReserves(shareValues);
  if (price0 && price1 && total0 && total1) {
    const value0 = total0.multipliedBy(price0);
    const value1 = total1.multipliedBy(price1);
    return [value0, value1];
  }
  return [new BigNumber(0), new BigNumber(0)];
}

function getShareTokens(
  shareValues: Array<ShareValue>
): [token0: Token, token1: Token] {
  return [shareValues[0]?.token0, shareValues[0]?.token1];
}
