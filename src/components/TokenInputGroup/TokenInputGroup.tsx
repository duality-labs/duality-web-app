import { useState } from 'react';

import TokenPicker from '../TokenPicker';

interface InputGroupProps {
  changeValue: (value: string, token: string) => void;
  exclusion: string | null | undefined;
  token: string | null | undefined;
  value: string | null | undefined;
  tokenList: Array<string>;
}

export default function TokenInputGroup({
  tokenList,
  changeValue,
  value,
  exclusion,
  token,
}: InputGroupProps) {
  const [selectedToken, setToken] = useState(token || '');
  const [selectedValue, setValue] = useState(value || '');

  return (
    <div className="input-group">
      <input
        type="text"
        className="form-control"
        value={selectedValue}
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

  function changeSelected(newToken: string) {
    if (newToken === exclusion) return;
    setToken(newToken);
    changeValue(selectedValue, newToken);
  }
}
