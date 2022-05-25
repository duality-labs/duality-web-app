import React, { useState, useCallback } from 'react';

import TokenInputGroup from '../../components/TokenInputGroup';
import {
  useTokens,
  useDotCounter,
  Token,
  useSwap,
  SwapRequest,
} from '../../components/TokenPicker/mockHooks';

import { useIndexer } from './hooks/useIndexer';

import './Swap.scss';

export default function Swap() {
  const { data: tokenList = [], isValidating: isValidaingTokens } = useTokens();
  const [tokenA, setTokenA] = useState(tokenList[0] as Token | undefined);
  const [tokenB, setTokenB] = useState(undefined as Token | undefined);
  const [valueA, setValueA] = useState<string>();
  const [valueB, setValueB] = useState<string>();
  const [lastUpdatedA, setLastUpdatedA] = useState(true);
  const {
    result: rateData,
    isValidating: isValidatingRate,
    error: rateError,
  } = useIndexer({
    address0: lastUpdatedA ? tokenA?.address : tokenB?.address,
    address1: lastUpdatedA ? tokenB?.address : tokenA?.address,
    value0: lastUpdatedA ? valueA : valueB,
  });
  const [swapRequest, setSwapRequest] = useState(
    undefined as SwapRequest | undefined
  );
  const { data: swapResponse, isValidating: isValidatingSwap } =
    useSwap(swapRequest);
  const dotCount = useDotCounter(0.25e3);

  const valueAConverted = lastUpdatedA ? valueA : rateData?.value1;
  const valueBConverted = lastUpdatedA ? rateData?.value1 : valueB;

  const swapTokens = useCallback(
    function () {
      setTokenA(tokenB);
      setTokenB(tokenA);
      setValueA(valueBConverted);
      setValueB(valueAConverted);
      setLastUpdatedA((a) => !a);
    },
    [tokenA, tokenB, valueAConverted, valueBConverted]
  );

  const onFormSubmit = useCallback(
    function (event?: React.FormEvent<HTMLFormElement>) {
      if (event instanceof Event) event.preventDefault();
      setSwapRequest({
        token: tokenA?.address ?? '',
        otherToken: tokenB?.address ?? '',
        value: valueA ?? '',
      });
    },
    [tokenA?.address, tokenB?.address, valueA]
  );

  const onValueAChanged = useCallback((newValue: string) => {
    setValueA(newValue);
    setLastUpdatedA(true);
  }, []);
  const onValueBChanged = useCallback((newValue: string) => {
    setValueB(newValue);
    setLastUpdatedA(false);
  }, []);

  return (
    <form className="swap-page" onSubmit={onFormSubmit}>
      <TokenInputGroup
        onValueChanged={onValueAChanged}
        onTokenChanged={setTokenA}
        tokenList={tokenList}
        token={tokenA}
        value={valueAConverted}
        className={
          isValidatingRate && !lastUpdatedA
            ? valueAConverted
              ? 'estimated-rate'
              : 'loading-token'
            : ''
        }
        exclusion={tokenB}
      ></TokenInputGroup>
      <button
        type="button"
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded m-auto block"
        onClick={swapTokens}
      >
        &#8693;
      </button>
      <TokenInputGroup
        onValueChanged={onValueBChanged}
        onTokenChanged={setTokenB}
        tokenList={tokenList}
        token={tokenB}
        value={valueBConverted}
        className={
          isValidatingRate && lastUpdatedA
            ? valueBConverted
              ? 'estimated-rate'
              : 'loading-token'
            : ''
        }
        exclusion={tokenA}
      ></TokenInputGroup>
      <div className="text-stone-500">Gas price: {rateData?.gas}</div>
      {((isValidaingTokens || isValidatingRate) && '.'.repeat(dotCount)) || (
        <i className="text-transparent">.</i>
      )}
      <div className="text-red-500">{rateError}</div>
      <div>{isValidatingSwap ? 'Loading...' : swapResponse}</div>
      <input
        type="submit"
        value="Swap"
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded m-auto block cursor-pointer"
      />
    </form>
  );
}
