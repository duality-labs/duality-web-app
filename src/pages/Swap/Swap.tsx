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
  const [lastUpdatedA, setLastUpdatedA] = useState(true);

  const tokenAddress = lastUpdatedA ? tokenA?.address : tokenB?.address;
  const otherTokenAddress = lastUpdatedA ? tokenB?.address : tokenA?.address;
  const value = lastUpdatedA ? valueA : valueB;
  // get exchange rate
  const { data: rateData, isValidating: isValidatingRate } = useExchangeRate(
    tokenAddress,
    otherTokenAddress,
    value
  );
  const dotCount = useDotCounter(0.25e3);

  // calculate with last known rate immediately
  const price = lastUpdatedA
    ? Math.round(Number(value) * 1e6 * Number(rateData?.rate || 0)) / 1e6
    : Math.round((Number(value) * 1e6) / Number(rateData?.rate || 0)) / 1e6;
  const valueAConverted = lastUpdatedA ? valueA : `${price || 0}`;
  const valueBConverted = lastUpdatedA ? `${price || 0}` : valueB;

  const swapTokens = useCallback(() => {
    setTokenA(tokenB);
    setTokenB(tokenA);
    setValueA(valueBConverted);
    setValueB(valueAConverted);
  }, [tokenA, tokenB, valueAConverted, valueBConverted]);

  const updateValueA = useCallback((newValue: string) => {
    setValueA(newValue);
    setLastUpdatedA(true);
  }, []);
  const updateValueB = useCallback((newValue: string) => {
    setValueB(newValue);
    setLastUpdatedA(false);
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
