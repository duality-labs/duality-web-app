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
  const userList = useMemo(() => tokenList.filter(() => false), [tokenList]); // Todo: actually filter list to tokens in User's wallet
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
  useEffect(
    function () {
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
    },
    [tokenList, userList, assetMode, searchQuery]
  );

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
        {value?.logo ? (
          <img
            className="token-image"
            alt={`${value.symbol} logo`}
            src={value.logo}
          />
        ) : (
          <FontAwesomeIcon
            icon={faQuestionCircle}
            size="2x"
            className="token-image token-image-not-found"
          ></FontAwesomeIcon>
        )}
        <span className="token-symbol">{value?.symbol ?? 'Choose...'}</span>
        <span className="token-chain">Duality Chain</span>
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
            className="button button-primary pill token-moving-asset"
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
            className="button pill py-3 px-4"
            ref={createRefForValue('All')}
            onClick={() => setAssetMode('All')}
          >
            All Assets
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
            <div>Loading token list...</div>
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
      <li key={token?.token?.address}>
        <data value={address}>
          <button
            type="button"
            disabled={isDisabled}
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
              <FontAwesomeIcon
                icon={faQuestionCircle}
                size="2x"
                className="token-image-not-found"
              ></FontAwesomeIcon>
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
