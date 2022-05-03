import { useState, useCallback } from 'react';

import TokenInputGroup from '../../components/TokenInputGroup';
import {
  useTokens,
  useExchangeRate,
  useDotCounter,
  Token,
} from '../../components/TokenPicker/mockHooks';

import './Swap.scss';

export default function Swap() {
  const { data: tokenList = [], isValidating: isValidaingTokens } = useTokens();
  const [tokenA, setTokenA] = useState(tokenList[0] as Token | undefined);
  const [tokenB, setTokenB] = useState(undefined as Token | undefined);
  const [valueA, setValueA] = useState('0');
  const [valueB, setValueB] = useState('0');
  const [lastUpdated, setLastUpdated] = useState(true);

  const tokenAddress = lastUpdated ? tokenA?.address : tokenB?.address;
  const otherTokenAddress = lastUpdated ? tokenB?.address : tokenA?.address;
  const value = lastUpdated ? valueA : valueB;
  // get exchange rate
  const { data: rateData, isValidating: isValidatingRate } = useExchangeRate(
    tokenAddress,
    otherTokenAddress,
    value
  );
  const dotCount = useDotCounter(0.25e3);

  const valueAConverted = lastUpdated ? valueA : rateData?.price || '0';
  const valueBConverted = lastUpdated ? rateData?.price || '0' : valueB;

  const swapTokens = useCallback(() => {
    setTokenA(tokenB);
    setTokenB(tokenA);
    setValueA(valueBConverted);
    setValueB(valueAConverted);
  }, [tokenA, tokenB, valueAConverted, valueBConverted]);

  const updateValueA = useCallback((newValue: string) => {
    setValueA(newValue);
    setLastUpdated(true);
  }, []);
  const updateValueB = useCallback((newValue: string) => {
    setValueB(newValue);
    setLastUpdated(false);
  }, []);

  return (
    <div className="swap">
      <TokenInputGroup
        changeValue={updateValueA}
        changeToken={setTokenA}
        tokenList={tokenList}
        token={tokenA}
        value={valueAConverted}
        exclusion={tokenB}
      ></TokenInputGroup>
      <TokenInputGroup
        changeValue={updateValueB}
        changeToken={setTokenB}
        tokenList={tokenList}
        token={tokenB}
        value={valueBConverted}
        exclusion={tokenA}
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
}
