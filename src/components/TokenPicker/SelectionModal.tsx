import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useId,
  ReactNode,
  FunctionComponent,
} from 'react';
import Dialog from '../Dialog/Dialog';
import SearchInput from '../inputs/SearchInput/SearchInput';
import { useTokenSearchRegex } from './hooks';

import './SelectionModal.scss';

function useSelectedButtonBackgroundMove(
  value: string | undefined = ''
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

export interface SelectionModalChild<T> {
  className?: string;
  disabled?: boolean;
  value: T | undefined;
  open?: () => void;
}
export type SelectionModal<T, Tab extends string> = Omit<
  SelectionModalDialog<T, Tab>,
  'isOpen' | 'setIsOpen' | 'onChange'
> & {
  buttonClassName?: string;
  bodyClassName?: string;
  disabled?: boolean;
  ChildComponent: FunctionComponent<SelectionModalChild<T>>;
  onChange?: SelectionModalDialog<T, Tab>['onChange'];
};
export default function SelectionModal<T, Tab extends string>({
  buttonClassName,
  bodyClassName,
  disabled,
  ChildComponent,
  value,
  onChange,
  ...modalProps
}: SelectionModal<T, Tab>) {
  // set modal logic above Dialog to prevent the dialog state from rendering
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  return (
    <>
      <ChildComponent
        className={[
          'selection-modal-open-button',
          isOpen && 'open',
          value ? 'has-selected-value' : 'no-selected-value',
          buttonClassName,
        ]
          .filter(Boolean)
          .join(' ')}
        disabled={disabled}
        value={value}
        open={onChange && open}
      />
      {isOpen && onChange && (
        <SelectionModalDialog<T, Tab>
          className={bodyClassName}
          setIsOpen={setIsOpen}
          isOpen={isOpen}
          value={value}
          onChange={onChange}
          {...modalProps}
        />
      )}
    </>
  );
}

export interface SelectionModalDialogRow<T> {
  value: T;
  index: number;
  values: T[];
  excluded: boolean;
  selected: boolean;
  focused: boolean;
  searchQuery?: string;
  renderMarkedTextSections: (text: string) => ReactNode;
}
export interface SelectionModalDialog<T, Tab extends string> {
  className?: string;
  isOpen: boolean;
  setIsOpen: (value: React.SetStateAction<boolean>) => void;
  values: T[] | undefined;
  excludedValues?: T[] | undefined;
  value: T | undefined;
  onChange: (newToken: T | undefined) => void;
  searchQuery?: string;
  setSearchQuery?: React.Dispatch<React.SetStateAction<string>>;
  tabs?: Tab[];
  tab?: Tab;
  tabsNote?: ReactNode;
  onTabChange?: (newTab: Tab) => void;
  showChain?: boolean;
  header: ReactNode;
  placholder: ReactNode;
  RowComponent: FunctionComponent<SelectionModalDialogRow<T>>;
}
function SelectionModalDialog<T, Tab extends string>({
  className,
  isOpen,
  setIsOpen,
  value: selectedValue,
  onChange,
  values = [],
  excludedValues,
  searchQuery,
  setSearchQuery,
  tabs,
  tab,
  tabsNote,
  onTabChange,
  header,
  placholder,
  RowComponent,
}: SelectionModalDialog<T, Tab>) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLUListElement>(null);

  const currentID = useId();

  const close = useCallback(() => {
    setSearchQuery?.('');
    setIsOpen(false);
  }, [setIsOpen, setSearchQuery]);

  const selectValue = useCallback(
    (value?: T) => {
      onChange(value);
      close();
    },
    [close, onChange]
  );

  // udate the selected index each time the list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [values]);

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
          const value = values.at(newIndex);
          if (value && !excludedValues?.includes(value)) selectValue(value);
        } else {
          // Ignore all of the keys not including above
          return newIndex;
        }
        // If key pressed is in the list above then cancel all default behaviour
        event.stopPropagation();
        event.preventDefault();

        // fix the selected index if it's out of bounds
        if (newIndex < 0) newIndex = values.length - 1;
        else if (newIndex >= values.length) newIndex = 0;

        bodyRef?.current?.children[newIndex]?.scrollIntoView();
        return newIndex;
      });
    },
    [values, close, excludedValues, selectValue]
  );

  const regexQuery = useTokenSearchRegex(searchQuery);
  const renderMarkedTextSections = useCallback(
    (text: string): ReactNode => {
      const textList = regexQuery ? text.split(regexQuery) ?? [] : [text];
      return textList.map(function (text, index) {
        if (index % 2) return <mark key={index}>{text}</mark>;
        return <span key={index}>{text}</span>;
      });
    },
    [regexQuery]
  );

  const [movingAssetRef, createRefForValue] =
    useSelectedButtonBackgroundMove(tab);
  return (
    <>
      <Dialog
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        header={
          <div className="selection-modal-head">
            <label htmlFor={`search-input-${currentID}`}>{header}</label>
            <SearchInput
              type="search"
              id={`search-input-${currentID}`}
              onInput={setSearchQuery}
              onKeyDown={onKeyDown}
              value={searchQuery}
              placeholder="Search name or paste address"
              autoComplete="off"
              innerRef={inputRef}
            />
          </div>
        }
        initialFocusRef={inputRef}
        className={['selection-modal-dialog', className]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="card-row my-4 gapx-3 selection-modal-tabs">
          <button
            className="button button-default pill background-moving-tab"
            disabled
            ref={movingAssetRef}
          ></button>
          {tabs?.map((tab) => {
            return (
              <button
                key={tab}
                type="button"
                className="button pill py-3 px-4"
                ref={createRefForValue(tab)}
                onClick={() => onTabChange?.(tab)}
              >
                {tab}
              </button>
            );
          })}
          {tabsNote && <div className="tabs-note ml-auto">{tabsNote}</div>}
        </div>
        <ul className="selection-modal-body modal-scrollbar" ref={bodyRef}>
          {values.length > 0
            ? values.map((value, index, values) => {
                const excluded = !!excludedValues?.includes(value);
                const selected = value === selectedValue;
                const focused = index === selectedIndex;
                return (
                  <li key={index}>
                    <button
                      type="button"
                      disabled={excluded}
                      className={[
                        excluded && 'disabled',
                        selected && 'selected',
                        focused && 'focused',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => selectValue(value)}
                      onFocus={() => setSelectedIndex(index)}
                    >
                      <RowComponent
                        value={value}
                        index={index}
                        values={values}
                        excluded={excluded}
                        selected={selected}
                        focused={focused}
                        searchQuery={searchQuery}
                        renderMarkedTextSections={renderMarkedTextSections}
                      />
                    </button>
                  </li>
                );
              })
            : placholder}
        </ul>
      </Dialog>
    </>
  );
}
