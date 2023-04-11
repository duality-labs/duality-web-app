import { MouseEventHandler, useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import BigNumber from 'bignumber.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUp } from '@fortawesome/free-solid-svg-icons';

import TableCard from './TableCard';

import { TickInfo, useIndexerData } from '../../lib/web3/indexerProvider';
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
import { getAmountInDenom } from '../../lib/web3/utils/tokens';

const switchValues = {
  all: 'Show All',
  mine: 'My Positions',
};

export default function PoolsTableCard({
  className,
  title = 'All Pairs',
  switchValue: givenSwitchValue = 'mine',
  switchOnChange: givenSwitchOnChange,
  onTokenPairClick,
  ...props
}: {
  className?: string;
  title?: string;
  switchValue?: keyof typeof switchValues;
  switchOnChange?: React.Dispatch<
    React.SetStateAction<keyof typeof switchValues>
  >;
  onTokenPairClick?: (tokens: [token0: Token, token1: Token]) => void;
}) {
  const [searchValue, setSearchValue] = useState<string>('');

  const tokenList = useTokens();
  const { data: pairsData } = useIndexerData();
  const allPairsList = useMemo<
    Array<[string, Token, Token, undefined, TickInfo[], TickInfo[]]>
  >(() => {
    const tokenListByAddress = tokenList.reduce<{ [address: string]: Token }>(
      (acc, token) => {
        if (token.address) {
          acc[token.address] = token;
        }
        return acc;
      },
      {}
    );
    return pairsData
      ? Object.entries(pairsData)
          .map<[string, Token, Token, undefined, TickInfo[], TickInfo[]]>(
            ([pairId, { token0, token1, token0Ticks, token1Ticks }]) => {
              return [
                pairId,
                tokenListByAddress[token0],
                tokenListByAddress[token1],
                undefined,
                token0Ticks,
                token1Ticks,
              ];
            }
          )
          .filter(([, token0, token1]) => token0 && token1)
      : [];
  }, [tokenList, pairsData]);
  const shareValueMap = useShareValueMap();
  const myPoolsList = useMemo<
    Array<
      [
        string,
        Token,
        Token,
        TickShareValue[] | undefined,
        TickInfo[] | undefined,
        TickInfo[] | undefined
      ]
    >
  >(() => {
    return shareValueMap
      ? Object.entries(shareValueMap).map<
          [string, Token, Token, TickShareValue[], undefined, undefined]
        >(([pairId, shareValues]) => {
          const [{ token0, token1 }] = shareValues;
          return [pairId, token0, token1, shareValues, undefined, undefined];
        })
      : [];
  }, [shareValueMap]);

  // enforce switch state and non-interactivity if the user has no pools
  const switchValue = !myPoolsList.length ? 'all' : givenSwitchValue;
  const switchOnChange = !myPoolsList.length ? undefined : givenSwitchOnChange;
  const filteredPoolTokenList = useFilteredTokenList(tokenList, searchValue);

  const filteredPoolsList = useMemo<
    Array<
      [
        string,
        Token,
        Token,
        TickShareValue[] | undefined,
        TickInfo[] | undefined,
        TickInfo[] | undefined
      ]
    >
  >(() => {
    const tokenList = filteredPoolTokenList.map(({ token }) => token);
    const poolList = switchValue === 'mine' ? myPoolsList : allPairsList;
    return poolList.filter(([, token0, token1]) => {
      return tokenList.includes(token0) || tokenList.includes(token1);
    });
  }, [switchValue, myPoolsList, allPairsList, filteredPoolTokenList]);

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
      switchValues={switchValues}
      switchValue={switchValue}
      switchOnChange={switchOnChange}
      {...props}
    >
      {switchValue === 'all' ||
      (shareValueMap && Object.entries(shareValueMap).length > 0) ? (
        filteredPoolsList.length > 0 ? (
          <table>
            <thead>
              {switchValue === 'mine' ? (
                <tr>
                  <th>Pair</th>
                  <th>Value</th>
                  <th>Composition</th>
                  <th>Withdraw</th>
                </tr>
              ) : (
                <tr>
                  <th>Pair</th>
                  <th>TVL</th>
                  <th>Volume (7 days)</th>
                  <th>Volatility (7 days)</th>
                </tr>
              )}
            </thead>
            <tbody>
              {filteredPoolsList.map(
                ([
                  pairId,
                  token0,
                  token1,
                  shareValues,
                  token0Ticks,
                  token1Ticks,
                ]) => {
                  const onRowClick:
                    | MouseEventHandler<HTMLButtonElement>
                    | undefined = onTokenPairClick
                    ? () => onTokenPairClick([token0, token1])
                    : undefined;
                  const withdraw:
                    | MouseEventHandler<HTMLButtonElement>
                    | undefined = shareValues
                    ? () => withdrawPair(shareValues)
                    : undefined;
                  return shareValues ? (
                    // show user's positions
                    <PositionRow
                      key={pairId}
                      token0={token0}
                      token1={token1}
                      shareValues={shareValues}
                      onClick={onRowClick}
                      withdraw={withdraw}
                    />
                  ) : (
                    // show general pair data
                    <PairRow
                      key={pairId}
                      token0={token0}
                      token1={token1}
                      token0Ticks={token0Ticks}
                      token1Ticks={token1Ticks}
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

function PairRow({
  token0,
  token1,
  token0Ticks = [],
  token1Ticks = [],
  onClick,
}: {
  token0: Token;
  token1: Token;
  token0Ticks?: Array<TickInfo>;
  token1Ticks?: Array<TickInfo>;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}) {
  const {
    data: [price0, price1],
  } = useSimplePrice([token0, token1]);
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
  shareValues,
  onClick,
  withdraw,
}: {
  token0: Token;
  token1: Token;
  shareValues: Array<TickShareValue>;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  withdraw?: MouseEventHandler<HTMLButtonElement>;
}) {
  const [total0, total1] = useUserReserves(shareValues);
  const [value0, value1] = useUserReservesNominalValues(shareValues);
  if (total0 && total1) {
    return (
      <tr>
        <td>
          <TokenPair token0={token0} token1={token1} onClick={onClick} />
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
          <button type="button" onClick={withdraw} className="button nowrap">
            {[
              value0.isGreaterThan(0) && token0.display.toUpperCase(),
              value1.isGreaterThan(0) && token1.display.toUpperCase(),
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
