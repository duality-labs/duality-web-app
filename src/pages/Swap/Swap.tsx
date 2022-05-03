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

  const [lastKnownRate, setLastKnownRate] = useState(
    undefined as string | undefined
  );
  // remove last known rate if tokens change
  useEffect(() => setLastKnownRate(undefined), [tokenA, tokenB]);

  // get exchange rate
  const { data: rateData, isValidating: isValidatingRate } = useExchangeRate(
    lastUpdatedA ? tokenA : tokenB,
    lastUpdatedA ? tokenB : tokenA,
    lastUpdatedA ? valueA : valueB
  );
  const dotCount = useDotCounter(0.25e3);

  // update last known rate if new information is known and available
  useEffect(() => rateData && setLastKnownRate(rateData?.rate), [rateData]);

  // calculate with last known rate immediately
  const price = lastUpdatedA
    ? Math.round(Number(valueA) * 1e6 * Number(lastKnownRate || 0)) / 1e6
    : Math.round((Number(valueB) * 1e6) / Number(lastKnownRate || 0)) / 1e6;
  const valueAConverted = lastUpdatedA
    ? valueA
    : `${lastKnownRate ? price : '...'}`;
  const valueBConverted = lastUpdatedA
    ? `${lastKnownRate ? price : '...'}`
    : valueB;

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
      <span>Gas price: {rateData?.gas}</span>
      {((isValidaingTokens || isValidatingRate) && '.'.repeat(dotCount)) || (
        <i className="text-transparent">.</i>
      )}
    </div>
  );
}
