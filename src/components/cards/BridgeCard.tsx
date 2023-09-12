import BigNumber from 'bignumber.js';
import Long from 'long';
import { useCallback, useMemo, useState } from 'react';
import { Chain } from '@chain-registry/types';
import { coin } from '@cosmjs/stargate';

import TokenPicker from '../TokenPicker/TokenPicker';
import NumberInput from '../inputs/NumberInput/NumberInput';

import useBridge from '../../pages/Bridge/useBridge';
import { useWeb3 } from '../../lib/web3/useWeb3';
import { useUserBankValues } from '../../lib/web3/hooks/useUserBankValues';
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
import {
  Token,
  getBaseDenomAmount,
  getDisplayDenomAmount,
} from '../../lib/web3/utils/tokens';

import './BridgeCard.scss';

const defaultTimeout = 30 * minutes;

const keplrLogoURI =
  'https://raw.githubusercontent.com/chainapsis/keplr-wallet/master/docs/.vuepress/public/favicon-256.png';

export default function BridgeCard({
  from,
  to,
  className,
  inputRef,
  onSuccess,
}: {
  from?: Token;
  to?: Token;
  className?: string;
  inputRef?: React.RefObject<HTMLInputElement>;
  onSuccess?: () => void;
}) {
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
  const [{ isValidating: isValidatingBridgeTokens }, sendRequest] = useBridge(
    chainFrom,
    chainTo
  );
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
        const amount = getBaseDenomAmount(from, value);
        if (!amount || !Number(amount)) {
          throw new Error('Invalid Token Amount');
        }
        try {
          await sendRequest({
            token: coin(amount, from.address),
            timeout_timestamp: timeoutTimestamp,
            sender: chainAddressFrom,
            receiver: chainAddressTo,
            source_port: ibcTransferInfo.channel.port_id,
            source_channel: ibcTransferInfo.channel.channel_id,
            memo: '',
            timeout_height: {
              revision_height: Long.ZERO,
              revision_number: Long.ZERO,
            },
          });
          // todo: add streaming updates to UI here
          // display wait for transaction to be confirmed on Duality Chain
          onSuccess?.();
        } catch {
          // handled error with toast notifications
        }
      }
      // bridging from Duality
      else if (to) {
        if (!to.chain.chain_id) {
          throw new Error('Destination Chain not found');
        }
        const amount = getBaseDenomAmount(to, value);
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
            timeout_timestamp: timeoutTimestamp,
            sender: chainAddressFrom,
            receiver: chainAddressTo,
            source_port: ibcTransferInfo.channel.counterparty.port_id,
            source_channel: ibcTransferInfo.channel.counterparty.channel_id,
            memo: '',
            timeout_height: {
              revision_height: Long.ZERO,
              revision_number: Long.ZERO,
            },
          });
          // todo: add streaming updates to UI here
          // display wait for transaction to be confirmed on external Chain
          onSuccess?.();
        } catch {
          // handled error with toast notifications
        }
      }
    },
    [
      chainAddressFrom,
      chainAddressTo,
      chainFrom.chain_id,
      chainTo.chain_id,
      onSuccess,
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
    <div className={['bridge-card', className].filter(Boolean).join(' ')}>
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
              <button
                type="button"
                disabled
                className="button-wallet col gap-3"
              >
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
              <button
                type="button"
                disabled
                className="button-wallet col gap-3"
              >
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
          {token && (
            <BridgeButton
              chainFrom={chainFrom}
              chainTo={chainTo}
              token={token}
              value={value}
            />
          )}
        </fieldset>
      </form>
    </div>
  );
}

function BridgeButton({
  chainFrom,
  chainTo,
  token,
  value,
}: {
  chainFrom: Chain;
  chainTo: Chain;
  token?: Token;
  value: string;
}) {
  const { data: chainAddressFrom } = useChainAddress(chainFrom);
  const { data: chainAddressTo } = useChainAddress(chainTo);

  const { data: bankBalanceAvailable } = useRemoteChainBankBalance(
    chainFrom,
    token,
    chainAddressFrom
  );

  const hasAvailableBalance = useMemo(() => {
    return new BigNumber(value || 0).isLessThanOrEqualTo(
      token
        ? getDisplayDenomAmount(
            token,
            bankBalanceAvailable?.balance?.amount || 0
          ) || 0
        : 0
    );
  }, [value, bankBalanceAvailable, token]);

  const errorMessage = useMemo<string | undefined>(() => {
    switch (true) {
      case !hasAvailableBalance:
        return 'Insufficient Funds';
      default:
        return undefined;
    }
  }, [hasAvailableBalance]);

  // return "incomplete" state
  if (!token || !chainAddressFrom || !chainAddressTo || !Number(value)) {
    return (
      <button type="submit" className="button-primary h3 p-4" disabled>
        Bridge {token?.symbol}
      </button>
    );
  }
  // return success or error state
  return (
    <button
      type={errorMessage ? 'button' : 'submit'}
      onClick={() => undefined}
      className={[
        'h3 p-4',
        errorMessage ? 'button-error' : 'button-primary',
      ].join(' ')}
    >
      {errorMessage ? <>{errorMessage}</> : <>Bridge {token?.symbol}</>}
    </button>
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
                  getDisplayDenomAmount(token, bankBalanceAmount) || 0,
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
              getDisplayDenomAmount(token, userToken?.amount ?? 0) || 0,
              { useGrouping: true }
            )
          : '...'}
      </div>
    </div>
  );
}
