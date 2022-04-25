import { useState, useEffect } from 'react';

import TokenPicker from '../TokenPicker';

import './TokenInputGroup.scss';

interface InputGroupProps {
  readOnly?: boolean;
  changeValue?: (value: string, token: string) => void;
  exclusion: string | null | undefined;
  token: string | null | undefined;
  value: string | null | undefined;
  tokenList: Array<string>;
}

export default function TokenInputGroup({
  readOnly = false,
  tokenList,
  changeValue,
  value,
  exclusion,
  token,
}: InputGroupProps) {
  const [selectedToken, setToken] = useState(token || '');
  const [selectedValue, setValue] = useState(value || '');

  useEffect(() => {
    setValue(value || '');
  }, [value]);

  useEffect(() => {
    setToken(token || '');
  }, [token]);

  return (
    <div className="token-input-group">
      <input
        type="text"
        className="form-control"
        value={selectedValue}
        onChange={(e) => onInputChange(e.target.value)}
      />
      {readOnly ? (
        <button
          type="button"
          className="py-1 px-3 border border-slate-200 rounded-lg dropdown-toggle"
        >
          {selectedToken || 'No Token'}
        </button>
      ) : (
        <TokenPicker
          value={selectedToken}
          onChange={changeSelected}
          tokenList={tokenList}
          exclusion={exclusion}
        />
      )}
    </div>
  );

  function onInputChange(newValue: string) {
    setValue(newValue);
    changeValue?.(newValue, selectedToken);
  }

  function changeSelected(newToken: string) {
    if (newToken === exclusion) return;
    setToken(newToken);
    changeValue?.(selectedValue, newToken);
  }
}
