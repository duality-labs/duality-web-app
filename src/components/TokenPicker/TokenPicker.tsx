import React, { useCallback, useEffect, useState, useMemo } from 'react';

import { useNextID, Token } from './mockHooks';

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
  const currentID = useMemo(useNextID, []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dialogDom, setDialogDom] = useState(undefined as any);
  const [bodyDom, setBody] = useState(null as HTMLElement | null);

  const open = useCallback(() => {
    dialogDom.showModal();
  }, [dialogDom]);

  const close = useCallback(() => {
    setSearchQuery('');
    dialogDom.close();
  }, [dialogDom]);

  const closeOnClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target === dialogDom) close();
    },
    [dialogDom, close]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      let newIndex = selectedIndex;
      if (event.key === 'ArrowUp') newIndex -= 1;
      else if (event.key === 'ArrowDown') newIndex += 1;
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

  useEffect(
    function () {
      if (!dialogDom) return;
      dialogDom.addEventListener('close', function () {
        setIsOpen(false);
      });
    },
    [dialogDom]
  );

  return (
    <>
      <label
        className={`py-1 px-3 border border-slate-200 rounded-lg dropdown-toggle flex justify-center items-center text-center${
          isOpen ? ' open' : ''
        }`}
        onClick={open}
        htmlFor={`token-selector-${currentID}`}
      >
        {value?.symbol || 'Choose Token'}
      </label>
      <dialog
        ref={(dom) => setDialogDom(dom)}
        onClick={closeOnClick}
        className="token-picker-dialog"
      >
        <div className="token-picker">
          <div className="token-picker-header">
            <div className="token-picker-controls">
              <label htmlFor={`token-selector-${currentID}`}>
                Select a token
              </label>
              <button className="close" onClick={close}></button>
            </div>
            <input
              type="search"
              id={`token-selector-${currentID}`}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              onKeyDown={onKeyDown}
              value={searchQuery}
              placeholder="Search for a token"
              autoComplete="off"
            />
          </div>
          <ul className="token-picker-body" ref={(dom) => setBody(dom)}>
            {filteredList?.map((token, index) => (
              <li key={token?.token?.address}>
                <data value={token?.token?.address}>
                  <button
                    className={`${
                      exclusion?.address === token?.token?.address
                        ? 'disabled'
                        : ''
                    }${index === selectedIndex ? ' selected' : ''}`}
                    onClick={() => {
                      if (exclusion?.address === token?.token?.address) return;
                      onChange(token?.token);
                      close();
                    }}
                    onFocus={() => setSelectedIndex(index)}
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
        </div>
      </dialog>
    </>
  );
}

function textListWithMark(textList: Array<string>) {
  return textList.map(function (text, index) {
    if (index % 2) return <mark key={index}>{text}</mark>;
    return <span key={index}>{text}</span>;
  });
}
