import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useId,
  ReactNode,
  useMemo,
} from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import BigNumber from 'bignumber.js';

import { useFilteredTokenList } from './hooks';
import useTokens, {
  useDualityTokens,
  useTokensWithIbcInfo,
} from '../../lib/web3/hooks/useTokens';
import { Token, getTokenId } from '../../lib/web3/utils/tokens';
import useUserTokens from '../../lib/web3/hooks/useUserTokens';
import { useBankBalanceDisplayAmount } from '../../lib/web3/hooks/useUserBankBalances';

import { useSimplePrice } from '../../lib/tokenPrices';
import { formatAmount, formatCurrency } from '../../lib/utils/number';

import Dialog from '../Dialog/Dialog';
import SearchInput from '../inputs/SearchInput/SearchInput';

import './TokenPicker.scss';
import { useOneHopDenoms } from '../../lib/web3/hooks/useDenomsFromRegistry';
import useTokenPairs from '../../lib/web3/hooks/useTokenPairs';
import { useTokenByDenom } from '../../lib/web3/hooks/useDenomClients';

interface TokenPickerProps {
  className?: string;
  onChange: (newToken: Token | undefined) => void;
  exclusion?: Token | undefined;
  value: Token | undefined;
  denoms?: Array<string>;
  disabled?: boolean;
  showChain?: boolean;
  children?: ReactNode;
}

type AssetModeType = 'User' | 'All' | 'Chain';

function useSelectedButtonBackgroundMove(
  value: string
): [
  (ref: HTMLButtonElement | null) => void,
  (value: string) => (ref: HTMLButtonElement | null) => void
] {
  const [movingButton, setMovingButton] = useState<HTMLButtonElement | null>();
  const movingButtonRef = useCallback(
    (ref: HTMLButtonElement | null) => setMovingButton(ref),
    []
  );

  const [refsByValue, setRefsByValue] = useState<{
    [value: string]: HTMLElement | null;
  }>({});

  const createRefForValue = useCallback((value: string) => {
    return (ref: HTMLButtonElement | null) => {
      setRefsByValue((refs) => {
        // update element refs only if they have changed
        if (ref && ref !== refs[value]) {
          return { ...refs, [value]: ref };
        }
        return refs;
      });
    };
  }, []);

  useLayoutEffect(() => {
    const targetButton = refsByValue[value];
    if (movingButton && targetButton) {
      movingButton.style.width = `${targetButton.offsetWidth}px`;
      movingButton.style.left = `${targetButton.offsetLeft}px`;
      movingButton?.classList.add('transition-ready');
    }
  }, [value, movingButton, refsByValue]);

  return [movingButtonRef, createRefForValue];
}

