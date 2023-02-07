import { InputHTMLAttributes, RefObject } from 'react';

import './SearchInput.scss';

interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onInput' | 'onChange'> {
  value: string | undefined;
  onInput?: (value: string) => void;
  onChange?: (value: string) => void;
  innerRef?: RefObject<HTMLInputElement>;
}

export default function SearchInput({
  value,
  onInput,
  onChange,
  innerRef,
  ...rest
}: SearchInputProps) {
  return (
    <div className="search-input">
      <input
        type="search"
        onInput={(e) => onInput?.(e.currentTarget.value)}
        onChange={(e) => onChange?.(e.currentTarget.value)}
        value={value}
        // add sane defaults
        autoComplete="off"
        {...rest}
        // pass inner reference
        ref={innerRef}
      />
    </div>
  );
}
