import { useEffect, useState, useCallback } from 'react';

import TokenInputGroup from '../../components/TokenInputGroup';
import {
  useTokens,
  useExchangeRate,
  useDotCounter,
  Token,
} from '../../components/TokenPicker/mockHooks';

import './Swap.scss';

export default function Swap() {
  const [lastUpdatedPrice, setLastUpdatedPrice] = useState('0');
  const [lastUpdatedIndex, setLastUpdatedIndex] = useState(0);
  const { data: rateData, isValidating: isValidatingRate } = useExchangeRate(
    lastUpdatedPrice,
    lastUpdatedIndex
  );
  const { data: tokenList = [], isValidating: isValidaingTokens } = useTokens();
  const [tokens, setTokens] = useState([tokenList[0], undefined]);
  const [values, setValues] = useState(['0', '0']);
  const dotCount = useDotCounter(0.25e3);

  useEffect(() => {
    const otherIndex = +!rateData?.index;
    setValues(
      values.map((item, i) =>
        i === otherIndex ? rateData?.price || '0' : item
      )
    );
  }, [rateData, values]);

  const swapTokens = useCallback(() => {
    setTokens(tokens.reverse());
    setValues(values.reverse());
  }, [tokens, values]);

  return (
    <div className="swap">
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
      <button
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded m-auto block"
        onClick={() => swapTokens()}
      >
        Swap
      </button>
      {((isValidaingTokens || isValidatingRate) && '.'.repeat(dotCount)) || (
        <i className="text-transparent">.</i>
      )}
    </div>
  );

  function changeGroupValue(
    value: string,
    token: Token | undefined,
    index: number
  ) {
    setTokens(tokens.map((item, i) => (i === index ? token : item)));
    setValues(values.map((item, i) => (i === index ? value : item)));
    setLastUpdatedIndex(index);
    setLastUpdatedPrice(value);
  }
}
