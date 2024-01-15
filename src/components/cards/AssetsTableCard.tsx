import BigNumber from 'bignumber.js';
import { ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { Coin } from '@duality-labs/dualityjs/types/codegen/cosmos/base/v1beta1/coin';

import Dialog from '../Dialog/Dialog';

import TableCard, { TableCardProps } from '../../components/cards/TableCard';
import useTokens, {
  useTokensWithIbcInfo,
} from '../../lib/web3/hooks/useTokens';
import BridgeCard from './BridgeCard';
import { useUserBankValues } from '../../lib/web3/hooks/useUserBankValues';
import { useFilteredTokenList } from '../../components/TokenPicker/hooks';
import { nativeChain } from '../../lib/web3/hooks/useChains';

import { formatAmount, formatCurrency } from '../../lib/utils/number';
import {
  Token,
  getDisplayDenomAmount,
  getTokenId,
} from '../../lib/web3/utils/tokens';

import './AssetsTableCard.scss';

type TokenCoin = Coin & {
  token: Token;
  value: BigNumber | undefined;
};
interface AssetsTableCardOptions {
  tokenList?: Token[];
  showActions?: boolean;
}

export default function AssetsTableCard({
  showActions,
  tokenList: givenTokenList,
  ...tableCardProps
}: AssetsTableCardOptions & Partial<TableCardProps<string>>) {
  const tokenList = useTokens();
  const tokenListWithIBC = useTokensWithIbcInfo(givenTokenList || tokenList);
  const allUserBankAssets = useUserBankValues();

  const allUserBankAssetsByTokenId = useMemo(() => {
    return allUserBankAssets.reduce<{ [symbol: string]: TokenCoin }>(
      (acc, asset) => {
        const symbol = getTokenId(asset.token);
        if (symbol) {
          acc[symbol] = asset;
        }
        return acc;
      },
      {}
    );
  }, [allUserBankAssets]);

  // define sorting rows by token value
  const sortByValue = useCallback(
    (tokenA: Token, tokenB: Token) => {
      const a = getTokenId(tokenA) || '';
      const b = getTokenId(tokenB) || '';
      // sort first by value
      return (
        getTokenValue(b).minus(getTokenValue(a)).toNumber() ||
        // if value is equal, sort by amount
        getTokenAmount(b).minus(getTokenAmount(a)).toNumber() ||
        // if amount is equal, sort by local chain
        getTokenChain(tokenB) - getTokenChain(tokenA)
      );
      function getTokenValue(id: string) {
        const foundUserAsset = allUserBankAssetsByTokenId[id];
        return foundUserAsset?.value || new BigNumber(0);
      }
      function getTokenAmount(id: string) {
        const foundUserAsset = allUserBankAssetsByTokenId[id];
        return new BigNumber(foundUserAsset?.amount || 0);
      }
      function getTokenChain(token: Token) {
        if (token.chain.chain_id === nativeChain.chain_id) {
          return 2;
        }
        if (token.ibc) {
          return 1;
        }
        return 0;
      }
    },
    [allUserBankAssetsByTokenId]
  );

  // sort tokens
  const sortedList = useMemo(() => {
    return tokenListWithIBC.sort(sortByValue);
  }, [tokenListWithIBC, sortByValue]);

  const [searchValue, setSearchValue] = useState<string>('');

  // update the filtered list whenever the query or the list changes
  const filteredList = useFilteredTokenList(sortedList, searchValue);

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
      searchValue={searchValue}
      setSearchValue={setSearchValue}
      {...tableCardProps}
    >
      <table>
        <thead>
          <tr>
            <th>Token + Chain</th>
            <th>Balance</th>
            {showActions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {filteredList.length > 0 ? (
            filteredList.map(({ token }) => {
              const id = getTokenId(token) || '';
              const foundUserAsset = allUserBankAssetsByTokenId[id];
              return foundUserAsset ? (
                <AssetRow
                  key={`${token.base}-${token.chain.chain_name}`}
                  {...foundUserAsset}
                  token={token}
                  amount={foundUserAsset.amount}
                  value={foundUserAsset.value}
                  showActions={showActions}
                />
              ) : (
                <AssetRow
                  key={`${token.base}-${token.chain.chain_name}`}
                  token={token}
                  denom={''}
                  amount="0"
                  value={new BigNumber(0)}
                  showActions={showActions}
                />
              );
            })
          ) : (
            <tr>
              <td colSpan={3} align="center">
                No {searchValue ? 'Matching' : ''} Assets Found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </TableCard>
  );
}

function AssetRow({
  token,
  amount,
  value,
  showActions,
}: TokenCoin & AssetsTableCardOptions) {
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
                {token.chain.pretty_name ??
                  token.chain.chain_name
                    .split('')
                    .map((v, i) => (i > 0 ? v : v.toUpperCase()))}
              </div>
            </div>
          </div>
        </div>
      </td>
      <td>
        <div>
          {`${formatAmount(getDisplayDenomAmount(token, amount) || '', {
            useGrouping: true,
          })}`}
        </div>
        <div className="subtext">
          {`${formatCurrency(value?.toFixed() || '', {
            maximumFractionDigits: 6,
          })}`}
        </div>
      </td>
      {showActions && (
        <td>
          {token.chain.chain_id !== nativeChain.chain_id && (
            // disable buttons if there is no known path to bridge them here
            <fieldset disabled={!token.ibc}>
              <BridgeButton
                className="button button-primary-outline nowrap mx-0"
                from={token}
              >
                Deposit
              </BridgeButton>
              <BridgeButton
                className="button button-outline nowrap mx-0 ml-3"
                to={token}
              >
                Withdraw
              </BridgeButton>
            </fieldset>
          )}
        </td>
      )}
    </tr>
  );
}

function BridgeButton({
  className,
  from,
  to,
  children,
}: {
  className: string;
  from?: Token;
  to?: Token;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  return (
    <>
      <button className={className} onClick={open}>
        {children}
      </button>
      {isOpen && (
        <BridgeDialog isOpen={isOpen} setIsOpen={close} from={from} to={to} />
      )}
    </>
  );
}

function BridgeDialog({
  from,
  to,
  isOpen,
  setIsOpen,
}: {
  from?: Token;
  to?: Token;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const close = useCallback(() => setIsOpen(false), [setIsOpen]);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Dialog
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      header={<h2 className="h3">Bridge</h2>}
      initialFocusRef={inputRef}
      className="bridge-card"
    >
      <BridgeCard from={from} to={to} inputRef={inputRef} onSuccess={close} />
    </Dialog>
  );
}
