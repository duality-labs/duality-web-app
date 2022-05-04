import React, { useCallback, useEffect, useState } from 'react';

import { useNextID, Token } from './mockHooks';

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
  const [filteredList, setFilteredList] = useState(
    null as Array<TokenResult | null> | null
  );
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [inputDom, setInputDom] = useState(null as HTMLElement | null);
  const [bodyDom, setBodyDom] = useState(null as HTMLElement | null);
  const currentID = useNextID();

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setSearchQuery('');
    setIsOpen(false);
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      let newIndex = selectedIndex;
      if (event.key === 'ArrowUp') newIndex -= 1;
      else if (event.key === 'ArrowDown') newIndex += 1;
      else if (event.key === 'Escape') return close();
      else if (event.key === 'Enter') {
        const token = (filteredList || [])[selectedIndex];
        if (token && exclusion?.address !== token.token?.address) {
          onChange(token.token);
          close();
        }
      } else return;
      event.stopPropagation();
      event.preventDefault();
      if (newIndex < 0) newIndex = (filteredList?.length || 1) - 1;
      else if (newIndex >= (filteredList?.length || 0)) newIndex = 0;
      setSelectedIndex(newIndex);
      const child = bodyDom?.children[newIndex];
      if (child) child.scrollIntoView();
    },
    [filteredList, selectedIndex, exclusion, onChange, close, bodyDom]
  );

  useEffect(
    function () {
      if (!searchQuery)
        return setFilteredList(
          tokenList?.map((token) => ({
            name: [token.name],
            symbol: [token.symbol],
            token,
          }))
        );
      // remove invalid characters + remove space limitations (but still match any found)
      const queryRegexText = searchQuery
        .toLowerCase()
        .replace(/[.*\\{}[\]+$^]/gi, (char) => `\\${char}`)
        .replace(/\s+/g, '\\s*');
      const regexQuery = new RegExp(`(${queryRegexText})`, 'i');
      setFilteredList(
        tokenList
          ?.map(function (token) {
            const symbolResult = token.symbol?.split(regexQuery) || [''];
            const nameResult = token.name?.split(regexQuery) || [''];
            if (
              symbolResult.length === 1 &&
              nameResult.length === 1 &&
              !regexQuery.test(token.address)
            )
              return null;
            return { name: nameResult, symbol: symbolResult, token };
          })
          ?.filter(Boolean)
      );
      setSelectedIndex(0);
    },
    [tokenList, searchQuery]
  );

  const onItemFocus = useCallback(
    (index: number) => {
      setSelectedIndex(index);
      inputDom?.focus();
    },
    [inputDom]
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
          ref={setInputDom}
        />
      </div>
    );
  }

  function getBody() {
    return (
      <ul className="token-picker-body" ref={setBodyDom}>
        {filteredList?.map((token, index) => (
          <li key={token?.token?.address}>
            <data value={token?.token?.address}>
              <button
                className={`${
                  exclusion?.address === token?.token?.address ? 'disabled' : ''
                }${index === selectedIndex ? ' selected' : ''}`}
                onClick={() => {
                  if (exclusion?.address === token?.token?.address) return;
                  onChange(token?.token);
                  close();
                }}
                onFocus={() => onItemFocus(index)}
              >
                <div className="token-image">
                  {token?.token?.logo ? (
                    <img
                      src={token?.token?.logo}
                      alt={`${token?.token?.symbol || 'Token'} logo`}
                    />
                  ) : (
                    <i className="no-token-logo"></i>
                  )}
                </div>
                <dfn className="token-symbol">
                  <abbr title={token?.token?.address}>
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
        ))}
      </ul>
    );
  }

  return (
    <>
      <button
        className={`py-1 px-3 border border-slate-200 rounded-lg dropdown-toggle flex justify-center items-center text-center${
          isOpen ? ' open' : ''
        }`}
        onClick={open}
      >
        {value?.symbol || 'Choose Token'}
      </button>
      <Dialog
        isOpen={isOpen}
        onDismiss={close}
        header={getHeader()} /*initialFocusRef={inputDom || undefined}*/
      >
        {getBody()}
      </Dialog>
    </>
  );
}

function textListWithMark(textList: Array<string>) {
  return textList.map(function (text, index) {
    if (index % 2) return <mark key={index}>{text}</mark>;
    return <span key={index}>{text}</span>;
  });
}
