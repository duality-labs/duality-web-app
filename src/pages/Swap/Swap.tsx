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
  const { data: tokenList = [], isValidating: isValidaingTokens } = useTokens();
  const [tokenA, setTokenA] = useState(tokenList[0] as Token | undefined);
  const [tokenB, setTokenB] = useState(undefined as Token | undefined);
  const [valueA, setValueA] = useState('0');
  const [valueB, setValueB] = useState('0');
  const [lastUpdated, setLastUpdated] = useState(true);
  const [tokenRequest, setTokenRequest] = useState({
    token: tokenA?.address || '',
    otherToken: tokenB?.address || '',
    value: valueA,
  });
  const { data: rateData, isValidating: isValidatingRate } =
    useExchangeRate(tokenRequest);
  const dotCount = useDotCounter(0.25e3);

  useEffect(() => {
    const token = lastUpdated ? tokenA : tokenB;
    const otherToken = lastUpdated ? tokenB : tokenA;
    const value = lastUpdated ? valueA : valueB;
    if (!token || !otherToken || !value) return; // TODO add clear
    setTokenRequest({
      token: token?.address || '',
      otherToken: otherToken?.address || '',
      value: value,
    });
  }, [valueA, tokenA, valueB, tokenB, lastUpdated]);

  useEffect(() => {
    const token = lastUpdated ? tokenA : tokenB;
    const otherToken = lastUpdated ? tokenB : tokenA;
    const value = lastUpdated ? valueA : valueB;
    if (token?.address !== rateData?.token) return;
    if (otherToken?.address !== rateData?.otherToken) return;
    if (value !== rateData?.value) return;
    if (lastUpdated) setValueB(rateData.price || '0');
    else setValueA(rateData.price || '0');
    // This should only run when the rate data change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rateData]);

  const swapTokens = useCallback(() => {
    setTokenA(tokenB);
    setTokenB(tokenA);
    setValueA(valueB);
    setValueB(valueA);
  }, [tokenA, tokenB, valueA, valueB]);

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
        value={valueA}
        exclusion={tokenB}
      ></TokenInputGroup>
      <TokenInputGroup
        changeValue={updateValueB}
        changeToken={setTokenB}
        tokenList={tokenList}
        token={tokenB}
        value={valueB}
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
