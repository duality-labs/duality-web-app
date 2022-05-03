import { useState, useCallback, useEffect } from 'react';

import TokenInputGroup from '../../components/TokenInputGroup';
import {
  useTokens,
  useExchangeRate,
  useDotCounter,
  Token,
  IExchangeRate,
} from '../../components/TokenPicker/mockHooks';

import './Swap.scss';

export default function Swap() {
  const { data: tokenList = [], isValidating: isValidaingTokens } = useTokens();
  const [tokenA, setTokenA] = useState(tokenList[0] as Token | undefined);
  const [tokenB, setTokenB] = useState(undefined as Token | undefined);
  const [valueA, setValueA] = useState('0' as string | undefined);
  const [valueB, setValueB] = useState('0' as string | undefined);
  const [lastUpdatedA, setLastUpdatedA] = useState(true);

  const token = lastUpdatedA ? tokenA : tokenB;
  const otherToken = lastUpdatedA ? tokenB : tokenA;
  const value = lastUpdatedA ? valueA : valueB;
  const [lastKnownRate, setLastKnownRate] = useState(
    undefined as IExchangeRate | undefined
  );
  // remove last known rate if tokens change
  useEffect(() => setLastKnownRate(undefined), [tokenA, tokenB]);

  // get exchange rate
  const { data: rateData, isValidating: isValidatingRate } = useExchangeRate(
    token,
    otherToken,
    value
  );
  const dotCount = useDotCounter(0.25e3);

  // update last known rate if new information is known and available
  useEffect(() => rateData && setLastKnownRate(rateData), [rateData]);

  const [approximateRate, setApproximateRate] = useState(
    undefined as string | undefined
  );
  useEffect(() => {
    if (
      lastKnownRate?.token === token?.address &&
      lastKnownRate?.otherToken === otherToken?.address
    ) {
      setApproximateRate(lastKnownRate?.rate);
    } else if (
      lastKnownRate?.token === otherToken?.address &&
      lastKnownRate?.otherToken === token?.address
    ) {
      setApproximateRate(`${1 / Number(lastKnownRate?.rate)}`);
    } else {
      setApproximateRate(undefined);
    }
  }, [lastKnownRate, token, otherToken]);

  // calculate with last known rate immediately
  const price =
    approximateRate &&
    Math.round(Number(value) * Number(approximateRate || 0) * 1e6) / 1e6;
  const valueAConverted = lastUpdatedA
    ? valueA
    : price
    ? `${price}`
    : undefined;
  const valueBConverted = lastUpdatedA
    ? price
      ? `${price}`
      : undefined
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
