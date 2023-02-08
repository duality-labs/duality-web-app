import {
  useCallback,
  InputHTMLAttributes,
  RefObject,
  FormEvent,
  ChangeEvent,
} from 'react';

import './SearchInput.scss';

interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onInput' | 'onChange'> {
  value: string | undefined;
  onInput?: (value: string, event: FormEvent<HTMLInputElement>) => void;
  onChange?: (value: string, event: ChangeEvent<HTMLInputElement>) => void;
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
    <label className="search-input">
      <input
        type="search"
        onInput={useCallback(
          (e: FormEvent<HTMLInputElement>) =>
            onInput?.(e.currentTarget.value, e),
          [onInput]
        )}
        onChange={useCallback(
          (e: ChangeEvent<HTMLInputElement>) =>
            onChange?.(e.currentTarget.value, e),
          [onChange]
        )}
        value={value}
        // add sane defaults
        autoComplete="off"
        {...rest}
        // pass inner reference
        ref={innerRef}
      />
    </label>
  );
}
