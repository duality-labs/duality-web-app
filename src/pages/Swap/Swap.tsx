import { useState, useCallback, useEffect } from 'react';

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
  const { data: rateData, isValidating: isValidatingRate } = useExchangeRate(
    lastUpdatedA ? tokenA : tokenB,
    lastUpdatedA ? tokenB : tokenA,
    lastUpdatedA ? valueA : valueB
  );
  const [lastRate, setLastRate] = useState(rateData);
  const dotCount = useDotCounter(0.25e3);

  const getTempRate = useCallback(
    (
      mode: boolean,
      token: Token | undefined,
      otherToken: Token | undefined,
      value: string,
      otherValue: string
    ): string => {
      if (mode) return value;
      if (rateData?.price) return rateData?.price;
      let rate = NaN;
      if (
        token?.address === lastRate?.otherToken &&
        otherToken?.address === lastRate?.token
      )
        rate = Number(lastRate?.rate);
      else if (
        token?.address === lastRate?.token &&
        otherToken?.address === lastRate?.otherToken
      )
        rate = 1 / Number(lastRate?.rate);
      const price = round(Number(otherValue) * rate, 1e6);
      if (!isNaN(price)) return `${price}`;
      return '...';
    },
    [rateData, lastRate]
  );
  const valueAConverted = getTempRate(
    lastUpdatedA,
    tokenA,
    tokenB,
    valueA,
    valueB
  );
  const valueBConverted = getTempRate(
    !lastUpdatedA,
    tokenB,
    tokenA,
    valueB,
    valueA
  );

  useEffect(() => {
    if (rateData) setLastRate(rateData);
  }, [rateData]);

  const swapTokens = useCallback(() => {
    setTokenA(tokenB);
    setTokenB(tokenA);
    setValueA(valueBConverted);
    setValueB(valueAConverted);
    setLastUpdatedA((a) => !a);
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
      <span>Gas price: {rateData?.gas}</span>
      {((isValidaingTokens || isValidatingRate) && '.'.repeat(dotCount)) || (
        <i className="text-transparent">.</i>
      )}
    </div>
  );
}

function round(value: number, roundNumber: number) {
  return Math.round(value * roundNumber) / roundNumber;
}
