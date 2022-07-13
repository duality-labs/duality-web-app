import React, { useState, useCallback } from 'react';

import TokenInputGroup from '../../components/TokenInputGroup';
import {
  useTokens,
  useDotCounter,
  Token,
} from '../../components/TokenPicker/mockHooks';

import { useWeb3 } from '../../lib/web3/useWeb3';
import { MsgSwapTicks } from '../../lib/web3/generated/duality/duality.duality/module/types/duality/tx';

import { useRouter } from './hooks/useRouter';
import { useSwap } from './hooks/useSwap';

import './Swap.scss';
import { router } from './hooks/router';
import { useIndexerData } from '../../lib/web3/indexerProvider';

export default function Swap() {
  const { address } = useWeb3();
  const { data: tokenList = [], isValidating: isValidaingTokens } = useTokens();
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
  const [swapRequest, setSwapRequest] = useState<MsgSwapTicks>();
  const {
    data: swapResponse,
    isValidating: isValidatingSwap,
    error: swapError,
  } = useSwap(swapRequest);
  const dotCount = useDotCounter(0.25e3);

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

  const { data: state } = useIndexerData();
  const onFormSubmit = useCallback(
    function (event?: React.FormEvent<HTMLFormElement>) {
      if (event) event.preventDefault();
      if (address && state && tokenA?.address && tokenB?.address && valueAConverted && valueBConverted) {
        // convert to swap request format
        const result = router(state, tokenA?.address, tokenB?.address, valueAConverted);
        setSwapRequest({
          amountIn: result.amountIn.toString(),
          tokens: result.tokens,
          prices0: JSON.stringify(result.prices0.map(prices => prices.map(price => price.toString()))),
          prices1: JSON.stringify(result.prices1.map(prices => prices.map(price => price.toString()))),
          fees: JSON.stringify(result.fees.map(fees => fees.map(fee => fee.toString()))),
          // minAmountOut: calculateOut(result).toString(),
          // fee: calculateFee(result).toString(),
          creator: address,
        });
      }
    },
    [state, address, tokenA?.address, tokenB?.address, valueAConverted, valueBConverted]
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
        disabledInput={true}
      ></TokenInputGroup>
      <div className="text-stone-500">Gas price: {rateData?.gas}</div>
      {((isValidaingTokens || isValidatingRate) && '.'.repeat(dotCount)) || (
        <i className="text-transparent">.</i>
      )}
      <div className="text-red-500">{swapRequest && swapError}</div>
      <div className="text-red-500">{rateError}</div>
      <div className="text-sky-500">
        {!isValidatingSwap && swapResponse
          ? `Traded ~ ${valueA} ${tokenA?.address} to ${valueB} ${tokenB?.address}`
          : ''}
      </div>
      <input
        type="submit"
        value="Swap"
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded m-auto block cursor-pointer"
      />
    </form>
  );
}
