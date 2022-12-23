import {
  ChangeEventHandler,
  FormEventHandler,
  InputHTMLAttributes,
  KeyboardEventHandler,
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
  ...inputProps
}: NumberInputProps) {
  return (
    <input
      {...inputProps}
      className={['number-input', className].filter(Boolean).join(' ')}
      type="text"
      placeholder={placeholder}
      value={`${value}${!value.endsWith(appendString) ? appendString : ''}`}
      onInput={useCallback<FormEventHandler<HTMLInputElement>>(
        (e) => {
          const value = e.currentTarget.value;
          if (onInput && checkIsValid(parseValue(value, appendString))) {
            onInput(value);
          }
        },
        [onInput, appendString]
      )}
      onKeyDown={useCallback<KeyboardEventHandler<HTMLInputElement>>((e) => {
        // check single character inputs that should be ignored (eg. `-` `,` `e`)
        const inputString =
          (!e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey && e.key) || '';
        if (inputString.length === 1 && !checkIsValid(inputString)) {
          e.preventDefault();
        }
      }, [])}
      onChange={useCallback<ChangeEventHandler<HTMLInputElement>>(
        (e) => {
          const value = e.target.value;
          if (onChange && checkIsValid(parseValue(value, appendString))) {
            onChange(value);
          }
        },
        [onChange, appendString]
      )}
    />
  );
}
