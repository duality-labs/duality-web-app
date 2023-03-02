import { MouseEventHandler, useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BigNumber from 'bignumber.js';
import { Coin } from '@cosmjs/launchpad';

import { useBankBalances } from '../../lib/web3/indexerProvider';
import { useWeb3 } from '../../lib/web3/useWeb3';
import { useSimplePrice } from '../../lib/tokenPrices';
import useShareValueMap, {
  ShareValue,
  TickShareValue,
  TickShareValueMap,
} from './useShareValueMap';

import {
  Token,
  useFilteredTokenList,
  useTokens,
} from '../../components/TokenPicker/hooks';

import { formatAmount } from '../../lib/utils/number';

import './MyLiquidity.scss';
import { getAmountInDenom } from '../../lib/web3/utils/tokens';
import { EditedTickShareValue, useEditLiquidity } from './useEditLiquidity';
import TableCard from '../../components/cards/TableCard';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUp } from '@fortawesome/free-solid-svg-icons';

const keplrLogoURI =
  'https://raw.githubusercontent.com/chainapsis/keplr-wallet/master/docs/.vuepress/public/favicon-256.png';

function matchTokenDenom(denom: string) {
  return (token: Token) =>
    !!token.denom_units.find((unit) => unit.denom === denom);
}

type TokenCoin = Coin & {
  token: Token;
  value: BigNumber | undefined;
};

export default function MyLiquidity() {
  const { wallet } = useWeb3();
  const { data: balances } = useBankBalances();

  const [, setSelectedTokens] = useState<[Token, Token]>();

  const shareValueMap = useShareValueMap();

  // show connect page
  if (!wallet) {
    return (
      <div className="no-liquidity col">
        <h3 className="h2 mb-4 text-center"> No liquidity positions found</h3>
        <Link to="/liquidity">
          <button className="button button-info add-liquidity p-3 px-4">
            Add new liquidity
          </button>
        </Link>
      </div>
    );
  }

  return (
    <ShareValuesPage
      shareValueMap={shareValueMap}
      balances={balances}
      setSelectedTokens={setSelectedTokens}
    />
  );
}

