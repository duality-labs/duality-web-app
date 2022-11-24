import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useId,
  useMemo,
} from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { Chain } from '@chain-registry/types';
import BigNumber from 'bignumber.js';

import { Token } from './hooks';
import { getBalance, useBankBalances } from '../../lib/web3/indexerProvider';
import { useSimplePrices } from '../../lib/tokenPrices';

import Dialog from '../Dialog/Dialog';

import './TokenPicker.scss';

interface TokenResult {
  symbol: Array<string>;
  chain: Array<string>;
  token: Token;
}

interface TokenPickerProps {
  onChange: (newToken: Token | undefined) => void;
  exclusion: Token | undefined;
  value: Token | undefined;
  tokenList: Array<Token>;
  disabled?: boolean;
}

type AssetModeType = 'User' | 'All' | 'Duality';

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
  value,
  onChange,
  exclusion,
  tokenList,
  disabled = false,
}: TokenPickerProps) {
  const [filteredList, setFilteredList] = useState<Array<TokenResult>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLUListElement>(null);
  const { data: balances } = useBankBalances();
  const userList = useMemo(() => {
    return balances
      ? tokenList.filter((token) =>
          balances.find((balance) =>
            token.denom_units.find((token) => token.denom === balance.denom)
          )
        )
      : [];
  }, [tokenList, balances]); // Todo: actually filter list to tokens in User's wallet
  const [assetMode, setAssetMode] = useState<AssetModeType>(
    userList.length ? 'User' : 'Duality'
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
          if (token && exclusion?.address !== token.token?.address)
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
    [filteredList, close, exclusion?.address, selectToken]
  );

  // update the filtered list whenever the query or the list changes
  useEffect(
    function () {
      const list = (() => {
        switch (assetMode) {
          case 'Duality':
            return tokenList
              .filter((token) => token.chain.chain_id === 'duality')
              .reverse();
          case 'User':
            return userList;
          default:
            return tokenList;
        }
      })();
      const chainsByPrettyName = list.reduce((result, token) => {
        const name = token.chain.pretty_name;
        // use set to ensure unique chains
        const chains = result.get(name) || new Set<Chain>();
        if (!chains.has(token.chain)) {
          return result.set(token.chain.pretty_name, chains.add(token.chain));
        }
        return result;
      }, new Map<string, Set<Chain>>());

      function getChainName(token: Token) {
        const chains = chainsByPrettyName.get(token.chain.pretty_name);
        return (chains?.size || 0) > 1
          ? `${token.chain.pretty_name} (${token.chain.chain_name})`
          : token.chain.pretty_name;
      }

      // if the query is empty return the full list
      if (!searchQuery) {
        return setFilteredList(
          list.map((token) => ({
            chain: [getChainName(token)],
            symbol: [token.symbol],
            token,
          }))
        );
      }

      // remove invalid characters + remove space limitations (but still match any found)
      const queryRegexText = searchQuery
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ') //condense spaces
        .replace(/^["']*(.*)["']*$/, '$1') // remove enclosing quotes
        .replace(/[^a-z0-9 ]/gi, (char) => `\\${char}`); // whitelist ok chars
      const regexQuery = new RegExp(`(${queryRegexText})`, 'i');

      setFilteredList(
        list
          .filter((token) =>
            [
              token.symbol,
              token.name,
              token.address,
              token.chain.pretty_name,
              token.chain.chain_name,
            ].some((txt) => txt && regexQuery.test(txt))
          )
          .map(function (token) {
            // Split the symbol and name using the query (and include the query in the list)
            const symbolResult = token.symbol?.split(regexQuery) || [''];
            const chainName = getChainName(token);
            const nameResult = chainName?.split(regexQuery) || [''];
            return { chain: nameResult, symbol: symbolResult, token };
          })
      );

      setSelectedIndex(0);
    },
    [tokenList, userList, assetMode, searchQuery]
  );

  const { data: userListPrices } = useSimplePrices(userList);

  const [movingAssetRef, createRefForValue] =
    useSelectedButtonBackgroundMove(assetMode);
  return (
    <>
      <button
        type="button"
        className={[
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
        <span className="token-symbol">{value?.symbol ?? 'Choose...'}</span>
        <span className="token-chain">
          {value?.chain.pretty_name ?? value?.chain.chain_name}
        </span>
      </button>
      <Dialog
        isOpen={isOpen}
        onDismiss={close}
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
            ref={createRefForValue('Duality')}
            onClick={() => setAssetMode('Duality')}
          >
            Duality Chain Assets
          </button>
        </div>
        <ul className="token-picker-body duality-scrollbar" ref={bodyRef}>
          {filteredList.length > 0 ? (
            filteredList.map(showListItem)
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
        <input
          type="search"
          id={`token-selector-${currentID}`}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
          onKeyDown={onKeyDown}
          value={searchQuery}
          placeholder="Search name or paste address"
          autoComplete="off"
          ref={inputRef}
        />
      </div>
    );
  }

  function showListItem(token: TokenResult | null, index: number) {
    const address = token?.token?.address;
    const symbol = token?.token?.symbol;
    const logos = token?.token?.logo_URIs;
    const isDisabled = !!exclusion?.address && exclusion?.address === address;
    const balance =
      token?.token && balances ? getBalance(token.token, balances) : '0';

    const price = userListPrices?.[token?.token.coingecko_id || '']?.['usd'];

    function onClick() {
      selectToken(token?.token);
    }

    function onFocus() {
      setSelectedIndex(index);
    }

    return (
      <li key={`${token?.token?.base}:${token?.token.chain.chain_name}`}>
        <data value={address}>
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
              <abbr title={address}>
                {textListWithMark(token?.symbol || [])}
              </abbr>
            </span>
            <span className="chain-name">
              {textListWithMark(token?.chain || [])}
            </span>
            {new BigNumber(balance).isZero() ? (
              <span className="token-zero-balance">{balance}</span>
            ) : (
              <>
                <span className="token-balance">{balance}</span>
                <span className="token-value">
                  {price
                    ? `$${new BigNumber(price)
                        .multipliedBy(balance)
                        .toFixed(2)}`
                    : null}
                </span>
              </>
            )}
          </button>
        </data>
      </li>
    );
  }
}

function textListWithMark(textList: Array<string>) {
  return textList.map(function (text, index) {
    if (index % 2) return <mark key={index}>{text}</mark>;
    return <span key={index}>{text}</span>;
  });
}
