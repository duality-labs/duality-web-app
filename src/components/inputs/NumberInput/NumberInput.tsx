import {
  ChangeEventHandler,
  FormEventHandler,
  InputHTMLAttributes,
  KeyboardEventHandler,
  MouseEventHandler,
  useCallback,
} from 'react';

import './NumberInput.scss';

interface NumberInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onInput' | 'onChange'> {
  // restrict value type to only strings for easier handling
  onInput?: (value: string) => void;
  onChange?: (value: string) => void;
  value: string | undefined;
  appendString?: string;
}

const numberRegExp = /^\d*\.?\d*$/;
const checkIsValid = (value: string) => {
  return value.length === 0 || numberRegExp.test(value);
};
const parseValue = (value: string, appendString = '') => {
  return appendString && value.endsWith(appendString)
    ? value.slice(0, value.length - appendString.length)
    : value;
};

export default function NumberInput({
  className,
  placeholder = '0',
  value = '',
  appendString = '',
  onInput,
  onChange,
  // other input props
  onClick,
  onKeyDown,
  onKeyUp,
  ...inputProps
}: NumberInputProps) {
  const moveSelectionBeforeAppendedString = useCallback(
    (input: HTMLInputElement) => {
      // after an input change, ensure selection is never behind the appended text
      if (appendString) {
        const appendStringIndex = input.value.lastIndexOf(appendString);
        if ((input.selectionEnd || 0) > appendStringIndex) {
          input.selectionEnd = appendStringIndex;
        }
        if ((input.selectionStart || 0) > appendStringIndex) {
          input.selectionStart = appendStringIndex;
        }
      }
    },
    [appendString]
  );
  return (
    <input
      {...inputProps}
      className={['number-input', className].filter(Boolean).join(' ')}
      type="text"
      placeholder={placeholder}
      pattern="^[0-9]*[.,]?[0-9]*$"
      value={`${value}${appendString}`}
      // global HTML element attribute options
      inputMode="decimal"
      spellCheck="false"
      // input element attribute options
      autoComplete="off"
      // non-standard input element attributes
      autoCorrect="off"
      // event callback handlers
      onInput={useCallback<FormEventHandler<HTMLInputElement>>(
        (e) => {
          const value = parseValue(e.currentTarget.value, appendString);
          if (onInput && checkIsValid(value)) {
            onInput(value);
          }
        },
        [onInput, appendString]
      )}
      onKeyDown={useCallback<KeyboardEventHandler<HTMLInputElement>>(
        (e) => {
          onKeyDown?.(e);
          // check single character inputs that should be ignored (eg. `-` `,` `e`)
          const inputString =
            (!e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey && e.key) ||
            '';
          if (inputString.length === 1 && !checkIsValid(inputString)) {
            e.preventDefault();
          }
        },
        [onKeyDown]
      )}
      onKeyUp={useCallback<KeyboardEventHandler<HTMLInputElement>>(
        (e) => {
          onKeyUp?.(e);
          moveSelectionBeforeAppendedString(e.currentTarget);
        },
        [moveSelectionBeforeAppendedString, onKeyUp]
      )}
      onClick={useCallback<MouseEventHandler<HTMLInputElement>>(
        (e) => {
          onClick?.(e);
          moveSelectionBeforeAppendedString(e.currentTarget);
        },
        [moveSelectionBeforeAppendedString, onClick]
      )}
      onChange={useCallback<ChangeEventHandler<HTMLInputElement>>(
        (e) => {
          const value = parseValue(e.target.value, appendString);
          if (onChange && checkIsValid(value)) {
            onChange(value);
          }
        },
        [onChange, appendString]
      )}
    />
  );
}
