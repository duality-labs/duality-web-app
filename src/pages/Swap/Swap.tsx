import React, { useState, useCallback, useEffect, useMemo } from 'react';
import BigNumber from 'bignumber.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBolt,
  faFlag,
  faArrowRightArrowLeft,
  faSliders,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';

import TokenInputGroup from '../../components/TokenInputGroup';
import { useTokens, Token } from '../../components/TokenPicker/hooks';
import RadioButtonGroupInput from '../../components/RadioButtonGroupInput/RadioButtonGroupInput';
import NumberInput from '../../components/inputs/NumberInput';

import { useWeb3 } from '../../lib/web3/useWeb3';
import {
  useBankBalance,
  useIndexerPairData,
} from '../../lib/web3/indexerProvider';
import { useHasPriceData } from '../../lib/tokenPrices';

import { getRouterEstimates, useRouterResult } from './hooks/useRouter';
import { useSwap } from './hooks/useSwap';

import { formatAmount } from '../../lib/utils/number';
import { getAmountInDenom } from '../../lib/web3/utils/tokens';
import { formatLongPrice } from '../../lib/utils/number';

import './Swap.scss';

type CardType = 'trade' | 'settings';
type OrderType = 'market' | 'limit';

const defaultSlippage = '0.5';

export default function Swap() {
  const { address, connectWallet } = useWeb3();
  const tokenList = useTokens();
  const [tokenA, setTokenA] = useState(
    tokenList.find((token) => token.symbol === 'TKN') as Token | undefined
  );
  const [tokenB, setTokenB] = useState(undefined as Token | undefined);
  const [valueA, setValueA] = useState<string | undefined>('');
  const [valueB, setValueB] = useState<string>();
  const [lastUpdatedA, setLastUpdatedA] = useState(true);
  const pairRequest = {
    tokenA: tokenA?.address,
    tokenB: tokenB?.address,
    valueA: lastUpdatedA ? valueA : undefined,
    valueB: lastUpdatedA ? undefined : valueB,
  };
  const {
    data: routerResult,
    isValidating: isValidatingRate,
    error,
  } = useRouterResult({
    tokenA: tokenA?.address,
    tokenB: tokenB?.address,
    valueA: lastUpdatedA ? valueA : undefined,
    valueB: lastUpdatedA ? undefined : valueB,
  });
  const rateData = getRouterEstimates(pairRequest, routerResult);
  const [{ isValidating: isValidatingSwap }, swapRequest] = useSwap();

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

  const { data: balanceTokenA } = useBankBalance(tokenA);
  const valueAConvertedNumber = new BigNumber(valueAConverted || 0);
  const hasFormData =
    address && tokenA && tokenB && valueAConvertedNumber.isGreaterThan(0);
  const hasSufficientFunds =
    valueAConvertedNumber.isLessThanOrEqualTo(balanceTokenA || 0) || false;

  const [slippage, setSlippage] = useState(defaultSlippage);

  const { data: pair } = useIndexerPairData(tokenA?.address, tokenB?.address);

  const onFormSubmit = useCallback(
    function (event?: React.FormEvent<HTMLFormElement>) {
      if (event) event.preventDefault();
      // calculate tolerance from user slippage settings
      // set tiny minimum of tolerance as the frontend calculations
      // don't always exactly align with the backend calculations
      const tolerance = Math.max(1e-12, parseFloat(slippage) / 100);
      if (address && routerResult && tokenA && tokenB && !isNaN(tolerance)) {
        // convert to swap request format
        const result = routerResult;
        // Cosmos requires tokens in integer format of smallest denomination
        // add slippage tolerance
        const minOut = result.amountOut.multipliedBy(1 - tolerance);
        // calculate gas estimate
        const tickMin =
          routerResult.tickIndexIn &&
          routerResult.tickIndexOut &&
          Math.min(
            routerResult.tickIndexIn.negated().toNumber(),
            routerResult.tickIndexOut.negated().toNumber()
          );
        const tickMax =
          routerResult.tickIndexIn &&
          routerResult.tickIndexOut &&
          Math.max(
            routerResult.tickIndexIn.negated().toNumber(),
            routerResult.tickIndexOut.negated().toNumber()
          );
        const { ticks, token0 } = pair || {};
        const ticksPassed =
          (tickMin !== undefined &&
            tickMax !== undefined &&
            ticks?.filter((tick) => {
              return (
                tick.tickIndex.isGreaterThanOrEqualTo(tickMin) &&
                tick.tickIndex.isLessThanOrEqualTo(tickMax)
              );
            })) ||
          [];
        const forward = result.tokenIn === token0;
        const ticksUsed =
          ticksPassed?.filter(
            forward
              ? (tick) => !tick.reserve1.isZero()
              : (tick) => !tick.reserve0.isZero()
          ).length || 0;
        const ticksUnused =
          new Set<number>([
            ...(ticksPassed?.map((tick) => tick.tickIndex.toNumber()) || []),
          ]).size - ticksUsed;
        const gasEstimate = ticksUsed
          ? // 120000 base
            120000 +
            // add 80000 if multiple ticks need to be traversed
            (ticksUsed > 1 ? 80000 : 0) +
            // add 700000 for each tick that we need to remove liquidity from
            700000 * (ticksUsed - 1) +
            // add 400000 for each tick we pass without drawing liquidity from
            400000 * ticksUnused +
            // add another 400000 for each reverse tick we pass without drawing liquidity from
            (forward ? 0 : 400000 * ticksUnused)
          : 0;

        swapRequest(
          {
            amountIn:
              getAmountInDenom(
                tokenA,
                // shift by 18 decimal places representing 18 decimal place string serialization of sdk.Dec inputs to the backend
                result.amountIn.shiftedBy(18),
                tokenA?.display
              ) || '0',
            tokenIn: result.tokenIn,
            tokenA: result.tokenIn,
            tokenB: result.tokenOut,
            minOut:
              getAmountInDenom(
                tokenB,
                // shift by 18 decimal places representing 18 decimal place string serialization of sdk.Dec inputs to the backend
                minOut.shiftedBy(18),
                tokenB?.display
              ) || '0',
            creator: address,
            receiver: address,
          },
          gasEstimate
        );
      }
    },
    [address, routerResult, pair, tokenA, tokenB, slippage, swapRequest]
  );

  const onValueAChanged = useCallback((newValue: string) => {
    setValueA(newValue);
    setLastUpdatedA(true);
  }, []);
  const onValueBChanged = useCallback((newValue: string) => {
    setValueB(newValue);
    setLastUpdatedA(false);
  }, []);

  const [cardType, setCardType] = useState<CardType>('trade');
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [rateTokenOrderAuto, setRateTokenOrderAuto] =
    useState<[Token, Token]>();
  const [rateTokenOrderManual, setRateTokenOrderManual] =
    useState<[Token, Token]>();
  const rateTokenOrder = rateTokenOrderManual || rateTokenOrderAuto;

  const toggleRateTokenOrderManual = useCallback(() => {
    setRateTokenOrderManual(
      (tokens) =>
        (tokens || rateTokenOrderAuto)?.slice().reverse() as [Token, Token]
    );
  }, [rateTokenOrderAuto]);

  // set the token order for the rate
  useEffect(() => {
    if (tokenA && tokenB) {
      // place B as stable denominator
      if (!isStablecoin(tokenA) && isStablecoin(tokenB)) {
        setRateTokenOrderAuto([tokenA, tokenB]);
      }
      // place in order of swap trade
      else {
        setRateTokenOrderAuto([tokenB, tokenA]);
      }
    }
    function isStablecoin(token: Token) {
      return token.description?.toLowerCase().includes('stablecoin');
    }
  }, [tokenA, tokenB]);

  // if tokens change then reset the manual order setting
  useEffect(() => {
    if (tokenA && tokenB) {
      setRateTokenOrderManual((tokenOrder) => {
        // keep settings if tokens have not changed
        if (tokenOrder?.every((token) => [tokenA, tokenB].includes(token))) {
          return tokenOrder;
        }
        // remove settings if they have
        return undefined;
      });
    }
  }, [tokenA, tokenB]);

  const hasPriceData = useHasPriceData([tokenA, tokenB]);

  const priceImpact =
    routerResult &&
    routerResult.priceIn?.isGreaterThan(0) &&
    routerResult.priceOut?.isGreaterThan(0)
      ? new BigNumber(
          new BigNumber(routerResult.priceOut)
            .dividedBy(new BigNumber(routerResult.priceIn))
            .multipliedBy(100)
        ).minus(100)
      : undefined;

  const tradeCard = (
    <div className="trade-card">
      <div className="page-card">
        <div className="row mb-3">
          <h3 className="h3 card-title">Trade</h3>
          <button
            className="icon-button ml-auto"
            type="button"
            onClick={() => setCardType('settings')}
          >
            <FontAwesomeIcon icon={faSliders}></FontAwesomeIcon>
          </button>
        </div>
        <div className="card-row order-type mb-4">
          <RadioButtonGroupInput<OrderType>
            className="order-type-input mb-4 hide"
            values={useMemo(
              () => ({
                market: (
                  <>
                    <FontAwesomeIcon
                      className="mr-3"
                      icon={faBolt}
                    ></FontAwesomeIcon>
                    Market Order
                  </>
                ),
                limit: (
                  <>
                    <FontAwesomeIcon
                      className="mr-3"
                      icon={faFlag}
                    ></FontAwesomeIcon>
                    Limit Order
                  </>
                ),
              }),
              []
            )}
            value={orderType}
            onChange={setOrderType}
          />
        </div>
        <div className="card-row">
          <TokenInputGroup
            variant={
              (!hasSufficientFunds || error?.insufficientLiquidityIn) && 'error'
            }
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
        </div>
        <div className="card-row my-2">
          <button
            type="button"
            onClick={swapTokens}
            className="icon-button swap-button"
          >
            <FontAwesomeIcon
              icon={faArrowRightArrowLeft}
              rotation={90}
            ></FontAwesomeIcon>
          </button>
        </div>
        <div className="card-row mb-4">
          <TokenInputGroup
            variant={error?.insufficientLiquidityOut && 'error'}
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
        </div>
        <div className="card-row text-detail">
          {tokenA &&
            tokenB &&
            parseFloat(valueAConverted || '') > 0 &&
            parseFloat(valueBConverted || '') > 0 && (
              <div className="text-grid my-3">
                <span className="text-header">Exchange Rate</span>
                <span className="text-value">
                  {routerResult && rateTokenOrder ? (
                    <>
                      1 {rateTokenOrder[1].symbol} ={' '}
                      {formatLongPrice(
                        routerResult.tokenIn === rateTokenOrder[1].address
                          ? routerResult.amountOut
                              .dividedBy(routerResult.amountIn)
                              .toFixed()
                          : routerResult.amountIn
                              .dividedBy(routerResult.amountOut)
                              .toFixed()
                      )}{' '}
                      {rateTokenOrder[0].symbol}
                      <button
                        className="icon-button ml-3"
                        type="button"
                        onClick={toggleRateTokenOrderManual}
                      >
                        <FontAwesomeIcon
                          icon={faArrowRightArrowLeft}
                        ></FontAwesomeIcon>
                      </button>
                    </>
                  ) : isValidatingRate ? (
                    'Finding exchange rate...'
                  ) : (
                    'No exchange information'
                  )}
                </span>
                <span className="text-header">Price Impact</span>
                {priceImpact && (
                  <span
                    className={[
                      'text-value',
                      (() => {
                        switch (true) {
                          case priceImpact.isGreaterThanOrEqualTo(0):
                            return 'text-success';
                          case priceImpact.isGreaterThan(-1):
                            return 'text-value';
                          case priceImpact.isGreaterThan(-5):
                            return 'text';
                          default:
                            return 'text-error';
                        }
                      })(),
                    ].join(' ')}
                  >
                    {formatAmount(priceImpact.toFixed(), {
                      maximumSignificantDigits: 4,
                      minimumSignificantDigits: 4,
                    })}
                    %
                  </span>
                )}
              </div>
            )}
        </div>
        <div className="my-4">
          {address ? (
            hasFormData &&
            hasSufficientFunds &&
            !error?.insufficientLiquidity &&
            !error?.insufficientLiquidityIn &&
            !error?.insufficientLiquidityOut ? (
              <button
                className="submit-button button-primary"
                type="submit"
                disabled={!new BigNumber(valueBConverted || 0).isGreaterThan(0)}
              >
                {orderType === 'limit' ? 'Place Limit Order' : 'Swap'}
              </button>
            ) : error?.insufficientLiquidity ? (
              <button className="submit-button button-error" type="button">
                Insufficient liquidity
              </button>
            ) : hasFormData ? (
              <button className="submit-button button-error" type="button">
                Insufficient funds
              </button>
            ) : (
              <button
                className="submit-button button-primary"
                type="button"
                disabled
              >
                Enter Token Amount
              </button>
            )
          ) : (
            <button
              className="submit-button button-primary"
              type="button"
              onClick={connectWallet}
            >
              Connect Wallet
            </button>
          )}
        </div>
        {hasPriceData && (
          <div className="attribution">
            Price data from{' '}
            <a
              target="_blank"
              rel="noreferrer"
              href="https://www.coingecko.com/"
            >
              CoinGecko
            </a>
          </div>
        )}
      </div>
    </div>
  );

  const settingsCard = (
    <div
      className={[
        'settings-card',
        `settings-card--${cardType === 'settings' ? 'visible' : 'hidden'}`,
      ].join(' ')}
    >
      <div className="page-card">
        <div className="row mb-4">
          <h3 className="h3 card-title">Settings</h3>
          <button
            className="icon-button ml-auto"
            type="button"
            onClick={() => setCardType('trade')}
          >
            <FontAwesomeIcon icon={faXmark}></FontAwesomeIcon>
          </button>
        </div>
        <div className="row mb-3">
          <h4 className="card-title">Max Slippage</h4>
          <NumberInput
            type="text"
            className="ml-auto"
            value={slippage}
            appendString="%"
            onChange={setSlippage}
          />
          <button
            type="button"
            className="button-info ml-2"
            onClick={() => setSlippage(defaultSlippage)}
          >
            Auto
          </button>
        </div>
      </div>
    </div>
  );
  return (
    <form
      onSubmit={onFormSubmit}
      className={['page swap-page', isValidatingSwap && 'disabled']
        .filter(Boolean)
        .join(' ')}
    >
      {tradeCard}
      {settingsCard}
    </form>
  );
}
