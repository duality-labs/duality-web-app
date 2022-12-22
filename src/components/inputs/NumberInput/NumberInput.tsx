import { InputHTMLAttributes } from 'react';

import './NumberInput.scss';

interface NumberInputProps extends InputHTMLAttributes<HTMLInputElement> {
  // restrict value type to only strings for easier handling
  value: string | undefined;
}

export default function NumberInput({
  className,
  placeholder = '0',
  value = '',
  ...inputProps
}: NumberInputProps) {
  return (
    <input
      {...inputProps}
      className={['number-input', className].filter(Boolean).join(' ')}
      type="text"
      placeholder={placeholder}
      value={value}
    />
  );
}
