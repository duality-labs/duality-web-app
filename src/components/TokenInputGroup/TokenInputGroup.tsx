import React, { useCallback } from 'react';

import TokenPicker from '../TokenPicker';

import { Token } from '../TokenPicker/mockHooks';

import { cleanInput } from './utils';

import './TokenInputGroup.scss';

interface InputGroupProps {
  onTokenChanged?: (token?: Token) => void;
  onValueChanged?: (value: string) => void;
  tokenList: Array<Token>;
  className?: string;
  exclusion?: Token;
  value?: string;
  token?: Token;
}

export default function TokenInputGroup({
  onTokenChanged,
  onValueChanged,
  tokenList,
  className,
  exclusion,
  value,
  token,
}: InputGroupProps) {
  const onInputChange = useCallback(
    function (event: React.ChangeEvent<HTMLInputElement>) {
      if (typeof onValueChanged === 'function')
        onValueChanged(event.currentTarget.value);
    },
    [onValueChanged]
  );

  const onPickerChange = useCallback(
    function (newToken: Token | undefined) {
      if (newToken === exclusion) return;
      if (typeof onTokenChanged === 'function') onTokenChanged(newToken);
    },
    [onTokenChanged, exclusion]
  );

  return (
    <div className={`${className || ''} token-input-group`}>
      <input
        type="text"
        className="form-control"
        value={value || '...'}
        onInput={onInput}
        onChange={onInputChange}
      />
      <TokenPicker
        value={token}
        onChange={onPickerChange}
        tokenList={tokenList}
        exclusion={exclusion}
      />
    </div>
  );
}

/**
 * Clear invalid characters from the input
 * @param {React.UIEvent<HTMLInputElement>} event change event
 * @returns {void}
 */
function onInput(event: React.UIEvent<HTMLInputElement>) {
  cleanInput(event.currentTarget);
}