export default function TokenPicker({
  className,
  value,
  onChange,
  exclusion,
  denoms: givenDenoms,
  disabled = false,
  showChain = true,
  children,
}: TokenPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLUListElement>(null);

  // source allowed denoms from several places
  const defaultDenoms = useOneHopDenoms();
  const { data: tokenPairs } = useTokenPairs();
  // find all tokens that may be selected in this input group
  const { data: tokenByDenom } = useTokenByDenom(
    givenDenoms ??
      // while tokenPairs denoms is undefined, default denoms will be used
      tokenPairs?.flatMap(([token0, token1]) => [token0, token1]) ??
      defaultDenoms
  );
  const tokenList = useMemo(
    () => Array.from((tokenByDenom || [])?.values()),
    [tokenByDenom]
  );

  const userList = useUserTokens();
  const [assetMode, setAssetMode] = useState<AssetModeType>(
    userList.length ? 'User' : 'Chain'
  );
  const currentID = useId();

  useEffect(() => {
    if (!userList.length)
      setAssetMode((oldMode) => (oldMode === 'User' ? 'All' : oldMode));
  }, [userList.length]);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setSearchQuery('');
    setIsOpen(false);
  }, []);

  const selectToken = useCallback(
    (token?: Token) => {
      onChange(token);
      close();
    },
    [close, onChange]
  );

  const dualityTokensList = useDualityTokens();

  // update the filtered list whenever the query or the list changes
  const filteredList = useFilteredTokenList(
    (() => {
      switch (assetMode) {
        case 'Chain':
          return dualityTokensList;
        case 'User':
          return userList;
        default:
          return tokenList;
      }
    })(),
    searchQuery
  );

  // udate the selected index each time the list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredList]);

  const onKeyDown = useCallback(
    function (event: React.KeyboardEvent) {
      setSelectedIndex(function (newIndex) {
        if (event.key === 'ArrowUp') {
          newIndex -= 1;
        } else if (event.key === 'ArrowDown') {
          newIndex += 1;
        } else if (event.key === 'Escape') {
          close();
          return newIndex;
        } else if (event.key === 'Enter') {
          const token = filteredList[newIndex];
          if (token && getTokenId(exclusion) !== getTokenId(token.token))
            selectToken(token?.token);
        } else {
          // Ignore all of the keys not including above
          return newIndex;
        }
        // If key pressed is in the list above then cancel all default behaviour
        event.stopPropagation();
        event.preventDefault();

        // fix the selected index if it's out of bounds
        if (newIndex < 0) newIndex = filteredList.length - 1;
        else if (newIndex >= filteredList.length) newIndex = 0;

        bodyRef?.current?.children[newIndex]?.scrollIntoView();
        return newIndex;
      });
    },
    [filteredList, close, exclusion, selectToken]
  );

  const [movingAssetRef, createRefForValue] =
    useSelectedButtonBackgroundMove(assetMode);
  return (
    <>
      {children ? (
        <button
          type="button"
          className={[
            className,
            isOpen && 'open',
            !value?.symbol && 'no-selected-token',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={open}
          disabled={disabled}
        >
          {children}
        </button>
      ) : (
        <button
          type="button"
          className={[
            className,
            'my-1',
            'token-picker-toggle',
            isOpen && 'open',
            !value?.symbol && 'no-selected-token',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={open}
          disabled={disabled}
        >
          {value?.logo_URIs ? (
            <img
              className="token-image"
              alt={`${value.symbol} logo`}
              // in this context (large images) prefer SVGs over PNGs for better images
              src={value.logo_URIs.svg || value.logo_URIs.png}
            />
          ) : (
            <FontAwesomeIcon
              icon={faQuestionCircle}
              size="2x"
              className="token-image token-image-not-found"
            ></FontAwesomeIcon>
          )}
          <span className="token-symbol">
            {value?.symbol ?? 'Select A Token'}
          </span>
          {showChain && (
            <span className="token-chain">
              {value?.chain.pretty_name ?? value?.chain.chain_name}
            </span>
          )}
        </button>
      )}
      <Dialog
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        header={getHeader()}
        initialFocusRef={inputRef}
        className="token-picker-dialog"
      >
        <div className="card-row my-4 gapx-3 token-asset-selection">
          <button
            className="button button-default pill token-moving-asset"
            disabled
            ref={movingAssetRef}
          ></button>
          <button
            type="button"
            className="button pill py-3 px-4"
            ref={createRefForValue('User')}
            onClick={() => setAssetMode('User')}
          >
            Your Assets
          </button>
          <button
            type="button"
            className="button pill py-3 px-4 hide"
            ref={createRefForValue('All')}
            onClick={() => setAssetMode('All')}
          >
            All Assets
          </button>
          <button
            type="button"
            className="button pill py-3 px-4"
            ref={createRefForValue('Chain')}
            onClick={() => setAssetMode('Chain')}
          >
            Neutron Chain Assets
          </button>
        </div>
        <ul className="token-picker-body modal-scrollbar" ref={bodyRef}>
          {filteredList.length > 0 ? (
            filteredList.map(({ chain, symbol, token }, index) => {
              return token ? (
                <TokenPickerItem
                  key={`${getTokenId(token) ?? token.base}:${
                    token.chain.chain_name
                  }`}
                  token={token}
                  chain={chain}
                  symbol={symbol}
                  index={index}
                  exclusion={exclusion}
                  selectedIndex={selectedIndex}
                  selectToken={selectToken}
                  setSelectedIndex={setSelectedIndex}
                />
              ) : null;
            })
          ) : assetMode === 'User' ? (
            <div>
              <p>Your wallet contains no tradable tokens</p>
              <p>Add tokens to your wallet to see them here</p>
            </div>
          ) : (
            <div>No match found</div>
          )}
        </ul>
      </Dialog>
    </>
  );

  function getHeader() {
    return (
      <div className="token-picker-head">
        <label htmlFor={`token-selector-${currentID}`}>Select a token</label>
        <SearchInput
          type="search"
          id={`token-selector-${currentID}`}
          onInput={setSearchQuery}
          onKeyDown={onKeyDown}
          value={searchQuery}
          placeholder="Search name or paste address"
          autoComplete="off"
          innerRef={inputRef}
        />
      </div>
    );
  }
}

function TokenPickerItem({
  token,
  denom = token?.base,
  chain = [],
  symbol = [],
  index,
  exclusion,
  selectedIndex,
  selectToken,
  setSelectedIndex,
}: {
  token: Token;
  denom?: string;
  chain: string[];
  symbol: string[];
  index: number;
  exclusion?: Token;
  selectedIndex: number;
  selectToken: (token?: Token) => void;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
}) {
  const tokenId = getTokenId(token);
  const exclusionId = getTokenId(exclusion);
  const logos = token.logo_URIs;
  const isDisabled = !!exclusionId && exclusionId === tokenId;
  const { data: balance = 0 } = useBankBalanceDisplayAmount(denom);
  const {
    data: [price = 0],
  } = useSimplePrice(Number(balance) ? [token] : []);

  function onClick() {
    selectToken(token);
  }

  function onFocus() {
    setSelectedIndex(index);
  }

  return (
    <li>
      <data value={tokenId}>
        <button
          type="button"
          disabled={isDisabled}
          className={[
            isDisabled && 'disabled',
            index === selectedIndex && ' selected',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={onClick}
          onFocus={onFocus}
        >
          {logos ? (
            <img
              // in this context (small images) prefer PNGs over SVGs
              // for reduced number of elements to be drawn in list
              src={logos.svg || logos.png}
              alt={`${symbol || 'Token'} logo`}
              className="token-image"
            />
          ) : (
            <FontAwesomeIcon
              icon={faQuestionCircle}
              size="2x"
              className="token-image token-image-not-found"
            ></FontAwesomeIcon>
          )}
          <span className="token-symbol">
            <abbr title={token.display}>{textListWithMark(symbol)}</abbr>
          </span>
          <span className="chain-name">{textListWithMark(chain)}</span>
          {new BigNumber(balance).isZero() ? (
            <span className="token-zero-balance">{formatAmount(balance)}</span>
          ) : (
            <>
              <span className="token-balance">
                {formatAmount(balance, { useGrouping: true })}
              </span>
              <span className="token-value">
                {price
                  ? formatCurrency(
                      new BigNumber(price).multipliedBy(balance).toNumber()
                    )
                  : null}
              </span>
            </>
          )}
        </button>
      </data>
    </li>
  );
}

function textListWithMark(textList: Array<string>) {
  return textList.map(function (text, index) {
    if (index % 2) return <mark key={index}>{text}</mark>;
    return <span key={index}>{text}</span>;
  });
}
