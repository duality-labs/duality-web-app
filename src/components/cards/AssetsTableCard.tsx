import BigNumber from 'bignumber.js';
import { ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { Coin } from '@duality-labs/neutronjs/types/codegen/cosmos/base/v1beta1/coin';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';

import Dialog from '../Dialog/Dialog';

import TableCard, { TableCardProps } from '../../components/cards/TableCard';
import BridgeCard from './BridgeCard';
import AssetIcon from '../assets/AssetIcon';

import { useUserBankValues } from '../../lib/web3/hooks/useUserBankValues';
import { useFilteredTokenList } from '../../components/TokenPicker/hooks';
import { useNativeChain } from '../../lib/web3/hooks/useChains';
import { useWeb3 } from '../../lib/web3/useWeb3';

import { formatAmount, formatCurrency } from '../../lib/utils/number';
import {
  Token,
  getDisplayDenomAmount,
  getTokenId,
} from '../../lib/web3/utils/tokens';
import {
  useToken,
  useTokenByDenom,
} from '../../lib/web3/hooks/useDenomClients';
import { useDenomTrace } from '../../lib/web3/hooks/useDenomsFromChain';

import './AssetsTableCard.scss';

const { REACT_APP__BRIDGE_LINKS = '' } = import.meta.env;

const bridgeLinks: { [baseDenom: string]: string[] } = REACT_APP__BRIDGE_LINKS
  ? JSON.parse(REACT_APP__BRIDGE_LINKS)
  : {};

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
  const { address, connectWallet } = useWeb3();
  const allUserBankAssets = useUserBankValues();
  const { data: tokenByDenom } = useTokenByDenom(
    allUserBankAssets?.flatMap((asset) => asset.denom)
  );
  const tokenList = useMemo(
    () => givenTokenList || Array.from((tokenByDenom || [])?.values()),
    [givenTokenList, tokenByDenom]
  );

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

  const { data: nativeChain } = useNativeChain();

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
        getTokenChain(tokenB) - getTokenChain(tokenA) ||
        // lastly sort by symbol
        tokenA.symbol.localeCompare(tokenB.symbol)
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
        if (nativeChain && token.chain.chain_id === nativeChain.chain_id) {
          return 2;
        }
        if (token.ibc) {
          return 1;
        }
        return 0;
      }
    },
    [allUserBankAssetsByTokenId, nativeChain]
  );

  // sort tokens
  const sortedList = useMemo(() => {
    // sort by USD value
    // create new array to ensure re-rendering with new reference
    return [...tokenList].sort(sortByValue);
  }, [tokenList, sortByValue]);

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
      headerActions={
        !address && (
          <button
            className="connect-wallet button-primary p-3 px-4"
            onClick={connectWallet}
          >
            Connect Wallet
          </button>
        )
      }
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
                  token={token}
                  denom={foundUserAsset.denom}
                  amount={foundUserAsset.amount}
                  value={foundUserAsset.value}
                  showActions={showActions}
                />
              ) : (
                <AssetRow
                  key={`${token.base}-${token.chain.chain_name}`}
                  token={token}
                  denom={token.base}
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

function ExternalLink({
  className,
  href,
  children,
}: {
  className?: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <a target="_blank" rel="noreferrer" href={href} className={className}>
      {children} <FontAwesomeIcon icon={faUpRightFromSquare}></FontAwesomeIcon>
    </a>
  );
}

function AssetRow({
  denom,
  // token,
  amount,
  value,
  showActions,
}: TokenCoin & AssetsTableCardOptions) {
  const { address } = useWeb3();
  const { data: trace } = useDenomTrace(denom);
  const { data: token, isValidating } = useToken(denom);
  const { data: nativeChain } = useNativeChain();
  const singleHopIbcCounterParty =
    token?.traces &&
    token.traces.length === 1 &&
    token.traces.at(0)?.type === 'ibc' &&
    token.traces.at(0)?.counterparty;

  return token ? (
    <tr>
      <td>
        <div className="row gap-3 my-1 py-xs">
          <div className="col mt-xs">
            <AssetIcon asset={token} />
          </div>
          <div className="col flex">
            <div className="row">{token.display.toUpperCase()}</div>
            <div className="row">
              <div className="col row-lg gapx-2 subtext text-left">
                <span>
                  {token.chain.pretty_name ??
                    token.chain.chain_name
                      .split('')
                      .map((v, i) => (i > 0 ? v : v.toUpperCase()))}
                </span>
                {trace?.path && (
                  <div className="row flow-wrap">
                    {trace.path.split('/').flatMap((part, index, parts) => {
                      const port = parts[index - 1];
                      const channel = part;
                      return index % 2 === 1 ? (
                        <span className="nowrap" key={index}>
                          {index > 1 ? '' : '('}
                          {port}
                          {'/'}
                          {channel}
                          {index + 1 < parts.length ? '/' : ')'}
                        </span>
                      ) : (
                        []
                      );
                    })}
                  </div>
                )}
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
        <div className="subtext mt-1">
          {`${formatCurrency(value?.toFixed() || '', {
            maximumFractionDigits: 6,
          })}`}
        </div>
      </td>
      {showActions && nativeChain && (
        <td>
          {bridgeLinks[token.base]?.length > 0 ? (
            bridgeLinks[token.base].length === 1 ? (
              // add external link
              <div>
                <ExternalLink
                  className="button button-primary-outline nowrap mx-0"
                  href={bridgeLinks[token.base][0]}
                >
                  Bridge
                </ExternalLink>
              </div>
            ) : (
              // add external links
              <div>
                <ExternalLink
                  className="button button-primary-outline nowrap mx-0"
                  href={bridgeLinks[token.base][0]}
                >
                  Deposit
                </ExternalLink>
                <ExternalLink
                  className="button button-outline nowrap mx-0 ml-3"
                  href={bridgeLinks[token.base][1]}
                >
                  Withdraw
                </ExternalLink>
              </div>
            )
          ) : (
            // add Dialog action
            token.chain.chain_id !== nativeChain.chain_id && (
              // disable buttons if there is no known path to bridge them here
              <fieldset disabled={!address || !singleHopIbcCounterParty}>
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
            )
          )}
        </td>
      )}
    </tr>
  ) : isValidating ? (
    <tr>
      <td>Searcing...</td>
    </tr>
  ) : (
    <tr>
      <td>Not Found: {denom}</td>
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
