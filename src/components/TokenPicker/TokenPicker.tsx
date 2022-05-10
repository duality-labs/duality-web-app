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
}

export default function TokenPicker({
  value,
  onChange,
  exclusion,
  tokenList,
}: TokenPickerProps) {
  const [filteredList, setFilteredList] = useState<Array<TokenResult>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLUListElement>(null);
  const currentID = useId();

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
      // if the query is empty return the full list
      if (!searchQuery || !tokenList) {
        return setFilteredList(
          tokenList?.map((token) => ({
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
        tokenList
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
    },
    [tokenList, searchQuery]
  );

  return (
    <>
      <button
        type="button"
        className={`token-picker-toggle ${isOpen ? ' open' : ''}`}
        onClick={open}
      >
        {value?.symbol || 'Choose Token'}
      </button>
      <Dialog
        isOpen={isOpen}
        onDismiss={close}
        header={getHeader()}
        initialFocusRef={inputRef}
      >
        <ul className="token-picker-body" ref={bodyRef}>
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
            className={`${isDisabled ? 'disabled' : ''}${
              index === selectedIndex ? ' selected' : ''
            }`}
            onClick={onClick}
            onFocus={onFocus}
          >
            <div className="token-image">
              {logo ? (
                <img src={logo} alt={`${symbol || 'Token'} logo`} />
              ) : (
                <i className="no-token-logo"></i>
              )}
            </div>
            <dfn className="token-symbol">
              <abbr title={address}>
                {textListWithMark(token?.symbol || [])}
              </abbr>
            </dfn>
            <span className="token-name">
              {textListWithMark(token?.name || [])}
            </span>
            <span className="token-balance"></span>
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
