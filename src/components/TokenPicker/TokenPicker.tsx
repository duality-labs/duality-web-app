import React, { useCallback, useEffect, useState, useMemo } from 'react';

import { useNextID } from './mockHooks';

import './TokenPicker.scss';

interface TokenPickerProps {
  onChange: (eventOrValue: string) => void;
  exclusion: string | null | undefined;
  value: string | undefined;
  tokenList: Array<string>;
}

export default function TokenPicker({
  value,
  onChange,
  exclusion,
  tokenList,
}: TokenPickerProps) {
  const [filteredList, setFilteredList] = useState(tokenList);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const currentID = useMemo(useNextID, []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dialogDom, setDialogDom] = useState(undefined as any);

  const open = useCallback(() => {
    dialogDom.showModal();
  }, [dialogDom]);

  const close = useCallback(() => {
    dialogDom.close();
  }, [dialogDom]);

  const closeOnClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target === dialogDom) close();
    },
    [dialogDom, close]
  );

  useEffect(
    function () {
      const regexQuery = RegExp(
        '(' +
          searchQuery
            .toLowerCase()
            .replace(/[.*\\{}[\]+$^]/gi, (char) => `\\${char}`)
            .replace(/\s+/g, '\\s*') +
          ')',
        'i'
      );
      // According to several benchmark tests the efficiency of filter + map is the same as a reduce call
      setFilteredList(
        tokenList
          ?.filter(function (item) {
            const result = item.split(regexQuery);
            return result.length === 1 ? null : result;
          })
          ?.filter(Boolean)
      );
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
        className={
          'py-1 px-3 border border-slate-200 rounded-lg dropdown-toggle flex justify-center items-center text-center' +
          (isOpen ? ' open' : '')
        }
        onClick={open}
        htmlFor={'token-selector-' + currentID}
      >
        {value || 'Choose Token'}
      </label>
      <dialog
        ref={(dom) => setDialogDom(dom)}
        onClick={closeOnClick}
        className="token-picker-dialog"
      >
        <div className="token-picker">
          <div className="p-2">
            <label className="mr-2" htmlFor={'token-selector-' + currentID}>
              Select a token
            </label>
            <input
              type="search"
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              value={searchQuery}
            ></input>
          </div>
          <ul className="token-picker-list border-t border-slate-500 py-2 bg-white">
            {filteredList?.map((token) => (
              <li key={token}>
                <button
                  className={`py-1 px-2 w-full text-left${
                    value === token ? ' bg-slate-700' : ''
                  }${
                    exclusion === token
                      ? ' disabled opacity-25'
                      : ' hover:bg-slate-600'
                  }`}
                  onClick={() => {
                    onChange(token);
                    close();
                  }}
                  onKeyPress={(e) => {
                    // accept space key press as input (like buttons)
                    if (e.key === ' ') {
                      onChange(token);
                      close();
                    }
                  }}
                  role="menuitem"
                  tabIndex={0}
                >
                  {token}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </>
  );
}
