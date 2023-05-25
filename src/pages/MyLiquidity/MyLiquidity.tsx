import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BigNumber from 'bignumber.js';
import { CoinSDKType } from '@duality-labs/dualityjs/types/codegen/cosmos/base/v1beta1/coin';

import { useBankBalances } from '../../lib/web3/indexerProvider';
import { useWeb3 } from '../../lib/web3/useWeb3';
import { useSimplePrice } from '../../lib/tokenPrices';
import useShareValueMap, { ShareValueMap } from './useShareValueMap';

import { useFilteredTokenList } from '../../components/TokenPicker/hooks';

import useTokens from '../../lib/web3/hooks/useTokens';

import { formatAmount } from '../../lib/utils/number';

import './MyLiquidity.scss';
import { Token, getAmountInDenom } from '../../lib/web3/utils/tokens';
import TableCard from '../../components/cards/TableCard';
import PoolsTableCard from '../../components/cards/PoolsTableCard';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowDown } from '@fortawesome/free-solid-svg-icons';
import { createRpcQueryHooks } from '@duality-labs/dualityjs';
import { QueryGetUserPositionsResponseSDKType } from '@duality-labs/dualityjs/types/codegen/duality/dex/query';
import { useRpc } from '../../lib/web3/rpcQueryClient';
import {
  UserPositionDepositContext,
  useUserPositionsContext,
} from '../../lib/web3/hooks/useUserShares';

function matchTokenDenom(denom: string) {
  return (token: Token) =>
    !!token.denom_units.find((unit) => unit.denom === denom);
}

type TokenCoin = CoinSDKType & {
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
  shareValueMap?: ShareValueMap;
  balances?: CoinSDKType[];
  setSelectedTokens: React.Dispatch<
    React.SetStateAction<[Token, Token] | undefined>
  >;
}) {
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

  const allUserTokenPricesMap = useMemo(() => {
    return allUserTokensList.reduce<{
      [tokenAddress: string]: number | undefined;
    }>((acc, token, index) => {
      if (token.address) {
        acc[token.address] = allUserTokenPrices[index];
      }
      return acc;
    }, {});
  }, [allUserTokensList, allUserTokenPrices]);

  const { address } = useWeb3();
  const rpc = useRpc();
  const queryHooks = createRpcQueryHooks({ rpc });

  const { useGetUserPositions } = queryHooks.dualitylabs.duality.dex;

  const { data: { UserPositions: userPositions } = {} } =
    useGetUserPositions<QueryGetUserPositionsResponseSDKType>({
      request: { address: address || '' },
    });
  const poolDeposits = userPositions?.PoolDeposits;

  const allUserPositionsContext = useUserPositionsContext();

  interface ShareValueDepositContext extends UserPositionDepositContext {
    value?: BigNumber;
  }
  const tokenList = useTokens();

  // compute the value of all the user's shares
  const allUserSharesValues = useMemo(() => {
    return (poolDeposits || []).flatMap<ShareValueDepositContext>((deposit) => {
      return allUserPositionsContext.map(({ deposit, context }) => {
        const {
          reserves,
          sharesOwned,
          totalShares,
          token: tokenAddress,
        } = context;
        // what is the price per token?
        const token = tokenList.find(({ address }) => address === tokenAddress);
        const price = allUserTokenPricesMap[tokenAddress];
        if (token && price && !isNaN(price)) {
          // how many tokens does the user have?
          const reserve = reserves
            .multipliedBy(sharesOwned)
            .dividedBy(totalShares);
          const amount = getAmountInDenom(
            token,
            reserve,
            token.address,
            token.display
          );
          // how much are those tokens worth?
          const value = new BigNumber(amount || 0).multipliedBy(price);
          return { deposit, context, value };
        }
        return { deposit, context };
      });
    });
  }, [tokenList, poolDeposits, allUserPositionsContext, allUserTokenPricesMap]);

  const allUserSharesValue = useMemo(() => {
    return allUserSharesValues.reduce<BigNumber>((acc, { value }) => {
      return value ? acc.plus(value) : acc;
    }, new BigNumber(0));
  }, [allUserSharesValues]);

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

  // show loken list cards
  return (
    <div className="my-liquidity-page container col flex gap-6 py-6">
      <div className="home-hero-section row gapx-4 gapy-5 flow-wrap">
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
                  <th>Deposit</th>
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
          <PoolsTableCard className="flex" title="My Pools" />
        </div>
      </div>
    </div>
  );
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
      <td>
        <div>
          {`${formatAmount(
            getAmountInDenom(token, amount, token.address, token.display) || '',
            {
              useGrouping: true,
            }
          )}`}
        </div>
        <div className="subtext">
          {`$${formatAmount(value?.toFixed() || '', {
            useGrouping: true,
          })}`}
        </div>
      </td>
      <td>
        <Link to="/">
          <button className="button text-action-button nowrap">
            {token.display.toUpperCase()}
            <FontAwesomeIcon icon={faArrowDown} className="ml-3" />
          </button>
        </Link>
      </td>
    </tr>
  );
}
