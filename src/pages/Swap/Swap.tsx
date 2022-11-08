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

import { useWeb3 } from '../../lib/web3/useWeb3';
import { useBankBalance } from '../../lib/web3/indexerProvider';
import { useHasPriceData } from '../../lib/tokenPrices';

import { getRouterEstimates, useRouterResult } from './hooks/useRouter';
import { useSwap } from './hooks/useSwap';

import { formatPrice } from '../../lib/bignumber.utils';
import { cleanInput } from '../../components/TokenInputGroup/utils';

import './Swap.scss';

type CardType = 'trade' | 'settings';
type OrderType = 'market' | 'limit';

const { REACT_APP__COIN_MIN_DENOM_EXP = '18' } = process.env;
const denomExponent = parseInt(REACT_APP__COIN_MIN_DENOM_EXP) || 0;
const defaultSlippage = '0.5%';

export default function Swap() {
  const { address, connectWallet } = useWeb3();
  const tokenList = useTokens();
  const [tokenA, setTokenA] = useState(
    tokenList.find((token) => token.symbol === 'TKN') as Token | undefined
  );
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

  const onFormSubmit = useCallback(
    function (event?: React.FormEvent<HTMLFormElement>) {
      if (event) event.preventDefault();
      if (address && routerResult) {
        // convert to swap request format
        const result = routerResult;
        // Cosmos requires tokens in integer format of smallest denomination
        // todo: add slippage tolerance setting into API request
        swapRequest({
          amountIn: result.amountIn.toFixed(denomExponent),
          tokenIn: result.tokenIn,
          tokenOut: result.tokenOut,
          // TODO: add tolerance factor
          minOut: result.amountOut.toFixed(denomExponent),
          creator: address,
        });
      }
    },
    [address, routerResult, swapRequest]
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
        <div className="card-row order-type mb-5">
          <RadioButtonGroupInput<OrderType>
            className="order-type-input"
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
                      {formatPrice(
                        routerResult.tokenIn === rateTokenOrder[1].address
                          ? routerResult.amountOut.dividedBy(
                              routerResult.amountIn
                            )
                          : routerResult.amountIn.dividedBy(
                              routerResult.amountOut
                            ),
                        5
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
                <span className="text-value">0.00%</span>
              </div>
            )}
        </div>
        <div className="my-4">
          {address ? (
            hasFormData &&
            hasSufficientFunds &&
            !error?.insufficientLiquidityIn &&
            !error?.insufficientLiquidityOut ? (
              <button
                className="submit-button button-primary"
                type="submit"
                disabled={!new BigNumber(valueBConverted || 0).isGreaterThan(0)}
              >
                {orderType === 'limit' ? 'Place Limit Order' : 'Swap'}
              </button>
            ) : error?.insufficientLiquidityIn ||
              error?.insufficientLiquidityOut ? (
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
          <input
            type="text"
            className="font-console ml-auto"
            value={slippage}
            onInput={(e) => cleanInput(e.currentTarget, '%')}
            onChange={(e) => setSlippage(e.target.value)}
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
