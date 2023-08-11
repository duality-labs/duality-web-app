import BigNumber from 'bignumber.js';
import { ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { CoinSDKType } from '@duality-labs/dualityjs/types/codegen/cosmos/base/v1beta1/coin';

import Dialog from '../Dialog/Dialog';
import TokenPicker from '../TokenPicker/TokenPicker';
import NumberInput from '../inputs/NumberInput/NumberInput';

import TableCard, { TableCardProps } from '../../components/cards/TableCard';
import useTokens from '../../lib/web3/hooks/useTokens';
import { useUserBankValues } from '../../lib/web3/hooks/useUserBankValues';
import { useFilteredTokenList } from '../../components/TokenPicker/hooks';

import { formatAmount } from '../../lib/utils/number';
import { Token, getAmountInDenom } from '../../lib/web3/utils/tokens';

import './AssetsTableCard.scss';

const keplrLogoURI =
  'https://raw.githubusercontent.com/chainapsis/keplr-wallet/master/docs/.vuepress/public/favicon-256.png';

type TokenCoin = CoinSDKType & {
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
  const allUserBankAssets = useUserBankValues();

  // define sorting rows by token value
  const sortByValue = useCallback(
    (a: Token, b: Token) => {
      return getTokenValue(b).minus(getTokenValue(a)).toNumber();
      function getTokenValue(token: Token) {
        const foundUserAsset = allUserBankAssets.find((userToken) => {
          return userToken.token === token;
        });
        return foundUserAsset?.value || new BigNumber(0);
      }
    },
    [allUserBankAssets]
  );

  // sort tokens
  const sortedList = useMemo(() => {
    return (givenTokenList || [...tokenList]).sort(sortByValue);
  }, [tokenList, givenTokenList, sortByValue]);

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
                No {!!searchValue ? 'Matching' : ''} Assets Found
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
      {showActions && (
        <td>
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
  const inputRef = useRef<HTMLInputElement>(null);

  const tokenList = useTokens();
  const [token, setToken] = useState<Token | undefined>(from || to);
  const [value, setValue] = useState('');

  return (
    <>
      <button className={className} onClick={open}>
        {children}
      </button>
      <Dialog
        isOpen={isOpen}
        onDismiss={close}
        header={<h2 className="h3">Bridge</h2>}
        initialFocusRef={inputRef}
        className="bridge-card"
      >
        <div className="col gap-lg">
          <div className="flex path-box">
            <div className="path-box__grid">
              <div className="col">
                <div className="px-4 py-sm text-muted">From</div>
              </div>
              <div className="col">
                <div className="py-sm flex">Ethereum</div>
              </div>
              <div className="col">
                <div className="px-4 py-sm text-secondary">Unconnected</div>
              </div>
              <div className="col">
                <div className="px-4 py-sm text-muted">To</div>
              </div>
              <div className="col">
                <div className="py-sm flex">CosmosHub</div>
              </div>
              <div className="col">
                <div className="px-4 py-sm flex row">
                  <div className="text-muted">Available</div>
                  <div className="text-muted ml-auto">0</div>
                </div>
              </div>
            </div>
            <div className="row px-4 pb-3">
              <div className="col">
                <TokenPicker
                  className="mt-sm gutter-l-3"
                  value={token}
                  exclusion={token}
                  onChange={setToken}
                  tokenList={tokenList}
                  showChain={false}
                />
              </div>
              <div className="col flex flex-centered">
                <NumberInput
                  type="text"
                  className={[
                    'col flex ibc-transfer-value h3 my-sm',
                    !Number(value) && 'input--zero',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  value={value}
                  placeholder="0"
                  onChange={setValue}
                  onClick={selectAll}
                  disabled={!token}
                  innerRef={inputRef}
                />
              </div>
            </div>
          </div>
          <div className="row gap-md">
            <div className="flex col">
              <button className="button-wallet">
                <div className="row gap-md">
                  <div className="col">
                    <img src={keplrLogoURI} className="logo" alt="logo" />
                  </div>
                  <div className="col">Source&nbsp;Wallet</div>
                </div>
              </button>
            </div>
            <div className="flex col">
              <button className="button-wallet">
                <div className="row gap-md">
                  <div className="col">
                    <img src={keplrLogoURI} className="logo" alt="logo" />
                  </div>
                  <div className="col">Destination&nbsp;Wallet</div>
                </div>
              </button>
            </div>
          </div>
          <div className="transaction-box my-sm p-4 col gap-md">
            <div className="row">
              <div className="col">Transfer Fee</div>
              <div className="col ml-auto">
                {Number(value) ? <>20.1 USDC</> : null}
              </div>
            </div>
            <div className="row">
              <div className="col">Estimated Time</div>
              <div className="col ml-auto">
                {Number(value) ? <>15 minutes</> : null}
              </div>
            </div>
            <div className="row">
              <div className="col">Total (est)</div>
              <div className="col ml-auto">
                {Number(value) ? <>380.1 USDC</> : null}
              </div>
            </div>
          </div>
          {token && (
            <button className="button-primary h3 p-4" disabled={!Number(value)}>
              Bridge {token?.symbol}
            </button>
          )}
        </div>
      </Dialog>
    </>
  );
}

function selectAll(e: React.MouseEvent<HTMLInputElement>) {
  e.currentTarget.select();
}
