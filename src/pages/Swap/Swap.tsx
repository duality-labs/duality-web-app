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
import { LimitOrderType } from '@duality-labs/dualityjs/types/codegen/neutron/dex/tx';

import TokenInputGroup from '../../components/TokenInputGroup';
import {
  getTokenPathPart,
  useTokenAndDenomFromPath,
} from '../../lib/web3/hooks/useTokens';
import RadioButtonGroupInput from '../../components/RadioButtonGroupInput/RadioButtonGroupInput';
import NumberInput, {
  useNumericInputState,
} from '../../components/inputs/NumberInput';
import PriceDataDisclaimer from '../../components/PriceDataDisclaimer';

import { useWeb3 } from '../../lib/web3/useWeb3';
import { useBankBalanceDisplayAmount } from '../../lib/web3/hooks/useUserBankBalances';
import { useOrderedTokenPair } from '../../lib/web3/hooks/useTokenPairs';
import { useTokenPairTickLiquidity } from '../../lib/web3/hooks/useTickLiquidity';

import { getRouterEstimates, useRouterResult } from './hooks/useRouter';
import { useSwap } from './hooks/useSwap';

import { formatPercentage } from '../../lib/utils/number';
import {
  Token,
  getBaseDenomAmount,
  getTokenId,
} from '../../lib/web3/utils/tokens';
import { formatLongPrice } from '../../lib/utils/number';
import {
  useChainUtil,
  useChainAssetLists,
} from '../../lib/web3/hooks/useDenomsFromRegistry';

