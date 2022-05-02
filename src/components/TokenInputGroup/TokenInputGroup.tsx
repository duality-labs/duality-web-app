import { useState, useEffect } from 'react';

import TokenPicker from '../TokenPicker';

import { Token } from '../TokenPicker/mockHooks';

import './TokenInputGroup.scss';

interface InputGroupProps {
  changeValue: (value: string, token: Token | undefined) => void;
  exclusion: Token | undefined;
  token: Token | undefined;
  value: string | undefined;
  tokenList: Array<Token>;
}

export default function TokenInputGroup({
  tokenList,
  changeValue,
  value,
  exclusion,
  token,
}: InputGroupProps) {
  const [selectedToken, setToken] = useState(token);
  const [selectedValue, setValue] = useState(value);

  useEffect(() => {
    setValue(value || '');
  }, [value]);

  useEffect(() => {
    setToken(token);
  }, [token]);

  return (
    <div className="token-input-group">
      <input
        type="text"
        className="form-control"
        value={selectedValue || ''}
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
    changeValue(newValue, selectedToken);
  }

  function changeSelected(newToken: Token | undefined) {
    if (newToken === exclusion) return;
    setToken(newToken);
    changeValue(selectedValue || '0', newToken);
  }
}
