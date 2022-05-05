import React, { useState, useEffect } from 'react';

import TokenPicker from '../TokenPicker';

import { Token } from '../TokenPicker/mockHooks';

import { cleanInput } from './utils';

import './TokenInputGroup.scss';

interface InputGroupProps {
  changeToken: (token?: Token) => void;
  changeValue: (value: string) => void;
  exclusion?: Token;
  token?: Token;
  value?: string;
  className?: string;
  tokenList: Array<Token>;
}

export default function TokenInputGroup({
  tokenList,
  changeValue,
  changeToken,
  value,
  exclusion,
  className,
  token,
}: InputGroupProps) {
  const [selectedToken, setToken] = useState(token);
  const [selectedValue, setValue] = useState(value);

  useEffect(() => {
    setValue(value);
  }, [value]);

  useEffect(() => {
    setToken(token);
  }, [token]);

  return (
    <div className={`${className || ''} token-input-group`}>
      <input
        type="text"
        className="form-control"
        value={selectedValue ?? '...'}
        onInput={onInput}
        onChange={(e) => onInputChange(e.target.value)}
      />
      <TokenPicker
        value={selectedToken}
        onChange={changeSelected}
        tokenList={tokenList}
        exclusion={exclusion}
      />
    </div>
  );

  function onInputChange(newValue: string) {
    setValue(newValue);
    changeValue(newValue);
  }

  function changeSelected(newToken: Token | undefined) {
    if (newToken === exclusion) return;
    setToken(newToken);
    changeToken(newToken);
  }
}

/**
 * Clear invalid characters from the input
 * @param {React.FormEvent<HTMLInputElement>} event change event
 * @returns {void}
 */
function onInput(event: React.FormEvent<HTMLInputElement>) {
  cleanInput(event.currentTarget);
}