function ShareValuesPage({
  shareValueMap,
  balances = [],
  setSelectedTokens,
}: {
  shareValueMap?: TickShareValueMap;
  balances?: Coin[];
  setSelectedTokens: React.Dispatch<
    React.SetStateAction<[Token, Token] | undefined>
  >;
}) {
  const { address } = useWeb3();

  const allUserSharesTokensList = useMemo<Token[]>(() => {
    // collect all tokens noted in each share
    const list = Object.values(shareValueMap || {}).reduce<Token[]>(
      (result, shareValues) => {
        shareValues.forEach((shareValue) => {
          result.push(shareValue.token0, shareValue.token1);
        });
        return result;
      },
      []
    );
    // return unique tokens
    return Array.from(new Set(list));
  }, [shareValueMap]);

  const allTokensList = useTokens();
  const allUserBankTokensList = useMemo<Token[]>(() => {
    return (balances || []).reduce<Token[]>((result, balance) => {
      const token = allTokensList.find(matchTokenDenom(balance.denom));
      if (token) {
        result.push(token);
      }
      return result;
    }, []);
  }, [balances, allTokensList]);

  const allUserTokensList = useMemo(() => {
    return [...allUserSharesTokensList, ...allUserBankTokensList];
  }, [allUserSharesTokensList, allUserBankTokensList]);

  const { data: allUserTokenPrices } = useSimplePrice(allUserTokensList);

  const allUserSharesValue = Object.values(shareValueMap || {}).reduce(
    (result, shareValues) => {
      const sharePairValue = shareValues.reduce((result2, shareValue) => {
        if (shareValue.userReserves0?.isGreaterThan(0)) {
          const token0Index = allUserTokensList.indexOf(shareValue.token0);
          result2 = result2.plus(
            shareValue.userReserves0.multipliedBy(
              allUserTokenPrices[token0Index] || 0
            )
          );
        }
        if (shareValue.userReserves1?.isGreaterThan(0)) {
          const token1Index = allUserTokensList.indexOf(shareValue.token1);
          result2 = result2.plus(
            shareValue.userReserves1.multipliedBy(
              allUserTokenPrices[token1Index] || 0
            )
          );
        }
        return result2;
      }, new BigNumber(0));
      return result.plus(sharePairValue);
    },
    new BigNumber(0)
  );

  const allUserBankAssets = useMemo<Array<TokenCoin>>(() => {
    return (balances || [])
      .map(({ amount, denom }) => {
        const tokenIndex = allUserTokensList.findIndex(matchTokenDenom(denom));
        const token = allUserTokensList[tokenIndex] as Token | undefined;
        const price = allUserTokenPrices[tokenIndex];
        const value =
          token &&
          new BigNumber(
            getAmountInDenom(token, amount, denom, token.display) || 0
          ).multipliedBy(price || 0);
        return token ? { amount, denom, token, value } : null;
      })
      .filter((v): v is TokenCoin => !!v);
  }, [balances, allUserTokensList, allUserTokenPrices]);

  const allUserBankValue = useMemo(
    () =>
      (allUserBankAssets || []).reduce((result, { value }) => {
        if (!value) return result;
        return result.plus(value);
      }, new BigNumber(0)),
    [allUserBankAssets]
  );

  const [selectedAssetList, setSelectedAssetList] = useState<
    'my-assets' | 'all-assets'
  >('my-assets');

  const [searchValue, setSearchValue] = useState<string>('');

  const tokenList = useTokens();
  const userList = useMemo(() => {
    return balances
      ? tokenList.filter((token) =>
          balances.find((balance) =>
            token.denom_units.find((token) => token.denom === balance.denom)
          )
        )
      : [];
  }, [tokenList, balances]);

  // update the filtered list whenever the query or the list changes
  const filteredList = useFilteredTokenList(
    selectedAssetList === 'my-assets' ? userList : tokenList,
    searchValue
  );

  const [searchPoolValue, setSearchPoolValue] = useState<string>('');

  const filteredPoolTokenList = useFilteredTokenList(
    tokenList,
    searchPoolValue
  );

  const myPoolsList = useMemo<Array<[string, TickShareValue[]]>>(() => {
    const tokenList = filteredPoolTokenList.map(({ token }) => token);
    return shareValueMap
      ? Object.entries(shareValueMap).filter(([, [{ token0, token1 }]]) => {
          return tokenList.includes(token0) || tokenList.includes(token1);
        })
      : [];
  }, [shareValueMap, filteredPoolTokenList]);

  const [{ isValidating }, sendEditRequest] = useEditLiquidity();
  const withdrawPair = useCallback(
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

  // show loken list cards
  return (
    <div className="my-liquidity-page container col flex gap-6 py-6">
      <div className="home-hero-section row gapx-4 gapy-5 flow-wrap">
        <div className="home-hero-section__left col flex">
          <div className="home-hero-section__top-line row flex flex-centered gap-3">
            <div className="col">
              <img src={keplrLogoURI} className="logo mr-3" alt="logo" />
            </div>
            <div className="col flex home-hero-section__name span-truncate">
              <span>{address}</span>&nbsp;
            </div>
          </div>
        </div>
        <div className="hero-card ml-auto grid gapx-5 gapy-3 p-4">
          <h2 className="hero-card__hero-title">Portfolio Value</h2>
          <h3 className="hero-card__hero-title">My Liquidity</h3>
          <h3 className="hero-card__hero-title">Available Tokens</h3>
          <div className="hero-card__hero-value">
            $
            {allUserSharesValue
              .plus(allUserBankValue)
              .toNumber()
              .toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
          </div>
          <div className="hero-card__hero-value">
            $
            {allUserSharesValue.toNumber().toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="hero-card__hero-value">
            $
            {allUserBankValue.toNumber().toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
      </div>
      <div className="row flex gapx-4 gapy-5 flow-wrap">
        <div className="col flex">
          <TableCard
            className="asset-list-card flex"
            title="Assets"
            switchValues={useMemo(
              () => ({
                'my-assets': 'My Assets',
                'all-assets': 'All Assets',
              }),
              []
            )}
            switchValue={selectedAssetList}
            switchOnChange={setSelectedAssetList}
            searchValue={searchValue}
            setSearchValue={setSearchValue}
          >
            <table>
              <thead>
                <tr>
                  <th>Token + Chain</th>
                  <th>Balance</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.length > 0 ? (
                  filteredList.map(({ chain, symbol, token }) => {
                    const foundUserAsset = allUserBankAssets.find(
                      (userToken) => {
                        return userToken.token === token;
                      }
                    );
                    return foundUserAsset ? (
                      <AssetRow
                        key={`${token.base}-${token.chain.chain_name}`}
                        {...foundUserAsset}
                        token={token}
                        amount={foundUserAsset.amount}
                        value={foundUserAsset.value}
                      />
                    ) : (
                      <AssetRow
                        key={`${token.base}-${token.chain.chain_name}`}
                        token={token}
                        denom={''}
                        amount="0"
                        value={new BigNumber(0)}
                      />
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={3} align="center">
                      No {!!searchValue ? 'Matching' : ''} Assets Found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableCard>
        </div>
        <div className="col flex">
          <TableCard
            className="pool-list-card flex"
            title="My Pools"
            searchValue={searchPoolValue}
            setSearchValue={setSearchPoolValue}
          >
            {shareValueMap && Object.entries(shareValueMap).length > 0 ? (
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
                  {myPoolsList.length > 0 ? (
                    myPoolsList.map(([pairID, shareValues]) => {
                      return (
                        <PositionRow
                          key={pairID}
                          token0={shareValues[0].token0}
                          token1={shareValues[0].token1}
                          shareValues={shareValues}
                          onClick={withdrawPair}
                        />
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={3} align="center">
                        No {!!searchValue ? 'Matching' : ''} Pools Found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <Link to="/liquidity" className="m-auto">
                <button className="button-primary text-medium px-4 py-4 mb-lg">
                  Add Liquidity
                </button>
              </Link>
            )}
          </TableCard>
        </div>
      </div>
    </div>
  );
}

function getShareTokens(
  shareValues: Array<ShareValue>
): [token0: Token, token1: Token] {
  return [shareValues[0]?.token0, shareValues[0]?.token1];
}

// todo: use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function useTotalReserves(shareValues: Array<TickShareValue>) {
  return useMemo(
    () =>
      shareValues.reduce<[BigNumber, BigNumber]>(
        ([total0, total1], shareValue) => {
          return [
            total0.plus(shareValue.tick0.reserve0 || 0),
            total1.plus(shareValue.tick1.reserve1 || 0),
          ];
        },
        [new BigNumber(0), new BigNumber(0)]
      ),
    [shareValues]
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

function AssetRow({ token, amount, value }: TokenCoin) {
  return (
    <tr>
      <td>
        <div className="row gap-3 token-and-chain">
          <div className="col flex-centered">
            <img
              className="token-logo"
              src={token.logo_URIs?.svg ?? token.logo_URIs?.png}
              alt={`${token.symbol} logo`}
            />
          </div>
          <div className="col">
            <div className="row">
              <div className="col token-denom">
                {token.display.toUpperCase()}
              </div>
            </div>
            <div className="row">
              <div className="col subtext">
                {token.chain.chain_name
                  .split('')
                  .map((v, i) => (i > 0 ? v : v.toUpperCase()))}
              </div>
            </div>
          </div>
        </div>
      </td>
      <td>{`${formatAmount(
        getAmountInDenom(token, amount, token.address, token.display) || '',
        {
          useGrouping: true,
        }
      )}`}</td>
      <td>{`$${formatAmount(value?.toFixed() || '', {
        useGrouping: true,
      })}`}</td>
    </tr>
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
