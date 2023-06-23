import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BigNumber from 'bignumber.js';
import { CoinSDKType } from '@duality-labs/dualityjs/types/codegen/cosmos/base/v1beta1/coin';

import { useBankBalances } from '../../lib/web3/indexerProvider';
import { useWeb3 } from '../../lib/web3/useWeb3';
import { useUserPositionsShareValue } from '../../lib/web3/hooks/useUserShareValues';
import {
  useUserBankValue,
  useUserBankValues,
} from '../../lib/web3/hooks/useUserBankValues';

import { useFilteredTokenList } from '../../components/TokenPicker/hooks';

import useTokens from '../../lib/web3/hooks/useTokens';

import { formatAmount } from '../../lib/utils/number';

import './MyLiquidity.scss';
import { Token, getAmountInDenom } from '../../lib/web3/utils/tokens';
import TableCard from '../../components/cards/TableCard';
import PoolsTableCard from '../../components/cards/PoolsTableCard';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowDown } from '@fortawesome/free-solid-svg-icons';

type TokenCoin = CoinSDKType & {
  token: Token;
  value: BigNumber | undefined;
};

export default function MyLiquidity() {
  const { wallet, connectWallet } = useWeb3();
  const { data: balances } = useBankBalances();
  const tokenList = useTokens();

  const allUserSharesValue = useUserPositionsShareValue();
  const allUserBankAssets = useUserBankValues();
  const allUserBankValue = useUserBankValue();

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
    <div className="my-liquidity-page container col flex gap-5 py-6">
      <div className="row gap-5">
        <div className="col">
          <h1 className="h1 hero-text">Portfolio</h1>
        </div>
        {!wallet && (
          <div className="col flex-centered mt-2 pt-1">
            <button
              className="connect-wallet button-primary p-3 px-4"
              onClick={connectWallet}
            >
              Connect Wallet
            </button>
          </div>
        )}
      </div>
      <div className="page-card">
        <table className="hero-table simple-table gutter-b-1">
          <thead>
            <tr>
              <th style={{ width: '35%' }}>Total Assets</th>
              <th style={{ width: '35%' }}>Position Value</th>
              <th style={{ width: '25%' }}>Earned Incentives</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                {wallet
                  ? `$${allUserBankValue.toNumber().toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  : '-'}
              </td>
              <td>
                {wallet
                  ? `$${allUserSharesValue.toNumber().toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  : '-'}
              </td>
              <td>{wallet ? '$0' : '-'}</td>
            </tr>
          </tbody>
        </table>
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
