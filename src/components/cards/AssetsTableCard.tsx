import BigNumber from 'bignumber.js';
import Long from 'long';
import { ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { CoinSDKType } from '@duality-labs/dualityjs/types/codegen/cosmos/base/v1beta1/coin';
import { Chain } from '@chain-registry/types';
import { coin } from '@cosmjs/stargate';

import Dialog from '../Dialog/Dialog';
import TokenPicker from '../TokenPicker/TokenPicker';
import NumberInput from '../inputs/NumberInput/NumberInput';

import TableCard, { TableCardProps } from '../../components/cards/TableCard';
import useTokens, {
  useTokensWithIbcInfo,
} from '../../lib/web3/hooks/useTokens';
import useBridge from '../../pages/Bridge/useBridge';
import { useWeb3 } from '../../lib/web3/useWeb3';
import { useUserBankValues } from '../../lib/web3/hooks/useUserBankValues';
import { useFilteredTokenList } from '../../components/TokenPicker/hooks';
import {
  dualityChain,
  useChainAddress,
  useIbcOpenTransfers,
  useRemoteChainBankBalance,
  useRemoteChainBlockTime,
  useRemoteChainFees,
  useRemoteChainRestEndpoint,
} from '../../lib/web3/hooks/useChains';

import { minutes, nanoseconds } from '../../lib/utils/time';
import { formatAddress } from '../../lib/web3/utils/address';
import { formatAmount } from '../../lib/utils/number';
import { Token, getAmountInDenom } from '../../lib/web3/utils/tokens';

import './AssetsTableCard.scss';

const defaultTimeout = 30 * minutes;

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
  const tokenListWithIBC = useTokensWithIbcInfo(givenTokenList || tokenList);
  const allUserBankAssets = useUserBankValues();

  // define sorting rows by token value
  const sortByValue = useCallback(
    (a: Token, b: Token) => {
      // sort first by value
      return (
        getTokenValue(b).minus(getTokenValue(a)).toNumber() ||
        // if value is equal, sort by amount
        getTokenAmount(b).minus(getTokenAmount(a)).toNumber() ||
        // if amount is equal, sort by local chain
        getTokenChain(b) - getTokenChain(a)
      );
      function getTokenValue(token: Token) {
        const foundUserAsset = allUserBankAssets.find((userToken) => {
          return (
            userToken.token.address === token.address &&
            userToken.token.chain.chain_id === token.chain.chain_id
          );
        });
        return foundUserAsset?.value || new BigNumber(0);
      }
      function getTokenAmount(token: Token) {
        const foundUserAsset = allUserBankAssets.find((userToken) => {
          return (
            userToken.token.address === token.address &&
            userToken.token.chain.chain_id === token.chain.chain_id
          );
        });
        return new BigNumber(foundUserAsset?.amount || 0);
      }
      function getTokenChain(token: Token) {
        if (token.chain.chain_id === dualityChain.chain_id) {
          return 2;
        }
        if (token.ibc) {
          return 1;
        }
        return 0;
      }
    },
    [allUserBankAssets]
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
            filteredList.map(({ chain, symbol, token }) => {
              const foundUserAsset = allUserBankAssets.find((userToken) => {
                return (
                  userToken.token.address === token.address &&
                  userToken.token.chain.chain_id === token.chain.chain_id
                );
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
          {token.chain.chain_id !== dualityChain.chain_id && (
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

  const tokenList = useTokens();
  const [token, setToken] = useState<Token | undefined>(from || to);
  const [value, setValue] = useState('');

  const chainFrom = from ? from.chain : dualityChain;
  const chainTo = to ? to.chain : dualityChain;
  const { data: chainAddressFrom, isValidating: chainAddressFromIsValidating } =
    useChainAddress(chainFrom);
  const { data: chainAddressTo, isValidating: chainAddressToIsValidating } =
    useChainAddress(chainTo);

  const ibcOpenTransfers = useIbcOpenTransfers(chainFrom);

  const { wallet } = useWeb3();
  const [{ isValidating: isValidatingBridgeTokens, error }, sendRequest] =
    useBridge(chainFrom, chainTo);
  const bridgeTokens = useCallback<React.FormEventHandler<HTMLFormElement>>(
    async (e) => {
      // prevent submission to URL
      e.preventDefault();
      if (!wallet) {
        throw new Error('No connected wallet');
      }
      if (!from && !to) {
        throw new Error('Invalid Tokens');
      }
      if (!chainAddressFrom) {
        throw new Error('No From Address');
      }
      if (!chainAddressTo) {
        throw new Error('No To Address');
      }
      const timeoutTimestamp = Long.fromNumber(
        Date.now() + defaultTimeout // calculate in ms then convert to nanoseconds
      ).multiply(1 / nanoseconds);
      const ibcTransferInfo = ibcOpenTransfers?.find((transfer) => {
        return transfer.chainID === chainTo.chain_id;
      });
      if (!ibcTransferInfo) {
        throw new Error(
          `IBC transfer path (${chainFrom.chain_id} -> ${chainTo.chain_id}) not found`
        );
      }
      const connectionLength = ibcTransferInfo.channel.connection_hops.length;
      if (connectionLength !== 1) {
        throw new Error(
          `Multi-hop IBC transfer paths not supported: ${connectionLength} connection hops`
        );
      }
      // bridging to Duality
      if (from) {
        if (!from.chain.chain_id) {
          throw new Error('Source Chain not found');
        }
        const amount = getAmountInDenom(
          from,
          value,
          from.display,
          from.address
        );
        if (!amount || !Number(amount)) {
          throw new Error('Invalid Token Amount');
        }
        try {
          await sendRequest({
            token: coin(amount, from.address),
            timeoutTimestamp,
            sender: chainAddressFrom,
            receiver: chainAddressTo,
            sourcePort: ibcTransferInfo.channel.port_id,
            sourceChannel: ibcTransferInfo.channel.channel_id,
            memo: '',
          });
          // todo: add streaming updates to UI here
          // display wait for transaction to be confirmed on Duality Chain
          close();
        } catch {
          // don't close
        }
      }
      // bridging from Duality
      else if (to) {
        if (!to.chain.chain_id) {
          throw new Error('Destination Chain not found');
        }
        const amount = getAmountInDenom(to, value, to.display, to.address);
        if (!amount || !Number(amount)) {
          throw new Error('Invalid Token Amount');
        }
        if (!ibcTransferInfo.channel.counterparty) {
          throw new Error('No egress connection information found');
        }
        // find the denom unit asked for
        const denomUnit = to.denom_units.find(
          (unit) =>
            unit.denom === to.address ||
            unit.aliases?.find((alias) => alias === to.address)
        );
        // use the IBC version of the denom unit if found
        const tokenDenom =
          denomUnit?.aliases?.find((alias) => alias.startsWith('ibc/')) ??
          to.address;
        try {
          await sendRequest({
            token: coin(amount, tokenDenom),
            timeoutTimestamp,
            sender: chainAddressFrom,
            receiver: chainAddressTo,
            sourcePort: ibcTransferInfo.channel.counterparty.port_id,
            sourceChannel: ibcTransferInfo.channel.counterparty.channel_id,
            memo: '',
          });
          // todo: add streaming updates to UI here
          // display wait for transaction to be confirmed on external Chain
          close();
        } catch {
          // don't close
        }
      }
    },
    [
      chainAddressFrom,
      chainAddressTo,
      chainFrom.chain_id,
      chainTo.chain_id,
      close,
      from,
      ibcOpenTransfers,
      sendRequest,
      to,
      value,
      wallet,
    ]
  );

  // find expected transfer time (1 block on source + 1 block on destination)
  const { data: chainTimeFrom } = useRemoteChainBlockTime(chainFrom);
  const { data: chainTimeTo } = useRemoteChainBlockTime(chainTo);
  const chainTime = useMemo(() => {
    if (chainTimeFrom !== undefined && chainTimeTo !== undefined) {
      // default to 30s (in Nanoseconds)
      const defaultMaxChainTime = '30000000000';
      const chainMsFrom = new BigNumber(
        chainTimeFrom?.params?.max_expected_time_per_block?.toString() ??
          defaultMaxChainTime
      ).multipliedBy(nanoseconds);
      const chainMsTo = new BigNumber(
        chainTimeTo?.params?.max_expected_time_per_block?.toString() ??
          defaultMaxChainTime
      ).multipliedBy(nanoseconds);
      const blockMinutes = chainMsFrom.plus(chainMsTo).dividedBy(minutes);
      return `<${formatAmount(blockMinutes.toFixed(0), {
        useGrouping: true,
      })} minute${blockMinutes.isGreaterThan(1) ? 's' : ''}`;
    }
  }, [chainTimeFrom, chainTimeTo]);

  // find transfer fees
  const { data: chainFeesFrom } = useRemoteChainFees(chainFrom);
  const { data: chainFeesTo } = useRemoteChainFees(chainTo);
  const chainFees = useMemo(() => {
    if (chainFeesFrom !== undefined && chainFeesTo !== undefined) {
      const one = new BigNumber(1);
      const fee = new BigNumber(value)
        .multipliedBy(one.plus(chainFeesFrom?.params?.fee_percentage ?? 0))
        .multipliedBy(one.plus(chainFeesTo?.params?.fee_percentage ?? 0))
        .minus(value);
      return formatAmount(fee.toFixed(), { useGrouping: true });
    }
  }, [value, chainFeesFrom, chainFeesTo]);

  return (
    <Dialog
      isOpen={isOpen}
      onDismiss={close}
      header={<h2 className="h3">Bridge</h2>}
      initialFocusRef={inputRef}
      className="bridge-card"
    >
      <form onSubmit={bridgeTokens}>
        <fieldset className="col gap-lg" disabled={isValidatingBridgeTokens}>
          <div className="flex path-box">
            <div className="path-box__grid">
              <div className="col">
                <div className="px-4 py-sm text-muted">From</div>
              </div>
              <div className="col">
                <div className="row py-sm flex gap-3">
                  <div className="col">
                    <img
                      src={
                        chainFrom.logo_URIs?.svg ??
                        chainFrom.logo_URIs?.png ??
                        chainFrom.logo_URIs?.jpeg
                      }
                      className="logo"
                      alt="logo"
                    />
                  </div>
                  <div className="col">
                    {chainFrom.pretty_name ?? chainFrom.chain_name}
                  </div>
                </div>
              </div>
              {token && (
                <div className="col px-4 py-sm">
                  {chainFrom === dualityChain ? (
                    <LocalChainReserves token={token} />
                  ) : (
                    <RemoteChainReserves
                      chain={chainFrom}
                      token={token}
                      address={chainAddressFrom}
                    />
                  )}
                </div>
              )}
              <div className="col">
                <div className="px-4 py-sm text-muted">To</div>
              </div>
              <div className="col">
                <div className="row py-sm flex gap-3">
                  <div className="col">
                    <img
                      src={
                        chainTo.logo_URIs?.svg ??
                        chainTo.logo_URIs?.png ??
                        chainTo.logo_URIs?.jpeg
                      }
                      className="logo"
                      alt="logo"
                    />
                  </div>
                  <div className="col">
                    {chainTo.pretty_name ?? chainTo.chain_name}
                  </div>
                </div>
              </div>
              {token && (
                <div className="col px-4 py-sm">
                  {chainTo === dualityChain ? (
                    <LocalChainReserves token={token} />
                  ) : (
                    <RemoteChainReserves
                      chain={chainTo}
                      token={token}
                      address={chainAddressTo}
                    />
                  )}
                </div>
              )}
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
                  disabled
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
              <button type="button" className="button-wallet col gap-3">
                <div className="row gap-md">
                  <div className="col">
                    <img src={keplrLogoURI} className="logo" alt="logo" />
                  </div>
                  <div className="col">Source</div>
                </div>
                <div className="text-truncate text-muted">
                  {chainAddressFrom ? (
                    formatAddress(chainAddressFrom, 18)
                  ) : (
                    <span className="text-secondary">
                      {chainAddressFromIsValidating
                        ? 'Connecting...'
                        : 'Unconnected'}
                    </span>
                  )}
                </div>
              </button>
            </div>
            <div className="flex col">
              <button type="button" className="button-wallet col gap-3">
                <div className="row gap-md">
                  <div className="col">
                    <img src={keplrLogoURI} className="logo" alt="logo" />
                  </div>
                  <div className="col">Destination</div>
                </div>
                <div className="text-truncate text-muted">
                  {chainAddressTo ? (
                    formatAddress(chainAddressTo, 18)
                  ) : (
                    <span className="text-secondary">
                      {chainAddressToIsValidating
                        ? 'Connecting...'
                        : 'Unconnected'}
                    </span>
                  )}
                </div>
              </button>
            </div>
          </div>
          <div className="transaction-box my-sm p-4 col gap-md">
            <div className="row">
              <div className="col">Estimated Time</div>
              <div className="col ml-auto">
                {!!(from || to) ? <>{chainTime ?? '...'}</> : null}
              </div>
            </div>
            <div className="row">
              <div className="col">Transfer Fee</div>
              <div className="col ml-auto">
                {Number(value) ? (
                  <>
                    {chainFees ?? '...'} {(from || to)?.symbol}
                  </>
                ) : null}
              </div>
            </div>
            <div className="row">
              <div className="col">Total (est)</div>
              <div className="col ml-auto">
                {Number(value) ? (
                  <>
                    {formatAmount(value, { useGrouping: true })}{' '}
                    {(from || to)?.symbol}
                  </>
                ) : null}
              </div>
            </div>
          </div>
          {error && <div className="panel panel-error mb-sm p-4">{error}</div>}
          {token && (
            <button
              type="submit"
              className="button-primary h3 p-4"
              disabled={!chainAddressFrom || !chainAddressTo || !Number(value)}
            >
              Bridge {token?.symbol}
            </button>
          )}
        </fieldset>
      </form>
    </Dialog>
  );
}

function selectAll(e: React.MouseEvent<HTMLInputElement>) {
  e.currentTarget.select();
}

function RemoteChainReserves({
  className,
  chain,
  token,
  address,
}: {
  className?: string;
  chain: Chain;
  token: Token;
  address?: string;
}) {
  const { data: chainEndpoint, isFetching: isFetchingChainEndpoint } =
    useRemoteChainRestEndpoint(chain);
  const { data: bankBalance, isFetching: isFetchingBankBalance } =
    useRemoteChainBankBalance(chain, token, address);

  if (chainEndpoint && address) {
    const bankBalanceAmount = bankBalance?.balance?.amount;
    if (bankBalanceAmount || isFetchingBankBalance) {
      return (
        <div className={`${className} flex row gap-3`}>
          <div className="text-muted">Available</div>
          <div className="text-muted ml-auto">
            {bankBalanceAmount
              ? formatAmount(
                  getAmountInDenom(
                    token,
                    bankBalanceAmount,
                    token.base,
                    token.display
                  ) || 0,
                  { useGrouping: true }
                )
              : '...'}
          </div>
        </div>
      );
    } else {
      return (
        <div className={className}>
          <div className="text-muted">Could not fetch balance</div>
        </div>
      );
    }
  } else if (!chainEndpoint && isFetchingChainEndpoint) {
    return (
      <div className={className}>
        <span className="text-muted">Connecting...</span>
      </div>
    );
  } else {
    return (
      <div className={className}>
        <span className="text-secondary">Unconnected</span>
      </div>
    );
  }
}

function LocalChainReserves({
  className,
  token,
}: {
  className?: string;
  token: Token;
}) {
  const { address } = useWeb3();
  const allUserBankAssets = useUserBankValues();
  const userToken = allUserBankAssets.find((tokenCoin) => {
    return (
      tokenCoin.token.address === token.address &&
      tokenCoin.token.chain.chain_id === token.chain.chain_id
    );
  });

  if (!address) {
    return (
      <div className={className}>
        <span className="text-secondary">Unconnected</span>
      </div>
    );
  }

  return (
    <div className={`${className} flex row gap-3`}>
      <div className="text-muted">Available</div>
      <div className="text-muted ml-auto">
        {allUserBankAssets
          ? formatAmount(
              getAmountInDenom(
                token,
                userToken?.amount ?? 0,
                token.base,
                token.display
              ) || 0,
              { useGrouping: true }
            )
          : '...'}
      </div>
    </div>
  );
}
