import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import BigNumber from 'bignumber.js';
import Long from 'long';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBolt,
  faFlag,
  faArrowRightArrowLeft,
  faSliders,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';

import TokenInputGroup from '../../components/TokenInputGroup';
import {
  useDenomFromPathParam,
  useGetTokenPathPart,
} from '../../lib/web3/hooks/useTokens';
import RadioButtonGroupInput from '../../components/RadioButtonGroupInput/RadioButtonGroupInput';
import NumberInput, {
  useNumericInputState,
} from '../../components/inputs/NumberInput';
import PriceDataDisclaimer from '../../components/PriceDataDisclaimer';

import { useWeb3 } from '../../lib/web3/useWeb3';
import { useBankBalanceDisplayAmount } from '../../lib/web3/hooks/useUserBankBalances';
import { useToken } from '../../lib/web3/hooks/useDenomClients';

import { useSimulatedLimitOrderResult } from './hooks/useRouter';
import { useSwap } from './hooks/useSwap';

import { formatPercentage } from '../../lib/utils/number';
import {
  Token,
  getBaseDenomAmount,
  getDisplayDenomAmount,
  getTokenId,
} from '../../lib/web3/utils/tokens';
import { formatLongPrice } from '../../lib/utils/number';
import { orderTypeEnum } from '../../lib/web3/utils/limitOrders';
import {
  DexTickUpdateEvent,
  mapEventAttributes,
} from '../../lib/web3/utils/events';
import { tickIndexToPrice } from '../../lib/web3/utils/ticks';

import './Swap.scss';

const { REACT_APP__MAX_TICK_INDEXES = '' } = import.meta.env;
const [, priceMaxIndex = Number.MAX_SAFE_INTEGER] =
  `${REACT_APP__MAX_TICK_INDEXES}`.split(',').map(Number).filter(Boolean);

type CardType = 'trade' | 'settings';
type OrderType = 'market' | 'limit';

const defaultSlippage = '0.5';

export default function SwapPage() {
  return (
    <div className="container row">
      <div className="page col m-auto">
        <Swap />
      </div>
    </div>
  );
}

