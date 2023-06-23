import BigNumber from 'bignumber.js';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowDown } from '@fortawesome/free-solid-svg-icons';
import { CoinSDKType } from '@duality-labs/dualityjs/types/codegen/cosmos/base/v1beta1/coin';

import TableCard from '../../components/cards/TableCard';
import useTokens from '../../lib/web3/hooks/useTokens';
import { useBankBalances } from '../../lib/web3/indexerProvider';
import { useUserBankValues } from '../../lib/web3/hooks/useUserBankValues';
import { useFilteredTokenList } from '../../components/TokenPicker/hooks';

import { formatAmount } from '../../lib/utils/number';
import { Token, getAmountInDenom } from '../../lib/web3/utils/tokens';

import './AssetsTableCard.scss';

type TokenCoin = CoinSDKType & {
  token: Token;
  value: BigNumber | undefined;
};

export default function AssetsTableCard() {
  const { data: balances } = useBankBalances();
  const tokenList = useTokens();
  const allUserBankAssets = useUserBankValues();

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

  return (
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
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredList.length > 0 ? (
            filteredList.map(({ chain, symbol, token }) => {
              const foundUserAsset = allUserBankAssets.find((userToken) => {
                return userToken.token === token;
              });
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
