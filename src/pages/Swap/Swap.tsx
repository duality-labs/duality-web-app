import React, { useState, useCallback } from 'react';

import TokenInputGroup from '../../components/TokenInputGroup';
import {
  useTokens,
  useDotCounter,
  Token,
} from '../../components/TokenPicker/mockHooks';

import { PairRequest } from './hooks/index';

import { useIndexer } from './hooks/useIndexer';
import { useSwap } from './hooks/useSwap';

import './Swap.scss';

export default function Swap() {
  const { data: tokenList = [], isValidating: isValidaingTokens } = useTokens();
  const [tokenA, setTokenA] = useState(tokenList[0] as Token | undefined);
  const [tokenB, setTokenB] = useState(undefined as Token | undefined);
  const [valueA, setValueA] = useState<string | undefined>('0');
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
  const [swapRequest, setSwapRequest] = useState<PairRequest>();
  const {
    data: swapResponse,
    isValidating: isValidatingSwap,
    error: swapError,
  } = useSwap(swapRequest);
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
      if (event) event.preventDefault();
      setSwapRequest({
        address0: tokenA?.address ?? '',
        address1: tokenB?.address ?? '',
        value0: valueA ?? '',
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
      <div className="text-red-500">{swapError}</div>
      <div className="text-red-500">{rateError}</div>
      <div className="text-sky-500">
        {!isValidatingSwap && swapResponse
          ? `Traded ${swapResponse?.value0} ${swapResponse?.address0} to ${swapResponse?.value1} ${swapResponse?.address1}`
          : ``}
      </div>
      <input
        type="submit"
        value="Swap"
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded m-auto block cursor-pointer"
      />
    </form>
  );
}
