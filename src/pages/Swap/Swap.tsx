import React, { useState, useCallback } from 'react';

import TokenInputGroup from '../../components/TokenInputGroup';
import { useTokens, Token } from '../../components/TokenPicker/mockHooks';

import { PairRequest } from './hooks/index';

import { useRouter } from './hooks/useRouter';
import { useSwap } from './hooks/useSwap';

import './Swap.scss';

export default function Swap() {
  const {
    result: tokenList = [],
    isValidating: isValidaingTokens,
    error: tokenError,
  } = useTokens();
  const [tokenA, setTokenA] = useState(tokenList[0] as Token | undefined);
  const [tokenB, setTokenB] = useState(undefined as Token | undefined);
  const [valueA, setValueA] = useState<string | undefined>('0');
  const [valueB, setValueB] = useState<string>();
  const [lastUpdatedA, setLastUpdatedA] = useState(true);
  const {
    data: rateData,
    isValidating: isValidatingRate,
    error: rateError,
  } = useRouter({
    tokenA: tokenA?.address,
    tokenB: tokenB?.address,
    valueA: lastUpdatedA ? valueA : undefined,
    valueB: lastUpdatedA ? undefined : valueB,
  });
  const [swapRequest, setSwapRequest] = useState<PairRequest>();
  const {
    data: swapResponse,
    isValidating: isValidatingSwap,
    error: swapError,
  } = useSwap(swapRequest);
  const dotCount = 3; //useDotCounter(0.25e3);

  const valueAConverted = lastUpdatedA ? valueA : rateData?.valueA;
  const valueBConverted = lastUpdatedA ? rateData?.valueB : valueB;

  const swapTokens = useCallback(
    function () {
      setTokenA(tokenB);
      setTokenB(tokenA);
      setValueA(valueBConverted);
      setValueB(valueAConverted);
      setLastUpdatedA((flag) => !flag);
    },
    [tokenA, tokenB, valueAConverted, valueBConverted]
  );

  const onFormSubmit = useCallback(
    function (event?: React.FormEvent<HTMLFormElement>) {
      if (event) event.preventDefault();
      setSwapRequest({
        tokenA: tokenA?.address,
        tokenB: tokenB?.address,
        valueA: lastUpdatedA ? valueA : undefined,
        valueB: lastUpdatedA ? undefined : valueB,
        path: rateData?.path,
      });
    },
    [
      tokenA?.address,
      tokenB?.address,
      valueA,
      valueB,
      lastUpdatedA,
      rateData?.path,
    ]
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
      <h2 className="cull-hover">Trade</h2>
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
        text="You Pay"
      ></TokenInputGroup>
      <button type="button" id="inverse-btn" onClick={swapTokens}>
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
        disabledInput={true}
        text="You Receive"
      ></TokenInputGroup>
      <div className="text-stone-500">Gas price: {rateData?.gas}</div>
      {((isValidaingTokens || isValidatingRate) && '.'.repeat(dotCount)) || (
        <i className="text-transparent">.</i>
      )}
      <div className="text-red-500">{swapRequest && swapError}</div>
      <div className="text-red-500">{rateError}</div>
      <div className="text-red-500">{tokenError}</div>
      <div className="text-sky-500">
        {!isValidatingSwap && swapResponse
          ? `Traded ${swapResponse.valueA} ${swapResponse.tokenA} to ${swapResponse.valueB} ${swapResponse.tokenB}`
          : ''}
      </div>
      <input type="submit" value="Swap" id="swap-btn" />
    </form>
  );
}