function Swap() {
  const { address, connectWallet } = useWeb3();

  const navigate = useNavigate();

  // change tokens to match pathname
  const match = useMatch('/swap/:tokenA/:tokenB');

  // get tokenA and tokenB from symbols of known token pair denoms
  const { data: denomA } = useDenomFromPathParam(match?.params['tokenA']);
  const { data: denomB } = useDenomFromPathParam(match?.params['tokenB']);
  const { data: tokenA } = useToken(denomA);
  const { data: tokenB } = useToken(denomB);
  const getTokenPathPart = useGetTokenPathPart();

  // don't change tokens directly:
  // change the path name which will in turn update the tokens selected
  const setTokensPath = useCallback(
    ([tokenA, tokenB]: [Token?, Token?]) => {
      if (tokenA || tokenB) {
        navigate(
          `/swap/${getTokenPathPart(tokenA)}/${getTokenPathPart(tokenB)}`
        );
      } else {
        navigate('/swap');
      }
    },
    [navigate, getTokenPathPart]
  );
  const setTokenA = useCallback(
    (tokenA: Token | undefined) => {
      setTokensPath([tokenA, tokenB]);
    },
    [setTokensPath, tokenB]
  );
  const setTokenB = useCallback(
    (tokenB: Token | undefined) => {
      setTokensPath([tokenA, tokenB]);
    },
    [setTokensPath, tokenA]
  );

  // use input number values (as native HTML string values)
  const [inputValueA, setInputValueA, valueA = '0'] = useNumericInputState();
  const [inputValueB, setInputValueB, valueB = '0'] = useNumericInputState();
  const [lastUpdatedA, setLastUpdatedA] = useState(true);

  const denoms = [denomA, denomB].filter((denom): denom is string => !!denom);
  const [{ isValidating: isValidatingSwap }, swapRequest] = useSwap(denoms);

  const { data: balanceTokenA } = useBankBalanceDisplayAmount(denomA);

  // create reusable swap msg
  const swapMsg = useMemo(() => {
    const amountIn = tokenA && Number(getBaseDenomAmount(tokenA, valueA));
    if (address && denomA && denomB) {
      return {
        amount_in: (amountIn || 0).toFixed(0),
        token_in: denomA,
        token_out: denomB,
        creator: address,
        receiver: address,
        // using type FILL_OR_KILL so that partially filled requests fail
        order_type: orderTypeEnum.FILL_OR_KILL,
        // trade as far as we can go
        tick_index_in_to_out: Long.fromNumber(priceMaxIndex),
      };
    }
  }, [address, denomA, denomB, tokenA, valueA]);

  // simulate trade with swap msg
  const {
    data: simulationResult,
    isValidating: isValidatingRate,
    error: simulationError = simulationResult?.error,
  } = useSimulatedLimitOrderResult(swapMsg);

  const rate =
    simulationResult?.response &&
    new BigNumber(simulationResult.response.taker_coin_out.amount).dividedBy(
      simulationResult.response.coin_in.amount
    );
  const valueAConverted = lastUpdatedA
    ? valueA
    : tokenA &&
      tokenB &&
      getDisplayDenomAmount(
        tokenA,
        getBaseDenomAmount(tokenB, rate?.multipliedBy(valueB) || 0) || 0
      );
  const valueBConverted = lastUpdatedA
    ? tokenA &&
      tokenB &&
      getDisplayDenomAmount(
        tokenB,
        getBaseDenomAmount(tokenA, rate?.multipliedBy(valueA) || 0) || 0
      )
    : valueB;

  const swapTokens = useCallback(
    function () {
      setTokensPath([tokenB, tokenA]);
      setInputValueA(valueBConverted || '');
      setInputValueB(valueAConverted || '');
      setLastUpdatedA((flag) => !flag);
    },
    [
      tokenA,
      tokenB,
      setTokensPath,
      valueAConverted,
      valueBConverted,
      setInputValueA,
      setInputValueB,
    ]
  );

  const valueAConvertedNumber = new BigNumber(valueAConverted || 0);
  const hasFormData =
    address && tokenA && tokenB && valueAConvertedNumber.isGreaterThan(0);
  const hasSufficientFunds =
    valueAConvertedNumber.isLessThanOrEqualTo(balanceTokenA || 0) || false;

  const [inputSlippage, setInputSlippage, slippage = '0'] =
    useNumericInputState(defaultSlippage);

  const gasEstimate = simulationResult?.gasInfo?.gasUsed.toNumber();

  const tickUpdateEvents = useMemo(() => {
    // calculate ordered tick updates from result events
    return simulationResult?.result?.events
      .filter((event) => event.type === 'TickUpdate')
      .map(mapEventAttributes)
      .filter(
        (event): event is DexTickUpdateEvent =>
          event.type === 'TickUpdate' && event.attributes.TokenIn === denomA
      )
      .sort(
        (a, b) =>
          Number(a.attributes.TickIndex) - Number(b.attributes.TickIndex)
      );
  }, [denomA, simulationResult?.result?.events]);

  const tickIndexLimitInToOut = useMemo(() => {
    // calculate last price out from result
    const lastPrice = tickUpdateEvents?.at(-1)?.attributes;
    if (lastPrice) {
      const direction =
        lastPrice.TokenIn === denomA
          ? lastPrice.TokenIn === lastPrice.TokenZero
          : lastPrice.TokenIn === lastPrice.TokenOne;

      const tolerance = Math.max(1e-12, parseFloat(slippage) / 100);
      const toleranceFactor = 1 + tolerance;
      return direction
        ? Math.floor(Number(lastPrice.TickIndex) / toleranceFactor)
        : Math.floor(Number(lastPrice.TickIndex) * toleranceFactor);
    }
  }, [denomA, slippage, tickUpdateEvents]);

  const onFormSubmit = useCallback(
    function (event?: React.FormEvent<HTMLFormElement>) {
      if (event) event.preventDefault();
      // calculate tolerance from user slippage settings
      // set tiny minimum of tolerance as the frontend calculations
      // don't always exactly align with the backend calculations
      const tolerance = Math.max(1e-12, parseFloat(slippage) / 100);
      const toleranceFactor = 1 + tolerance;
      const amountIn = tokenA && Number(getBaseDenomAmount(tokenA, valueA));
      if (
        swapMsg &&
        amountIn &&
        simulationResult?.response?.taker_coin_out.amount &&
        Number(simulationResult.response.taker_coin_out.amount) > 0 &&
        tickIndexLimitInToOut &&
        gasEstimate
      ) {
        const amountOut = new BigNumber(
          simulationResult.response.taker_coin_out.amount
        ).multipliedBy(toleranceFactor);
        // convert to swap request format
        swapRequest(
          {
            ...swapMsg,
            // using type FILL_OR_KILL so that partially filled requests fail
            order_type: orderTypeEnum.FILL_OR_KILL,
            tick_index_in_to_out: Long.fromNumber(tickIndexLimitInToOut),
            max_amount_out: amountOut.toFixed(0),
          },
          gasEstimate
        );
      }
    },
    [
      slippage,
      tokenA,
      valueA,
      swapMsg,
      simulationResult,
      tickIndexLimitInToOut,
      gasEstimate,
      swapRequest,
    ]
  );

  const onValueAChanged = useCallback(
    (newInputValue = '') => {
      setInputValueA(newInputValue);
      setLastUpdatedA(true);
    },
    [setInputValueA]
  );
  const onValueBChanged = useCallback(
    (newInputValue = '') => {
      setInputValueB(newInputValue);
      setLastUpdatedA(false);
    },
    [setInputValueB]
  );

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

  const priceImpact = useMemo(() => {
    // calculate first and last prices out from sorted result events
    const firstPriceEvent = tickUpdateEvents?.at(0);
    const lastPriceEvent = tickUpdateEvents?.at(-1);
    if (firstPriceEvent && lastPriceEvent) {
      const firstPrice = tickIndexToPrice(
        new BigNumber(firstPriceEvent.attributes.TickIndex)
      );
      const lastPrice = tickIndexToPrice(
        new BigNumber(lastPriceEvent.attributes.TickIndex)
      );
      return firstPrice.dividedBy(lastPrice).minus(1);
    }
  }, [tickUpdateEvents]);

  const tradeCard = (
    <div className="trade-card">
      <div className="page-card">
        <div className="row mb-3">
          <h3 className="h3 card-title">Swap</h3>
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
            defaultAssetMode="User"
            variant={!hasSufficientFunds && 'error'}
            onValueChanged={onValueAChanged}
            onTokenChanged={setTokenA}
            token={tokenA}
            value={lastUpdatedA ? inputValueA : valueAConverted}
            className={!tokenA ? 'loading-token' : ''}
            exclusion={tokenB}
          ></TokenInputGroup>
        </div>
        <div className="card-row my-3">
          <button
            type="button"
            disabled={isValidatingRate || isValidatingSwap}
            onClick={swapTokens}
            className="icon-button swap-button"
          >
            <FontAwesomeIcon
              icon={faArrowRightArrowLeft}
              rotation={90}
            ></FontAwesomeIcon>
          </button>
        </div>
        <div className="card-row">
          <TokenInputGroup
            defaultAssetMode="Dex"
            variant={simulationError?.insufficientLiquidity && 'error'}
            onValueChanged={onValueBChanged}
            onTokenChanged={setTokenB}
            token={tokenB}
            // if result is zero, don't show calculated fractional decimals
            value={
              lastUpdatedA
                ? Number(valueBConverted) > 0
                  ? valueBConverted
                  : '0'
                : inputValueB
            }
            className={!tokenB ? 'loading-token' : ''}
            disabled={isValidatingRate || isValidatingSwap}
            exclusion={tokenA}
            disabledInput={true}
          ></TokenInputGroup>
        </div>
        <div className="card-row text-detail">
          {tokenA && tokenB && Number(inputValueA) > 0 && (
            <div className="text-grid my-4">
              <span className="text-header">Exchange Rate</span>
              <span className="text-value">
                {simulationResult?.response && rateTokenOrder ? (
                  <>
                    1 {rateTokenOrder[1].symbol} ={' '}
                    {formatLongPrice(
                      simulationResult.response.coin_in.denom ===
                        getTokenId(rateTokenOrder[1])
                        ? new BigNumber(
                            simulationResult.response.taker_coin_out.amount
                          )
                            .dividedBy(simulationResult.response.coin_in.amount)
                            .toFixed()
                        : new BigNumber(
                            simulationResult.response.coin_in.amount
                          )
                            .dividedBy(
                              simulationResult.response.taker_coin_out.amount
                            )
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
                        case priceImpact.isGreaterThan(-0.01):
                          return 'text-value';
                        case priceImpact.isGreaterThan(-0.05):
                          return 'text';
                        default:
                          return 'text-error';
                      }
                    })(),
                  ].join(' ')}
                >
                  {formatPercentage(priceImpact.toFixed(), {
                    maximumSignificantDigits: 4,
                    minimumSignificantDigits: 4,
                  })}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="mt-4">
          {address ? (
            hasFormData &&
            hasSufficientFunds &&
            !simulationError?.insufficientLiquidity ? (
              <button
                className="submit-button button-primary"
                type="submit"
                disabled={!new BigNumber(valueBConverted || 0).isGreaterThan(0)}
              >
                {orderType === 'limit' ? 'Place Limit Order' : 'Swap'}
              </button>
            ) : simulationError?.insufficientLiquidity ? (
              <button className="submit-button button-error" type="button">
                Insufficient liquidity
              </button>
            ) : hasFormData ? (
              <button className="submit-button button-error" type="button">
                Insufficient funds
              </button>
            ) : (
              <button
                className="submit-button button-ghost"
                type="button"
                disabled
              >
                Enter Asset Amount
              </button>
            )
          ) : (
            <button
              className="submit-button button-dark"
              type="button"
              onClick={connectWallet}
            >
              Connect Wallet
            </button>
          )}
        </div>
        <PriceDataDisclaimer tokenA={tokenA} tokenB={tokenB} />
      </div>
      <SettingsCard
        cardType={cardType}
        setCardType={setCardType}
        inputSlippage={inputSlippage}
        setInputSlippage={setInputSlippage}
      />
    </div>
  );
  return (
    <form
      onSubmit={onFormSubmit}
      className={['swap-page page-card p-0 row', isValidatingSwap && 'disabled']
        .filter(Boolean)
        .join(' ')}
    >
      {tradeCard}
    </form>
  );
}

function SettingsCard({
  cardType,
  setCardType,
  inputSlippage,
  setInputSlippage,
}: {
  cardType: CardType;
  setCardType: React.Dispatch<React.SetStateAction<CardType>>;
  inputSlippage: string;
  setInputSlippage: React.Dispatch<React.SetStateAction<string>>;
}) {
  return (
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
            value={inputSlippage}
            appendString="%"
            onChange={setInputSlippage}
          />
          <button
            type="button"
            className="badge badge-lg badge-info ml-2"
            onClick={() => setInputSlippage(defaultSlippage)}
          >
            Auto
          </button>
        </div>
      </div>
    </div>
  );
}
