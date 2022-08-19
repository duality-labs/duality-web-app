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
  /** disables both the input and the token (gets overwritten by the other 2) */
  disabled?: boolean;
  disabledInput?: boolean;
  disabledToken?: boolean;
  title?: string;
  maxValue?: number;
  relevantValue?: string;
}

export default function TokenInputGroup({
  onTokenChanged,
  onValueChanged,
  tokenList,
  className,
  exclusion,
  value,
  token,
  disabled = false,
  disabledInput = disabled,
  disabledToken = disabled,
  title,
  maxValue,
  relevantValue,
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
      {title && <h5 className="token-group-title">{title}</h5>}
      {maxValue && <span className="token-group-balance">{maxValue}</span>}
      {relevantValue && (
        <span className="token-group-value">{relevantValue}</span>
      )}
      <input
        type="text"
        className="token-group-input"
        value={value || '...'}
        onInput={onInput}
        onChange={onInputChange}
        disabled={disabledInput}
      />
      <TokenPicker
        value={token}
        onChange={onPickerChange}
        tokenList={tokenList}
        exclusion={exclusion}
        disabled={disabledToken}
      />
    </div>
  );
}

/**
 * Clear invalid characters from the input
 * @param event change event
 */
function onInput(event: React.UIEvent<HTMLInputElement>) {
  cleanInput(event.currentTarget);
}
