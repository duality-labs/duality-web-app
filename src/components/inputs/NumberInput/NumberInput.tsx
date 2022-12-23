import {
  ChangeEventHandler,
  FormEventHandler,
  InputHTMLAttributes,
  useCallback,
} from 'react';

import './NumberInput.scss';

interface NumberInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onInput' | 'onChange'> {
  // restrict value type to only strings for easier handling
  onInput?: (value: string) => void;
  onChange?: (value: string) => void;
  value: string | undefined;
}

export default function NumberInput({
  className,
  placeholder = '0',
  value = '',
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
      value={value}
      onInput={useCallback<FormEventHandler<HTMLInputElement>>(
        (e) => {
          onInput?.(e.currentTarget.value);
        },
        [onInput]
      )}
      onChange={useCallback<ChangeEventHandler<HTMLInputElement>>(
        (e) => {
          onChange?.(e.target.value);
        },
        [onChange]
      )}
    />
  );
}
