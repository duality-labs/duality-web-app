import React, { useState, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowUpLong,
  faArrowDownLong,
} from '@fortawesome/free-solid-svg-icons';

import TokenInputGroup from '../../components/TokenInputGroup';
import { useTokens, Token } from '../../components/TokenPicker/mockHooks';

import { useWeb3 } from '../../lib/web3/useWeb3';
import { MsgSwapTicks } from '../../lib/web3/generated/duality/duality.duality/module/types/duality/tx';

import { getRouterEstimates, useRouterResult } from './hooks/useRouter';
import { useSwap } from './hooks/useSwap';

import './Swap.scss';

export default function Swap() {
  const { address } = useWeb3();
  const { data: tokenList = [] } = useTokens();
  const [tokenA, setTokenA] = useState(tokenList[0] as Token | undefined);
  const [tokenB, setTokenB] = useState(undefined as Token | undefined);
  const [valueA, setValueA] = useState<string | undefined>('0');
  const [valueB, setValueB] = useState<string>();
  const [lastUpdatedA, setLastUpdatedA] = useState(true);
  const pairRequest = {
    tokenA: tokenA?.address,
    tokenB: tokenB?.address,
    valueA: lastUpdatedA ? valueA : undefined,
    valueB: lastUpdatedA ? undefined : valueB,
  };
  const { data: routerResult, isValidating: isValidatingRate } =
    useRouterResult({
      tokenA: tokenA?.address,
      tokenB: tokenB?.address,
      valueA: lastUpdatedA ? valueA : undefined,
      valueB: lastUpdatedA ? undefined : valueB,
    });
  const rateData = getRouterEstimates(pairRequest, routerResult);
  const [swapRequest, setSwapRequest] = useState<MsgSwapTicks>();
  useSwap(swapRequest);

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
      if (address && routerResult) {
        // convert to swap request format
        const result = routerResult;
        setSwapRequest({
          amountIn: result.amountIn.toString(),
          tokens: result.tokens,
          prices0: JSON.stringify(
            result.prices0.map((prices) =>
              prices.map((price) => price.toString())
            )
          ),
          prices1: JSON.stringify(
            result.prices1.map((prices) =>
              prices.map((price) => price.toString())
            )
          ),
          fees: JSON.stringify(
            result.fees.map((fees) => fees.map((fee) => fee.toString()))
          ),
          // minAmountOut: calculateOut(result).toString(),
          // fee: calculateFee(result).toString(),
          creator: address,
        });
      }
    },
    [address, routerResult]
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
    <form onSubmit={onFormSubmit} className="swap-page">
      <div className="page-card">
        <h2 className="card-title">Trade</h2>
        <div className="card-row">
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
            title="You Pay"
          ></TokenInputGroup>
        </div>
        <div className="card-row">
          <button
            type="button"
            onClick={swapTokens}
            className="icon-button swap-button"
          >
            <FontAwesomeIcon icon={faArrowUpLong}></FontAwesomeIcon>
            <FontAwesomeIcon icon={faArrowDownLong}></FontAwesomeIcon>
          </button>
        </div>
        <div className="card-row">
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
            title="You Receive"
          ></TokenInputGroup>
        </div>
        <div className="text-info text-row card-row">
          <span className="text-header">Exchange Rate</span>
          <span className="text-value">
            {tokenA && tokenB
              ? `1 ${
                  tokenA.symbol
                } = ${routerResult?.prices0?.[0]?.[0]?.dividedBy(
                  routerResult?.prices1?.[0]?.[0] ?? 1
                )} ${tokenB.symbol}`
              : 'No pair selected'}
          </span>
        </div>
        <div className="text-info text-row card-row">
          <span className="text-header">Price Impact</span>
          <span className="text-value">
            {routerResult?.fees ? `${routerResult.fees[0]}%` : '...'}
          </span>
        </div>
        <input type="submit" value="Swap" />
      </div>
    </form>
  );
}
