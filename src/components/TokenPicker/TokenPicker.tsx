import { useCallback, useEffect, useRef, useState, useId } from 'react';

import { Token } from './mockHooks';

import Dialog from '../Dialog/Dialog';

import './TokenPicker.scss';

interface TokenResult {
  symbol: Array<string>;
  name: Array<string>;
  token: Token;
}

interface TokenPickerProps {
  onChange: (newToken: Token | undefined) => void;
  exclusion: Token | undefined;
  value: Token | undefined;
  tokenList: Array<Token>;
  disabled?: boolean;
}

type AssetModeType = 'User' | 'All';

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
  const userList = tokenList.filter((_, i) => i & 1); // Todo actually filter (every other token for now)
  const [assetMode, setAssetMode] = useState<AssetModeType>(
    userList.length ? 'User' : 'All'
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
  useEffect(() => {
    const list = assetMode === 'All' ? tokenList : userList;

    // if the query is empty return the full list
    if (!searchQuery) {
      return setFilteredList(
        list.map((token) => ({
          name: [token.name],
          symbol: [token.symbol],
          token,
        }))
      );
    }

    // remove invalid characters + remove space limitations (but still match any found)
    const queryRegexText = searchQuery
      .toLowerCase()
      .replace(/[.*\\{}[\]+$^]/gi, (char) => `\\${char}`)
      .replace(/\s+/g, '\\s*');
    const regexQuery = new RegExp(`(${queryRegexText})`, 'i');

    setFilteredList(
      list
        .filter((token) =>
          [token.symbol, token.name, token.address].some((txt) =>
            regexQuery.test(txt)
          )
        )
        .map(function (token) {
          // Split the symbol and name using the query (and include the query in the list)
          const symbolResult = token.symbol?.split(regexQuery) || [''];
          const nameResult = token.name?.split(regexQuery) || [''];
          return { name: nameResult, symbol: symbolResult, token };
        })
    );

    setSelectedIndex(0);
  }, [tokenList, userList, assetMode, searchQuery]);

  return (
    <>
      <button
        type="button"
        className={`token-picker-toggle ${isOpen ? ' open' : ''}`}
        onClick={open}
        disabled={disabled}
      >
        {value?.symbol ? (
          <>
            {value.logo ? (
              <img
                className="token-image"
                alt={`${value.symbol} logo`}
                src={value.logo}
              />
            ) : (
              <i className="token-image no-token-logo"></i>
            )}
            <span className="token-symbol">{value.symbol}</span>
            <span className="token-chain">Duality Chain</span>
          </>
        ) : (
          <span className="no-selected-token">Choose Token</span>
        )}
      </button>
      <Dialog
        isOpen={isOpen}
        onDismiss={close}
        header={getHeader()}
        initialFocusRef={inputRef}
        className="token-picker-dialog"
      >
        <div className="card-row my-4 gapx-3">
          {!!userList.length && (
            <button
              type="button"
              className={`button pill py-3 px-4 ${
                assetMode === 'User' ? 'button-primary' : ''
              }`}
              onClick={() => setAssetMode('User')}
            >
              Your Assets
            </button>
          )}
          <button
            type="button"
            className={`button pill py-3 px-4 ${
              assetMode === 'All' ? 'button-primary' : ''
            }`}
            onClick={() => setAssetMode('All')}
          >
            All Assets
          </button>
        </div>
        <ul className="token-picker-body duality-scrollbar" ref={bodyRef}>
          {filteredList.map(showListItem)}
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
          placeholder="Search for a token"
          autoComplete="off"
          ref={inputRef}
        />
      </div>
    );
  }

  function showListItem(token: TokenResult | null, index: number) {
    const address = token?.token?.address;
    const symbol = token?.token?.symbol;
    const logo = token?.token?.logo;
    const isDisabled = exclusion?.address === address;
    const balance = '0.0'; // TODO get actual balance

    function onClick() {
      selectToken(token?.token);
    }

    function onFocus() {
      setSelectedIndex(index);
    }

    return (
      <li key={address}>
        <data value={address}>
          <button
            type="button"
            className={[
              isDisabled && 'disabled',
              index === selectedIndex && ' selected',
              'py-3',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={onClick}
            onFocus={onFocus}
          >
            {logo ? (
              <img
                src={logo}
                alt={`${symbol || 'Token'} logo`}
                className="token-image"
              />
            ) : (
              <i className="token-image no-token-logo"></i>
            )}
            <dfn className="token-symbol">
              <abbr title={address}>
                {textListWithMark(token?.symbol || [])}
              </abbr>
            </dfn>
            <span className="token-name">
              {textListWithMark(token?.name || [])}
            </span>
            <span className="token-balance">{balance}</span>
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