import './Swap.scss';
import { AssetList } from '@chain-registry/types';
import { sha256 } from '@cosmjs/crypto';

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
  const [tokenA, denomA] = useTokenAndDenomFromPath(match?.params['tokenA']);
  const [tokenB, denomB] = useTokenAndDenomFromPath(match?.params['tokenB']);

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
    [navigate]
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
  const pairRequest = {
    tokenA: getTokenId(tokenA),
    tokenB: getTokenId(tokenB),
    valueA: lastUpdatedA ? valueA : undefined,
    valueB: lastUpdatedA ? undefined : valueB,
  };
  const {
    data: routerResult,
    isValidating: isValidatingRate,
    error,
  } = useRouterResult({
    tokenA: getTokenId(tokenA),
    tokenB: getTokenId(tokenB),
    valueA: lastUpdatedA ? valueA : undefined,
    valueB: lastUpdatedA ? undefined : valueB,
  });

  const rateData = getRouterEstimates(pairRequest, routerResult);
  const [{ isValidating: isValidatingSwap }, swapRequest] = useSwap();

  const valueAConverted = lastUpdatedA ? valueA : rateData?.valueA;
  const valueBConverted = lastUpdatedA ? rateData?.valueB : valueB;

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

  const { data: balanceTokenA } = useBankBalanceDisplayAmount(denomA);
  const valueAConvertedNumber = new BigNumber(valueAConverted || 0);
  const hasFormData =
    address && tokenA && tokenB && valueAConvertedNumber.isGreaterThan(0);
  const hasSufficientFunds =
    valueAConvertedNumber.isLessThanOrEqualTo(balanceTokenA || 0) || false;

  const [inputSlippage, setInputSlippage, slippage = '0'] =
    useNumericInputState(defaultSlippage);

  const [token0, token1] =
    useOrderedTokenPair([getTokenId(tokenA), getTokenId(tokenB)]) || [];
  const {
    data: [token0Ticks, token1Ticks],
  } = useTokenPairTickLiquidity([token0, token1]);

  const onFormSubmit = useCallback(
    function (event?: React.FormEvent<HTMLFormElement>) {
      if (event) event.preventDefault();
      // calculate tolerance from user slippage settings
      // set tiny minimum of tolerance as the frontend calculations
      // don't always exactly align with the backend calculations
      const tolerance = Math.max(1e-12, parseFloat(slippage) / 100);
      const tickIndexLimit = routerResult?.tickIndexOut?.toNumber();
      if (
        address &&
        routerResult &&
        tokenA &&
        tokenB &&
        !isNaN(tolerance) &&
        tickIndexLimit !== undefined &&
        !isNaN(tickIndexLimit)
      ) {
        // convert to swap request format
        const result = routerResult;
        // Cosmos requires tokens in integer format of smallest denomination
        // calculate gas estimate
        const tickMin =
          routerResult.tickIndexIn &&
          routerResult.tickIndexOut &&
          Math.min(
            routerResult.tickIndexIn.toNumber(),
            routerResult.tickIndexOut.toNumber()
          );
        const tickMax =
          routerResult.tickIndexIn &&
          routerResult.tickIndexOut &&
          Math.max(
            routerResult.tickIndexIn.toNumber(),
            routerResult.tickIndexOut.toNumber()
          );
        const forward = result.tokenIn === token0;
        const ticks = forward ? token1Ticks : token0Ticks;
        const ticksPassed =
          (tickMin !== undefined &&
            tickMax !== undefined &&
            ticks?.filter((tick) => {
              return (
                tick.tickIndex1To0.isGreaterThanOrEqualTo(tickMin) &&
                tick.tickIndex1To0.isLessThanOrEqualTo(tickMax)
              );
            })) ||
          [];
        const ticksUsed =
          ticksPassed?.filter(
            forward
              ? (tick) => !tick.reserve1.isZero()
              : (tick) => !tick.reserve0.isZero()
          ).length || 0;
        const ticksUnused =
          new Set<number>([
            ...(ticksPassed?.map((tick) => tick.tickIndex1To0.toNumber()) ||
              []),
          ]).size - ticksUsed;
        const gasEstimate = ticksUsed
          ? // 120000 base
            120000 +
            // add 80000 if multiple ticks need to be traversed
            (ticksUsed > 1 ? 80000 : 0) +
            // add 1000000 for each tick that we need to remove liquidity from
            1000000 * (ticksUsed - 1) +
            // add 500000 for each tick we pass without drawing liquidity from
            500000 * ticksUnused +
            // add another 500000 for each reverse tick we pass without drawing liquidity from
            (forward ? 0 : 500000 * ticksUnused)
          : 0;

        swapRequest(
          {
            amount_in: getBaseDenomAmount(tokenA, result.amountIn) || '0',
            token_in: result.tokenIn,
            token_out: result.tokenOut,
            creator: address,
            receiver: address,
            // see LimitOrderType in types repo (cannot import at runtime)
            // using type FILL_OR_KILL so that partially filled requests fail
            order_type: 1 as LimitOrderType.FILL_OR_KILL,
            // todo: set tickIndex to allow for a tolerance:
            //   the below function is a tolerance of 0
            tick_index_in_to_out: Long.fromNumber(
              tickIndexLimit * (forward ? 1 : -1)
            ),
            max_amount_out: getBaseDenomAmount(tokenB, result.amountOut) || '0',
          },
          gasEstimate
        );
      }
    },
    [
      address,
      routerResult,
      tokenA,
      tokenB,
      token0,
      token0Ticks,
      token1Ticks,
      slippage,
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

  const chainUtil = useChainUtil();
  useEffect(() => {
    function getTrace({
      base_denom,
      path,
    }: {
      path: string;
      base_denom: string;
    }) {
      const denom = `${path}/${base_denom}`;
      return (
        'ibc/' +
        Buffer.from(sha256(Buffer.from(denom)))
          .toString('hex')
          .toUpperCase()
      );
    }
    if (chainUtil) {
      const denomTraceIBCs = denomTraces.map(({ base_denom, path }) => {
        const denom = `${path}/${base_denom}`;
        return (
          'ibc/' +
          Buffer.from(sha256(Buffer.from(denom)))
            .toString('hex')
            .toUpperCase()
        );
      });
      console.log('denomTraceIBCs', denomTraceIBCs.length);

      const allBaseDenoms = (chainUtil?.chainInfo.assetLists as AssetList[])
        ?.at(0)
        ?.assets.map((a) => a.base);
      console.log('allBaseDenoms', allBaseDenoms);

      // console.log('matched denoms', denomTraceIBCs.filter(denom => allBaseDenoms?.includes(denom)))
      // console.log('unmatched denoms', denomTraceIBCs.filter(denom => !allBaseDenoms?.includes(denom)))

      console.log(
        'matched denomTraces',
        denomTraces
          .filter((denom) => allBaseDenoms?.includes(getTrace(denom)))
          .sort((a, b) => a.path.localeCompare(b.path))
      );
      console.log(
        'unmatched denomTraces',
        denomTraces
          .filter((denom) => !allBaseDenoms?.includes(getTrace(denom)))
          .sort((a, b) => a.path.localeCompare(b.path))
      );

      // console.log(
      //   'chainUtil getAssetByDenom',
      //   chainUtil?.chainInfo.assetLists
      //   // chainUtil?.getAssetByDenom(
      //   //   'ibc/26139E488F510BDA8DDE5614D358A38502BDA061954B8D10ADEFC4EAA58552FF'
      //   // )
      // );
    }
  }, [chainUtil]);

  const chainAssetLists = useChainAssetLists();
  useEffect(() => {
    console.log('chainAssetLists', chainAssetLists);
  }, [chainAssetLists]);

  // set the token order for the rate
  useEffect(() => {
    if (tokenA && tokenB) {
      // console.log('tokenA', tokenA);
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

  const priceImpact =
    routerResult &&
    routerResult.priceBToAIn?.isGreaterThan(0) &&
    routerResult.priceBToAOut?.isGreaterThan(0)
      ? new BigNumber(
          new BigNumber(routerResult.priceBToAIn).dividedBy(
            new BigNumber(routerResult.priceBToAOut)
          )
        ).minus(1)
      : undefined;

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
            variant={
              (!hasSufficientFunds || error?.insufficientLiquidityIn) && 'error'
            }
            onValueChanged={onValueAChanged}
            onTokenChanged={setTokenA}
            token={tokenA}
            denom={denomA}
            value={lastUpdatedA ? inputValueA : valueAConverted}
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
        <div className="card-row my-3">
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
        <div className="card-row">
          <TokenInputGroup
            variant={error?.insufficientLiquidityOut && 'error'}
            onValueChanged={onValueBChanged}
            onTokenChanged={setTokenB}
            token={tokenB}
            denom={denomB}
            value={lastUpdatedA ? valueBConverted : inputValueB}
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
              <div className="text-grid my-4">
                <span className="text-header">Exchange Rate</span>
                <span className="text-value">
                  {routerResult && rateTokenOrder ? (
                    <>
                      1 {rateTokenOrder[1].symbol} ={' '}
                      {formatLongPrice(
                        routerResult.tokenIn === getTokenId(rateTokenOrder[1])
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
  const [denomtrace, stepDenomTrace] = useDenomTraceIteration();
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
        <div>
          <div className="row gap-2">
            <button
              type="button"
              className="button button-warning"
              onClick={() => stepDenomTrace(-1)}
            >
              prev
            </button>
            <button
              type="button"
              className="button button-warning"
              onClick={() => stepDenomTrace(1)}
            >
              next
            </button>
            <button
              type="button"
              className="button button-warning"
              onClick={() => stepDenomTrace(10)}
            >
              jump 10
            </button>
          </div>
          <div>
            denom {denomTraces.indexOf(denomtrace)}/{denomTraces.length}
          </div>
          <div>{JSON.stringify(denomtrace)}</div>
        </div>
      </div>
    </div>
  );
}

function useDenomTraceIteration(): [
  {
    path: string;
    base_denom: string;
  },
  (step: number) => void
] {
  const [traceIndex, setTraceIndex] = useState(0);

  const selectedTrace = denomTraces[traceIndex];
  const stepIndex = useCallback(
    (step: number) =>
      setTraceIndex((index) => {
        return (index + step) % denomTraces.length;
      }),
    []
  );

  return [selectedTrace, stepIndex];
}

const denomTraces = [
  {
    path: 'transfer/channel-1/transfer/channel-141/transfer/channel-208',
    base_denom: 'uusdc',
  },
  {
    path: 'transfer/channel-1/transfer/channel-141/transfer/channel-259/transfer/channel-0/transfer/channel-141/transfer/channel-297/transfer/channel-1',
    base_denom: 'uatom',
  },
  {
    path: 'transfer/channel-1/transfer/channel-141/transfer/channel-326',
    base_denom: 'stuatom',
  },
  {
    path: 'transfer/channel-1/transfer/channel-141/transfer/channel-782/transfer/channel-1',
    base_denom: 'uatom',
  },
  {
    path: 'transfer/channel-1/transfer/channel-141/transfer/channel-874/transfer/channel-1',
    base_denom: 'uatom',
  },
  {
    path: 'transfer/channel-1/transfer/channel-141/transfer/channel-874/transfer/channel-2',
    base_denom: 'uusdc',
  },
  {
    path: 'transfer/channel-1/transfer/channel-141/transfer/channel-874',
    base_denom: 'untrn',
  },
  {
    path: 'transfer/channel-1/transfer/channel-184/transfer/channel-9/transfer/channel-0',
    base_denom: 'uatom',
  },
  {
    path: 'transfer/channel-1/transfer/channel-207/transfer/channel-0/transfer/channel-208',
    base_denom: 'uusdc',
  },
  {
    path: 'transfer/channel-1/transfer/channel-207/transfer/channel-71',
    base_denom: 'uusdc',
  },
  {
    path: 'transfer/channel-1/transfer/channel-207',
    base_denom: 'ujuno',
  },
  {
    path: 'transfer/channel-1/transfer/channel-217',
    base_denom: 'nanolike',
  },
  {
    path: 'transfer/channel-1/transfer/channel-229',
    base_denom: 'ubtsg',
  },
  {
    path: 'transfer/channel-1/transfer/channel-281/transfer/channel-10/transfer/channel-0/transfer/channel-623/transfer/channel-1/transfer/channel-0',
    base_denom: 'uatom',
  },
  {
    path: 'transfer/channel-1/transfer/channel-281/transfer/channel-10/transfer/channel-0',
    base_denom: 'uatom',
  },
  {
    path: 'transfer/channel-1/transfer/channel-281/transfer/channel-10/transfer/channel-184/transfer/channel-33/transfer/channel-3/transfer/channel-144',
    base_denom: 'gravity0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  },
  {
    path: 'transfer/channel-1/transfer/channel-290/transfer/channel-12',
    base_denom: 'uatom',
  },
  {
    path: 'transfer/channel-1/transfer/channel-293',
    base_denom: 'uusdc',
  },
  {
    path: 'transfer/channel-1/transfer/channel-343/transfer/channel-3/transfer/channel-0',
    base_denom: 'uatom',
  },
  {
    path: 'transfer/channel-1/transfer/channel-391',
    base_denom: 'stuatom',
  },
  {
    path: 'transfer/channel-1/transfer/channel-391',
    base_denom: 'ustrd',
  },
  {
    path: 'transfer/channel-1/transfer/channel-536',
    base_denom: 'uusdc',
  },
  {
    path: 'transfer/channel-1',
    base_denom: 'uatom',
  },
  {
    path: 'transfer/channel-10/transfer/channel-0/transfer/channel-277/transfer/channel-1/transfer/channel-208',
    base_denom: 'uusdc',
  },
  {
    path: 'transfer/channel-10/transfer/channel-0/transfer/channel-293',
    base_denom: 'uusdc',
  },
  {
    path: 'transfer/channel-10/transfer/channel-0/transfer/channel-343/transfer/channel-3/transfer/channel-0/transfer/channel-391/transfer/channel-5/transfer/channel-0/transfer/channel-391/transfer/channel-5/transfer/channel-0',
    base_denom: 'uatom',
  },
  {
    path: 'transfer/channel-10/transfer/channel-0/transfer/channel-343/transfer/channel-3/transfer/channel-122/transfer/channel-1/transfer/channel-569/transfer/channel-35',
    base_denom: 'utia',
  },
  {
    path: 'transfer/channel-10/transfer/channel-0/transfer/channel-569/transfer/channel-10/transfer/channel-0',
    base_denom: 'uatom',
  },
  {
    path: 'transfer/channel-10/transfer/channel-0/transfer/channel-569/transfer/channel-2',
    base_denom: 'uusdc',
  },
  {
    path: 'transfer/channel-10/transfer/channel-0/transfer/channel-569/transfer/channel-42',
    base_denom: 'usat',
  },
  {
    path: 'transfer/channel-10/transfer/channel-0/transfer/channel-569',
    base_denom: 'untrn',
  },
  {
    path: 'transfer/channel-10/transfer/channel-0',
    base_denom: 'uatom',
  },
  {
    path: 'transfer/channel-10/transfer/channel-113',
    base_denom: 'uhuahua',
  },
  {
    path: 'transfer/channel-10/transfer/channel-122',
    base_denom: 'factory/inj14lf8xm6fcvlggpa7guxzjqwjmtr24gnvf56hvz/autism',
  },
  {
    path: 'transfer/channel-10/transfer/channel-122',
    base_denom: 'peggy0xdAC17F958D2ee523a2206206994597C13D831ec7',
  },
  {
    path: 'transfer/channel-10/transfer/channel-122/transfer/channel-1/transfer/channel-141/transfer/channel-122/transfer/channel-152',
    base_denom: 'utia',
  },
  {
    path: 'transfer/channel-10/transfer/channel-122/transfer/channel-1/transfer/channel-326/transfer/channel-9/transfer/channel-0/transfer/channel-569/transfer/channel-2',
    base_denom: 'uusdc',
  },
  {
    path: 'transfer/channel-10/transfer/channel-1279/transfer/channel-2/transfer/channel-15',
    base_denom: '79228162514264337593543950342',
  },
  {
    path: 'transfer/channel-10/transfer/channel-144',
    base_denom: 'gravity0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  },
  {
    path: 'transfer/channel-10/transfer/channel-146',
    base_denom: 'uctk',
  },
  {
    path: 'transfer/channel-10/transfer/channel-181',
    base_denom: 'udec',
  },
  {
    path: 'transfer/channel-10/transfer/channel-204/transfer/channel-8/transfer/channel-10/transfer/channel-874/transfer/channel-1/transfer/channel-141/transfer/channel-874/transfer/channel-2',
    base_denom: 'uusdc',
  },
  {
    path: 'transfer/channel-10/transfer/channel-208/transfer/channel-14/transfer/channel-75/transfer/channel-2',
    base_denom: 'uusdc',
  },
  {
    path: 'transfer/channel-10/transfer/channel-208',
    base_denom: 'uaxl',
  },
  {
    path: 'transfer/channel-10/transfer/channel-208',
    base_denom: 'uusdc',
  },
  {
    path: 'transfer/channel-10/transfer/channel-208',
    base_denom: 'uusdt',
  },
  {
    path: 'transfer/channel-10/transfer/channel-208',
    base_denom: 'weth-wei',
  },
  {
    path: 'transfer/channel-10/transfer/channel-212',
    base_denom: 'ucrbrus',
  },
  {
    path: 'transfer/channel-10/transfer/channel-297/transfer/channel-7/transfer/channel-10/transfer/channel-8/transfer/channel-642/transfer/channel-3/transfer/channel-1/transfer/channel-141/transfer/channel-122/transfer/channel-152',
    base_denom: 'utia',
  },
  {
    path: 'transfer/channel-10/transfer/channel-326',
    base_denom: 'stuatom',
  },
  {
    path: 'transfer/channel-10/transfer/channel-326/transfer/channel-0/transfer/channel-569',
    base_denom: 'untrn',
  },
  {
    path: 'transfer/channel-10/transfer/channel-557/transfer/channel-37/transfer/channel-8/transfer/channel-5/transfer/channel-874/transfer/channel-8',
    base_denom: 'stuatom',
  },
  {
    path: 'transfer/channel-10/transfer/channel-6994',
    base_denom: 'utia',
  },
  {
    path: 'transfer/channel-10/transfer/channel-750',
    base_denom: 'uusdc',
  },
  {
    path: 'transfer/channel-10/transfer/channel-782/transfer/channel-1/transfer/channel-343/transfer/channel-50/transfer/channel-17/transfer/channel-141/transfer/channel-782/transfer/channel-1',
    base_denom: 'uatom',
  },
  {
    path: 'transfer/channel-10/transfer/channel-782/transfer/channel-2',
    base_denom: 'uusdc',
  },
  {
    path: 'transfer/channel-10/transfer/channel-782',
    base_denom: 'usei',
  },
  {
    path: 'transfer/channel-10/transfer/channel-88',
    base_denom: 'uscrt',
  },
  {
    path: 'transfer/channel-10',
    base_denom: 'uosmo',
  },
  {
    path: 'transfer/channel-16',
    base_denom: 'umars',
  },
  {
    path: 'transfer/channel-17',
    base_denom: 'ppica',
  },
  {
    path: 'transfer/channel-17/transfer/channel-2',
    base_denom: '130',
  },
  {
    path: 'transfer/channel-17/transfer/channel-2',
    base_denom: '4',
  },
  {
    path: 'transfer/channel-17/transfer/channel-2/transfer/channel-15',
    base_denom: '79228162514264337593543950342',
  },
  {
    path: 'transfer/channel-17/transfer/channel-2/transfer/channel-15',
    base_denom: '79228162514264337593543950370',
  },
  {
    path: 'transfer/channel-17/transfer/channel-20',
    base_denom: 'uumee',
  },
  {
    path: 'transfer/channel-17/transfer/channel-38',
    base_denom: 'utia',
  },
  {
    path: 'transfer/channel-17/transfer/channel-4',
    base_denom: 'uatom',
  },
  {
    path: 'transfer/channel-18/transfer/channel-204',
    base_denom: 'uusdc',
  },
  {
    path: 'transfer/channel-18',
    base_denom: 'ustars',
  },
  {
    path: 'transfer/channel-2',
    base_denom: 'avalanche-uusdc',
  },
  {
    path: 'transfer/channel-2',
    base_denom: 'dai-wei',
  },
  {
    path: 'transfer/channel-2',
    base_denom: 'dot-planck',
  },
  {
    path: 'transfer/channel-2',
    base_denom: 'frax-wei',
  },
  {
    path: 'transfer/channel-2/transfer/channel-2',
    base_denom: 'uatom',
  },
  {
    path: 'transfer/channel-2/transfer/channel-3/transfer/channel-0/transfer/channel-569/transfer/channel-2',
    base_denom: 'uusdc',
  },
  {
    path: 'transfer/channel-2/transfer/channel-3/transfer/channel-0',
    base_denom: 'uatom',
  },
  {
    path: 'transfer/channel-2/transfer/channel-3/transfer/channel-874/transfer/channel-2',
    base_denom: 'uusdc',
  },
  {
    path: 'transfer/channel-2',
    base_denom: 'uaxl',
  },
  {
    path: 'transfer/channel-2',
    base_denom: 'uusdc',
  },
  {
    path: 'transfer/channel-2',
    base_denom: 'uusdt',
  },
  {
    path: 'transfer/channel-2',
    base_denom: 'wavax-wei',
  },
  {
    path: 'transfer/channel-2',
    base_denom: 'wbnb-wei',
  },
  {
    path: 'transfer/channel-2',
    base_denom: 'weth-wei',
  },
  {
    path: 'transfer/channel-2',
    base_denom: 'wftm-wei',
  },
  {
    path: 'transfer/channel-2',
    base_denom: 'wglmr-wei',
  },
  {
    path: 'transfer/channel-2',
    base_denom: 'wmatic-wei',
  },
  {
    path: 'transfer/channel-2',
    base_denom: 'wsteth-wei',
  },
  {
    path: 'transfer/channel-25/transfer/channel-0',
    base_denom: 'uatom',
  },
  {
    path: 'transfer/channel-25/transfer/channel-1/transfer/channel-208',
    base_denom: 'uusdc',
  },
  {
    path: 'transfer/channel-25/transfer/channel-255/transfer/channel-104',
    base_denom:
      'cw20:terra1nsuqsk6kh58ulczatwev87ttq2z6r3pusulg9r24mfj2fvtzd4uq3exn26',
  },
  {
    path: 'transfer/channel-25/transfer/channel-6',
    base_denom: 'uusdc',
  },
  {
    path: 'transfer/channel-25/transfer/channel-86',
    base_denom: 'uwhale',
  },
  {
    path: 'transfer/channel-25',
    base_denom: 'uluna',
  },
  {
    path: 'transfer/channel-3',
    base_denom: 'factory:kujira13ryry75s34y4sl5st7g5mhk0he8rc2nn7ah6sl:SPERM',
  },
  {
    path: 'transfer/channel-3',
    base_denom: 'factory:kujira1aaudpfr9y23lt9d45hrmskphpdfaq9ajxd3ukh:unstk',
  },
  {
    path: 'transfer/channel-3',
    base_denom:
      'factory:kujira1e224c8ry0nuun5expxm00hmssl8qnsjkd02ft94p3m2a33xked2qypgys3:urcpt',
  },
  {
    path: 'transfer/channel-3',
    base_denom:
      'factory:kujira1jelmu9tdmr6hqg0d6qw4g6c9mwrexrzuryh50fwcavcpthp5m0uq20853h:urcpt',
  },
  {
    path: 'transfer/channel-3',
    base_denom:
      'factory:kujira1q8p9n7cefe8eet4c62l5q7dx2c9y6c6hnlkaghkqhukt2kaf58zs3yrap4:urcpt',
  },
  {
    path: 'transfer/channel-3',
    base_denom:
      'factory:kujira1qk00h5atutpsv900x202pxx42npjr9thg58dnqpa72f2p7m2luase444a7:uusk',
  },
  {
    path: 'transfer/channel-3',
    base_denom: 'factory:kujira1swkuyt08z74n5jl7zr6hx0ru5sa2yev5v896p6:local',
  },
  {
    path: 'transfer/channel-3/transfer/channel-0/transfer/channel-569/transfer/channel-2',
    base_denom: 'uusdc',
  },
  {
    path: 'transfer/channel-3/transfer/channel-0/transfer/channel-569',
    base_denom: 'untrn',
  },
  {
    path: 'transfer/channel-3/transfer/channel-0',
    base_denom: 'uatom',
  },
  {
    path: 'transfer/channel-3/transfer/channel-3/transfer/channel-874',
    base_denom: 'factory/neutron1p8d89wvxyjcnawmgw72klknr3lg9gwwl6ypxda/newt',
  },
  {
    path: 'transfer/channel-3/transfer/channel-62',
    base_denom: 'uusdc',
  },
  {
    path: 'transfer/channel-3/transfer/channel-9/transfer/channel-3/transfer/channel-259/transfer/channel-9',
    base_denom: 'uusdc',
  },
  {
    path: 'transfer/channel-3/transfer/channel-9',
    base_denom: 'uusdc',
  },
  {
    path: 'transfer/channel-3',
    base_denom: 'ukuji',
  },
  {
    path: 'transfer/channel-30/transfer/channel-4/transfer/channel-141/transfer/channel-874/transfer/channel-2/transfer/channel-3/transfer/channel-0/transfer/channel-569/transfer/channel-2',
    base_denom: 'uusdc',
  },
  {
    path: 'transfer/channel-30/transfer/channel-4',
    base_denom: 'uatom',
  },
  {
    path: 'transfer/channel-30',
    base_denom: 'uusdc',
  },
  {
    path: 'transfer/channel-35',
    base_denom: 'utia',
  },
  {
    path: 'transfer/channel-37',
    base_denom: 'aarch',
  },
  {
    path: 'transfer/channel-38',
    base_denom: 'aarch',
  },
  {
    path: 'transfer/channel-4',
    base_denom: 'uwhale',
  },
  {
    path: 'transfer/channel-41',
    base_denom: 'aarch',
  },
  {
    path: 'transfer/channel-42',
    base_denom: 'usat',
  },
  {
    path: 'transfer/channel-44/transfer/channel-0/transfer/channel-88',
    base_denom: 'uscrt',
  },
  {
    path: 'transfer/channel-44',
    base_denom: 'unls',
  },
  {
    path: 'transfer/channel-48',
    base_denom: 'adydx',
  },
  {
    path: 'transfer/channel-49',
    base_denom: 'stk/uatom',
  },
  {
    path: 'transfer/channel-49/transfer/channel-38',
    base_denom: 'gravity0xfB5c6815cA3AC72Ce9F5006869AE67f18bF77006',
  },
  {
    path: 'transfer/channel-49',
    base_denom: 'uxprt',
  },
  {
    path: 'transfer/channel-5',
    base_denom:
      'cw20:terra1nsuqsk6kh58ulczatwev87ttq2z6r3pusulg9r24mfj2fvtzd4uq3exn26',
  },
  {
    path: 'transfer/channel-51/transfer/channel-7',
    base_denom: 'uosmo',
  },
  {
    path: 'transfer/channel-51',
    base_denom: 'uhuahua',
  },
  {
    path: 'transfer/channel-60',
    base_denom: 'factory/inj14lf8xm6fcvlggpa7guxzjqwjmtr24gnvf56hvz/autism',
  },
  {
    path: 'transfer/channel-60',
    base_denom: 'inj',
  },
  {
    path: 'transfer/channel-60/transfer/channel-104',
    base_denom:
      'cw20:terra1nsuqsk6kh58ulczatwev87ttq2z6r3pusulg9r24mfj2fvtzd4uq3exn26',
  },
  {
    path: 'transfer/channel-60/transfer/channel-84',
    base_denom: 'uusdc',
  },
  {
    path: 'transfer/channel-8',
    base_denom: 'stuatom',
  },
  {
    path: 'transfer/channel-8/transfer/channel-47/transfer/channel-12/transfer/channel-46',
    base_denom: 'stuluna',
  },
  {
    path: 'transfer/channel-8/transfer/channel-5/transfer/channel-874/transfer/channel-8',
    base_denom: 'stuatom',
  },
  {
    path: 'transfer/channel-8',
    base_denom: 'ustrd',
  },
].sort((a, b) => getPathLength(a) - getPathLength(b));

function getPathLength({
  path,
  base_denom,
}: {
  path: string;
  base_denom: string;
}) {
  return path.split('/').length / 2;
}
