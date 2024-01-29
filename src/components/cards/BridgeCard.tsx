import BigNumber from 'bignumber.js';
import Long from 'long';
import { useCallback, useMemo, useState } from 'react';
import { Asset, Chain } from '@chain-registry/types';
import { coin } from '@cosmjs/stargate';

import TokenPicker from '../TokenPicker/TokenPicker';
import NumberInput from '../inputs/NumberInput/NumberInput';

import useBridge from '../../pages/Bridge/useBridge';
import { useWeb3 } from '../../lib/web3/useWeb3';
import { useUserBankValues } from '../../lib/web3/hooks/useUserBankValues';
import {
  useChainAddress,
  useNativeChain,
  useRemoteChainBankBalance,
  useRemoteChainRestEndpoint,
} from '../../lib/web3/hooks/useChains';
import {
  useSingleHopChannelInfo,
  useSingleHopChannelStatus,
} from '../../pages/Bridge/useChannelInfo';
import { useRelatedChainsClient } from '../../lib/web3/hooks/useDenomsFromRegistry';

import { minutes, nanoseconds } from '../../lib/utils/time';
import { formatAddress } from '../../lib/web3/utils/address';
import { matchToken } from '../../lib/web3/hooks/useTokens';
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
  const { data: nativeChain } = useNativeChain();

  const chainFrom = from ? from.chain : nativeChain;
  const chainTo = to ? to.chain : nativeChain;
  const { data: chainAddressFrom, isValidating: chainAddressFromIsValidating } =
    useChainAddress(chainFrom);
  const { data: chainAddressTo, isValidating: chainAddressToIsValidating } =
    useChainAddress(chainTo);

  // find the asset as seen from the source chain
  const { data: relatedChainsClient } = useRelatedChainsClient();
  const chainFromAsset = useMemo(() => {
    return from
      ? relatedChainsClient
          ?.getChainUtil(from.chain.chain_name)
          .getAssetByDenom(getBaseDenom(from))
      : nativeChain &&
          to &&
          relatedChainsClient
            ?.getChainUtil(nativeChain.chain_name)
            .getAssetByDenom(to.base);
  }, [from, nativeChain, relatedChainsClient, to]);

  // find the channel information on the from side for the bridge request
  const { data: channelInfo } = useSingleHopChannelInfo(
    chainFrom,
    chainTo,
    token
  );

  const {
    data: chainClientStatusFrom,
    isLoading: chainClientStatusFromIsLoading,
  } = useSingleHopChannelStatus(
    chainFrom,
    useSingleHopChannelInfo(chainFrom, chainTo, token).data?.client_id
  );
  const { data: chainClientStatusTo, isLoading: chainClientStatusToIsLoading } =
    useSingleHopChannelStatus(
      chainTo,
      useSingleHopChannelInfo(chainTo, chainFrom, token).data?.client_id
    );

  const { wallet } = useWeb3();
  const [{ isValidating: isValidatingBridgeTokens }, sendRequest] = useBridge(
    // add chain source details
    chainFrom,
    chainAddressFrom,
    from ? getBaseDenom(from) : to?.base,
    // add chain destination details
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
      if (!chainFrom) {
        throw new Error('No Chain From');
      }
      if (!chainTo) {
        throw new Error('No Chain To');
      }
      const timeoutTimestamp = Long.fromNumber(
        Date.now() + defaultTimeout // calculate in ms then convert to nanoseconds
      ).multiply(1 / nanoseconds);
      if (!channelInfo) {
        throw new Error(
          `IBC transfer path (${chainFrom.chain_id} -> ${chainTo.chain_id}) not found`
        );
      }
      // future: can check both sides of the chain to see if they have IBC
      // - send_enabled
      // - receive_enabled
      // by querying each chain with: /ibc/apps/transfer/v1/params
      // (this may be redundant as we know there is an IBC connection already)
      if (chainClientStatusFrom?.status !== 'Active') {
        throw new Error(
          `The connection source client is not active. Current status: ${
            chainClientStatusFrom?.status ?? 'unknown'
          }`
        );
      }
      if (chainClientStatusTo?.status !== 'Active') {
        throw new Error(
          `The connection destination client is not active. Current status: ${
            chainClientStatusTo?.status ?? 'unknown'
          }`
        );
      }
      // bridging to native chain
      if (from) {
        if (!from.chain.chain_id) {
          throw new Error('Source Chain not found');
        }
        const amount = getBaseDenomAmount(from, value);
        if (!amount || !Number(amount)) {
          throw new Error('Invalid Token Amount');
        }
        // find the base non-IBC denom to match the base amount being sent
        const tokenDenom = from.base;
        if (!tokenDenom) {
          throw new Error('Source denom not found');
        }

        try {
          await sendRequest({
            token: coin(amount, getBaseDenom(from)),
            timeout_timestamp: timeoutTimestamp,
            sender: chainAddressFrom,
            receiver: chainAddressTo,
            source_port: channelInfo.port_id,
            source_channel: channelInfo.channel_id,
            memo: '',
            timeout_height: {
              revision_height: Long.ZERO,
              revision_number: Long.ZERO,
            },
          });
          // todo: add streaming updates to UI here
          // display wait for transaction to be confirmed on native Chain
          onSuccess?.();
        } catch {
          // handled error with toast notifications
        }
      }
      // bridging from native chain
      else if (to) {
        if (!to.chain.chain_id) {
          throw new Error('Destination Chain not found');
        }
        const baseAmount = getBaseDenomAmount(to, value);
        if (!baseAmount || !Number(baseAmount)) {
          throw new Error('Invalid Token Amount');
        }
        try {
          await sendRequest({
            token: coin(baseAmount, to.base),
            timeout_timestamp: timeoutTimestamp,
            sender: chainAddressFrom,
            receiver: chainAddressTo,
            source_port: channelInfo.port_id,
            source_channel: channelInfo.channel_id,
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
      wallet,
      from,
      to,
      chainAddressFrom,
      chainAddressTo,
      chainFrom,
      chainTo,
      channelInfo,
      chainClientStatusFrom?.status,
      chainClientStatusTo?.status,
      value,
      sendRequest,
      onSuccess,
    ]
  );

  return (
    chainFrom &&
    chainTo && (
      <div className={['bridge-card', className].filter(Boolean).join(' ')}>
        <form onSubmit={bridgeTokens}>
          <fieldset
            className="col gap-lg"
            disabled={
              !(token && chainAddressFrom && chainAddressTo) ||
              isValidatingBridgeTokens
            }
          >
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
                    {chainFrom === nativeChain ? (
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
                    {chainTo === nativeChain ? (
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
                <div className="col">Source chain status</div>
                <div className="col ml-auto">
                  {chainClientStatusFrom?.status === 'Active' ? (
                    <span>{chainClientStatusFrom.status}</span>
                  ) : !chainClientStatusFromIsLoading ? (
                    <span className="text-error">
                      {chainClientStatusFrom?.status ?? 'Not connected'}
                    </span>
                  ) : (
                    'Checking...'
                  )}
                </div>
              </div>
              <div className="row">
                <div className="col">Destination chain status</div>
                <div className="col ml-auto">
                  {chainClientStatusTo?.status === 'Active' ? (
                    <span>{chainClientStatusTo.status}</span>
                  ) : !chainClientStatusToIsLoading ? (
                    <span className="text-error">
                      {chainClientStatusTo?.status ?? 'Not connected'}
                    </span>
                  ) : (
                    'Checking...'
                  )}
                </div>
              </div>
            </div>
            <BridgeButton
              chainFrom={chainFrom}
              chainFromAsset={chainFromAsset}
              chainTo={chainTo}
              value={value}
              disabled={
                chainClientStatusFrom?.status !== 'Active' ||
                chainClientStatusTo?.status !== 'Active'
              }
            />
          </fieldset>
        </form>
      </div>
    )
  );
}

// get an asset denom as known from its original chain
function getBaseDenom(asset: Asset): string {
  return asset.traces?.at(0)?.counterparty.base_denom ?? asset.base;
}

function BridgeButton({
  chainFrom,
  chainFromAsset,
  chainTo,
  value,
  disabled,
}: {
  chainFrom: Chain;
  chainFromAsset?: Asset;
  chainTo: Chain;
  value: string;
  disabled: boolean;
}) {
  const { data: chainAddressFrom } = useChainAddress(chainFrom);
  const { data: chainAddressTo } = useChainAddress(chainTo);

  const { data: bankBalanceAvailable } = useRemoteChainBankBalance(
    chainFrom,
    chainFromAsset?.base,
    chainAddressFrom
  );

  const hasAvailableBalance = useMemo(() => {
    return new BigNumber(value || 0).isLessThanOrEqualTo(
      chainFromAsset
        ? getDisplayDenomAmount(
            chainFromAsset,
            bankBalanceAvailable?.balance?.amount || 0
          ) || 0
        : 0
    );
  }, [value, bankBalanceAvailable, chainFromAsset]);

  const errorMessage = useMemo<string | undefined>(() => {
    switch (true) {
      case !hasAvailableBalance:
        return 'Insufficient Funds';
      default:
        return undefined;
    }
  }, [hasAvailableBalance]);

  // return "incomplete" state
  if (
    disabled ||
    !chainFromAsset ||
    !chainAddressFrom ||
    !chainAddressTo ||
    !Number(value)
  ) {
    return (
      <button type="submit" className="button-primary h4 p-4" disabled>
        Bridge {chainFromAsset?.symbol}
      </button>
    );
  }
  // return success or error state
  return (
    <button
      type={errorMessage ? 'button' : 'submit'}
      onClick={() => undefined}
      className={[
        'h4 p-4',
        errorMessage ? 'button-error' : 'button-primary',
      ].join(' ')}
    >
      {errorMessage ? (
        <>{errorMessage}</>
      ) : (
        <>Bridge {chainFromAsset?.symbol}</>
      )}
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
    useRemoteChainBankBalance(chain, token && getBaseDenom(token), address);

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
  const userToken = useMemo(() => {
    const tokenMatcher = matchToken(token);
    return allUserBankAssets.find((tokenCoin) => {
      return tokenMatcher(tokenCoin.token);
    });
  }, [allUserBankAssets, token]);

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
