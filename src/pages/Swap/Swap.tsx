import { useState, useCallback, useEffect } from 'react';

import TokenInputGroup from '../../components/TokenInputGroup';
import {
  useTokens,
  useExchangeRate,
  useDotCounter,
  Token,
} from '../../components/TokenPicker/mockHooks';

import './Swap.scss';

type GetRateType = (
  keepValueMode: boolean,
  token: Token | undefined,
  otherToken: Token | undefined,
  value: string,
  otherValue: string
) => string;

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

  const getRate = useCallback<GetRateType>(
    /**
     * Updates the value of a token based on the rate data and
     * recent data until the rate data get fetched
     * @param {boolean} keepValueMode when true the value will remain the same (true if this was the last value to change)
     * @param {Token} token the token of the group
     * @param {Token} otherToken the token of the other group
     * @param {string} value the value of the group
     * @param {string} otherValue the value of the the other group
     * @returns {string} the value of the taken as a string
     */
    (keepValueMode, token, otherToken, value, otherValue) => {
      if (keepValueMode) return value;
      if (rateData?.price) return rateData?.price;

      const listIn = [token?.address, otherToken?.address];
      const listOut = [lastRate?.token, lastRate?.otherToken];

      let rate = NaN;
      if (`${listIn}` === `${listOut}`) {
        rate = Number(lastRate?.rate);
      } else if (`${listIn}` === `${listOut.reverse()}`) {
        rate = 1 / Number(lastRate?.rate);
      }

      return `${round(Number(otherValue) * rate, 1e6) || ''}`;
    },
    [rateData, lastRate]
  );

  const valueAConverted = getRate(lastUpdatedA, tokenA, tokenB, valueA, valueB);
  const valueBConverted = getRate(
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
        value={valueAConverted || '0'}
        exclusion={tokenB}
      ></TokenInputGroup>
      <TokenInputGroup
        changeValue={updateValueB}
        changeToken={setTokenB}
        tokenList={tokenList}
        token={tokenB}
        value={valueBConverted || '0'}
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
