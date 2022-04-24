import { useState } from 'react';

import TokenInputGroup from '../../components/TokenInputGroup';
import { useTokens } from '../../components/TokenPicker/mockHooks';

export default function Swap() {
  const { data: tokenList = [], isValidating } = useTokens();
  const [tokens, setTokens] = useState([tokenList[0], null]);
  const [values, setValues] = useState(['0', null]);
  return (
    <div className="swap-page">
      {isValidating ? 'Loading' : 'Loaded'}
      <TokenInputGroup
        changeValue={(value, token) => changeGroupValue(value, token, 0)}
        tokenList={tokenList}
        token={tokens[0]}
        value={values[0]}
        exclusion={tokens[1]}
      ></TokenInputGroup>
      <TokenInputGroup
        changeValue={(value, token) => changeGroupValue(value, token, 1)}
        tokenList={tokenList}
        token={tokens[1]}
        value={values[1]}
        exclusion={tokens[0]}
      ></TokenInputGroup>
    </div>
  );

  function changeGroupValue(value: string, token: string, index: number) {
    setTokens(tokens.map((item, i) => (i === index ? token : item)));
    setValues(values.map((item, i) => (i === index ? value : item)));
  }
}
