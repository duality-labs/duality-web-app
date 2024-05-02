import Long from 'long';
import BigNumber from 'bignumber.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  LimitOrderType,
  MsgPlaceLimitOrder,
} from '@duality-labs/neutronjs/types/codegen/neutron/dex/tx';

import TabsCard from './TabsCard';
import Tabs from '../Tabs';

import {
  Token,
  getBaseDenomAmount,
  getDisplayDenomAmount,
  getTokenId,
} from '../../lib/web3/utils/tokens';
import {
  formatAmount,
  formatMaximumSignificantDecimals,
  formatPrice,
} from '../../lib/utils/number';

import './LimitOrderCard.scss';
import Tooltip from '../Tooltip';
import { useSwap } from '../../pages/Swap/hooks/useSwap';
import { useSimulatedLimitOrderResult } from '../../pages/Swap/hooks/useRouter';
import { useWeb3 } from '../../lib/web3/useWeb3';
import {
  useBankBalanceBaseAmount,
  useBankBalanceDisplayAmount,
} from '../../lib/web3/hooks/useUserBankBalances';
import { useChainFeeToken } from '../../lib/web3/hooks/useTokens';
import { useNativeChain } from '../../lib/web3/hooks/useChains';
import { useTokenPairMapLiquidity } from '../../lib/web3/hooks/useTickLiquidity';
import { useRealtimePrice } from '../stats/hooks';

import RangeListSliderInput from '../inputs/RangeInput/RangeListSliderInput';
import {
  LimitOrderContextProvider,
  LimitOrderFormContext,
  LimitOrderFormSetContext,
} from './LimitOrderContext';
import SelectInput from '../inputs/SelectInput';
import { timeUnits } from '../../lib/utils/time';
import {
  orderTypeEnum,
  timePeriods,
  timePeriodLabels,
  TimePeriod,
  AllowedLimitOrderTypeKey,
  inputOrderTypes,
  orderTypeTextMap,
  nonImmediateOrderTypes,
  immediateOrderTypes,
} from '../../lib/web3/utils/limitOrders';
import {
  DexTickUpdateEvent,
  mapEventAttributes,
} from '../../lib/web3/utils/events';
import {
  displayPriceToTickIndex,
  tickIndexToPrice,
} from '../../lib/web3/utils/ticks';
import { guessInvertedOrder } from '../../lib/web3/utils/pairs';

import Drawer from '../Drawer';

const { REACT_APP__MAX_TICK_INDEXES = '' } = import.meta.env;
const [, priceMaxIndex = Number.MAX_SAFE_INTEGER] =
  `${REACT_APP__MAX_TICK_INDEXES}`.split(',').map(Number).filter(Boolean);

const defaultExecutionType: AllowedLimitOrderTypeKey = 'FILL_OR_KILL';

function formatNumericAmount(defaultValue = '') {
  return (amount: number | string) => {
    return amount
      ? formatAmount(
          amount,
          { useGrouping: false },
          { reformatSmallValues: false }
        )
      : defaultValue;
  };
}

const TabContext = createContext<
  [
    tabIndex?: number,
    setTabIndex?: React.Dispatch<React.SetStateAction<number>>
  ]
>([]);

export default function LimitOrderCard({
  tokenA,
  tokenB,
}: {
  tokenA?: Token;
  tokenB?: Token;
}) {
  return (
    <TabContext.Provider value={useState(0)}>
      <TabsCard
        className="flex limitorder-card"
        style={{
          // fix width to a minimum to allow tabs to be of equal size
          minWidth: '20em',
        }}
        tabs={useMemo(() => {
          return [
            {
              nav: 'Buy',
              Tab: () => <LimitOrderNav tokenA={tokenA} tokenB={tokenB} />,
            },
            {
              nav: 'Sell',
              Tab: () => <LimitOrderNav tokenA={tokenA} tokenB={tokenB} sell />,
            },
          ];
        }, [tokenA, tokenB])}
      />
    </TabContext.Provider>
  );
}

function LimitOrderNav({
  tokenA,
  tokenB,
  sell = false,
}: {
  tokenA?: Token;
  tokenB?: Token;
  sell?: boolean;
}) {
  const [tabIndex, setTabIndex] = useContext(TabContext);
  const tabs = useMemo(() => {
    const props = { tokenA, tokenB, sell };
    return [
      {
        nav: 'Limit',
        Tab: () => <LimitOrder {...props} showLimitPrice />,
      },
      {
        nav: 'Market',
        Tab: () => <LimitOrder {...props} />,
      },
    ];
  }, [tokenA, tokenB, sell]);

  return (
    <div className="p-md pt-4">
      <LimitOrderContextProvider defaultExecutionType={defaultExecutionType}>
        <Tabs
          className="limitorder-type"
          tabs={tabs}
          value={tabIndex}
          onChange={setTabIndex}
        />
      </LimitOrderContextProvider>
    </div>
  );
}

const userBankBalanceRangePercentages = [0, 0.1, 0.25, 0.5, 0.75, 1];

function LimitOrder({
  tokenA,
  tokenB,
  sell: sellMode = false,
  showLimitPrice = false,
}: {
  tokenA?: Token;
  tokenB?: Token;
  sell?: boolean;
  showLimitPrice?: boolean;
}) {
  const buyMode = !sellMode;
  const [denomA, denomB] = [getTokenId(tokenA), getTokenId(tokenB)];

  const formState = useContext(LimitOrderFormContext);
  const formSetState = useContext(LimitOrderFormSetContext);

  const tokenIn = !buyMode ? tokenB : tokenA;
  const tokenOut = buyMode ? tokenB : tokenA;
  const [denomIn, denomOut] = [getTokenId(tokenIn), getTokenId(tokenOut)];
  const { data: userBalanceTokenIn, isLoading: isLoadingUserBalanceTokenIn } =
    useBankBalanceBaseAmount(denomIn);
  const { data: userBalanceTokenOut } = useBankBalanceBaseAmount(denomOut);
  const { data: userBalanceTokenInDisplayAmount } =
    useBankBalanceDisplayAmount(denomIn);
  const { meta } = useTokenPairMapLiquidity([denomA, denomB]);

  const [{ isValidating: isValidatingSwap, error }, swapRequest] = useSwap(
    [denomA, denomB].filter((denom): denom is string => !!denom)
  );

  const { address, connectWallet } = useWeb3();

  const [tokenInBalanceFraction, setTokenInBalanceFraction] =
    useState<number>();

  const buyAmountSimulatedMsgPlaceLimitOrder = useMemo<
    MsgPlaceLimitOrder | undefined
  >(() => {
    if (address && userBalanceTokenIn && tokenInBalanceFraction !== undefined) {
      const [denomIn, denomOut] = [getTokenId(tokenIn), getTokenId(tokenOut)];
      if (
        denomIn &&
        denomOut &&
        userBalanceTokenIn &&
        Number(userBalanceTokenIn) > 0 &&
        tokenInBalanceFraction > 0
      ) {
        return {
          amount_in: new BigNumber(userBalanceTokenIn)
            .multipliedBy(tokenInBalanceFraction)
            .toFixed(0),
          token_in: denomIn,
          token_out: denomOut,
          creator: address,
          receiver: address,
          order_type: orderTypeEnum.IMMEDIATE_OR_CANCEL,
          // don't use a limit to find target amount in
          tick_index_in_to_out: Long.fromNumber(priceMaxIndex),
        };
      }
    }
  }, [address, tokenIn, tokenInBalanceFraction, tokenOut, userBalanceTokenIn]);
  const {
    data: buyAmountSimulationResult,
    isValidating: isValidatingBuyAmountSimulationResult,
  } = useSimulatedLimitOrderResult(buyAmountSimulatedMsgPlaceLimitOrder, {
    // invalidate the request cache when the liquidity height changes
    keepPreviousData:
      Number(buyAmountSimulatedMsgPlaceLimitOrder?.amount_in) > 0,
    memo: `height of ${meta?.height}`,
  });

  const {
    amountInDisplayAmount,
    amountInBaseAmount,
    amountOutDisplayAmount,
    amountOutBaseAmount,
  } = useMemo(() => {
    if (tokenIn && tokenOut) {
      // get amount in from input in sell mode or the slider in buy mode
      const amountInBaseAmount = !buyMode
        ? // get amount in from sell mode (in base amount to round input correctly)
          getBaseDenomAmount(tokenIn, formState.amount || 0)
        : // in buy mode get the input slider value only if defined
          (tokenInBalanceFraction !== undefined &&
            new BigNumber(userBalanceTokenIn || 0)
              .multipliedBy(tokenInBalanceFraction || 0)
              .toFixed(0)) ||
          undefined;
      // get amount out from buy mode
      const amountOutBaseAmount =
        (buyMode || undefined) &&
        (buyAmountSimulationResult || isValidatingBuyAmountSimulationResult
          ? // if we have a buy simulation result then show it or loading state
            buyAmountSimulationResult?.response?.taker_coin_out.amount ?? ''
          : // else use value directly (in base amount to round input correctly)
            getBaseDenomAmount(tokenOut, formState.amount || 0));

      // return converted values for convenience
      return {
        amountInBaseAmount,
        amountInDisplayAmount: !buyMode
          ? formState.amount
          : amountInBaseAmount &&
            getDisplayDenomAmount(tokenIn, amountInBaseAmount),
        amountOutBaseAmount,
        amountOutDisplayAmount:
          buyAmountSimulationResult || isValidatingBuyAmountSimulationResult
            ? amountOutBaseAmount &&
              getDisplayDenomAmount(tokenOut, amountOutBaseAmount, {
                // output a little more rounded than usual for form inputs
                fractionalDigits: 3,
                significantDigits: 5,
              })
            : formState.amount,
      };
    }
    return {};
  }, [
    buyAmountSimulationResult,
    buyMode,
    formState.amount,
    isValidatingBuyAmountSimulationResult,
    tokenInBalanceFraction,
    tokenIn,
    tokenOut,
    userBalanceTokenIn,
  ]);

  const [, currentPrice] = useRealtimePrice(tokenIn, tokenOut);

  const simulatedMsgPlaceLimitOrder: MsgPlaceLimitOrder | undefined =
    useMemo(() => {
      const [denomIn, denomOut] = [getTokenId(tokenIn), getTokenId(tokenOut)];

      const execution = formState.execution;
      const timePeriod = formState.timePeriod;
      const timeAmount = Number(formState.timeAmount ?? NaN);
      const limitPrice = Number(formState.limitPrice || NaN); // do not allow 0
      // calculate the expiration time in JS epoch (milliseconds)
      const expirationTimeMs =
        timeAmount && timePeriod
          ? new Date(Date.now() + timeAmount * timeUnits[timePeriod]).getTime()
          : NaN;

      // find amounts in/out for the order
      // in buy mode: buy the amount out with the user's available balance
      const amountIn =
        amountInBaseAmount ||
        // use bank balance in buy mode if amount was not defined by slider
        (buyMode ? userBalanceTokenIn : undefined);
      // use amount out to set the order limit only if the amount in is not set
      const maxAmountOut = amountOutBaseAmount;

      // check format of request
      if (
        execution &&
        (execution === 'GOOD_TIL_TIME' ? !isNaN(expirationTimeMs) : true) &&
        (execution === 'GOOD_TIL_TIME' ? timePeriod !== undefined : true) &&
        address &&
        denomIn &&
        denomOut &&
        amountIn &&
        userBalanceTokenIn &&
        // if limit price is set it should be above 0
        (isNaN(limitPrice) || Number(limitPrice) > 0) &&
        Number(amountIn) > 0 &&
        // either amount in or out should be more than zero
        (Number(amountInBaseAmount) > 0 || Number(amountOutBaseAmount) > 0)
      ) {
        // when buying: select tick index below the limit
        // when selling: select tick index above the limit
        const limitTickIndexInToOut =
          limitPrice > 0
            ? displayPriceToTickIndex(
                new BigNumber(limitPrice),
                tokenOut,
                tokenIn,
                // change limit rounding direction depending on token direction
                guessInvertedOrder([denomIn, denomOut]) ? 'floor' : 'ceil'
              )
                // change limit direction depending on buying direction
                ?.multipliedBy(buyMode ? 1 : -1)
            : undefined;

        const msgPlaceLimitOrder: MsgPlaceLimitOrder = {
          amount_in: BigNumber.min(amountIn, userBalanceTokenIn).toFixed(0),
          token_in: denomIn,
          token_out: denomOut,
          creator: address,
          receiver: address,
          order_type: orderTypeEnum[execution] as LimitOrderType,
          // if no limit assume market value
          tick_index_in_to_out:
            limitTickIndexInToOut !== undefined
              ? Long.fromNumber(limitTickIndexInToOut.toNumber())
              : Long.fromNumber(priceMaxIndex),
        };
        // optional params
        // only add maxOut for buy orders
        if (tokenOut && maxAmountOut && currentPrice) {
          // set max out on taker orders
          if (
            immediateOrderTypes.includes(orderTypeEnum[execution] as number)
          ) {
            // note: if attempting to pass a non-immediate order, fails with error
            //       "MaxAmountOut can only be set for taker only limit orders."
            msgPlaceLimitOrder.max_amount_out = maxAmountOut;
          }
          // set an estimated max in instead for non-immediate orders
          else {
            // note: this is a bit or an awkward estimation that goes from the
            //       user's set limit to the current price
            const estimatedTokenIn =
              Number(maxAmountOut) *
              BigNumber[buyMode ? 'min' : 'max'](
                tickIndexToPrice(
                  limitTickIndexInToOut ?? new BigNumber(priceMaxIndex)
                ),
                currentPrice
              ).toNumber();
            msgPlaceLimitOrder.amount_in = BigNumber.min(
              msgPlaceLimitOrder.amount_in,
              estimatedTokenIn
            ).toFixed(0);
          }
        }
        // only add expiration time to timed limit orders
        if (execution === 'GOOD_TIL_TIME' && !isNaN(expirationTimeMs)) {
          msgPlaceLimitOrder.expiration_time = {
            seconds: Long.fromNumber(Math.round(expirationTimeMs / 1000)),
            nanos: 0,
          };
        }
        return msgPlaceLimitOrder;
      }
    }, [
      address,
      amountInBaseAmount,
      amountOutBaseAmount,
      buyMode,
      currentPrice,
      formState.execution,
      formState.limitPrice,
      formState.timeAmount,
      formState.timePeriod,
      tokenIn,
      tokenOut,
      userBalanceTokenIn,
    ]);

  const lastSimulatedMsgPlaceLimitOrder = useRef<MsgPlaceLimitOrder>();
  const { data: simulationResult, isValidating: isValidatingSimulation } =
    useSimulatedLimitOrderResult(simulatedMsgPlaceLimitOrder, {
      // if the limit order payload hasn't changed then keep the previous data
      keepPreviousData:
        // don't keep when input goes to 0
        (Number(simulatedMsgPlaceLimitOrder?.amount_in) > 0 &&
          // if in buy amount calculation mode let it pass
          buyAmountSimulationResult?.response !== undefined) ||
        // don't change if input exists and hasn't changed
        (simulatedMsgPlaceLimitOrder !== undefined &&
          lastSimulatedMsgPlaceLimitOrder.current ===
            simulatedMsgPlaceLimitOrder),
      // invalidate the request cache when the liquidity height changes
      memo: `height of ${meta?.height}`,
    });
  // update last simulatedMsgPlaceLimitOrder for comparison on the next render
  useEffect(() => {
    lastSimulatedMsgPlaceLimitOrder.current = simulatedMsgPlaceLimitOrder;
  }, [simulatedMsgPlaceLimitOrder]);

  const onFormSubmit = useCallback(
    function (event?: React.FormEvent<HTMLFormElement>) {
      if (event) event.preventDefault();

      // define function to get the current market limit index with a tolerance
      const getMarketLimitIndex = () => {
        // calculate last price out from result
        const lastPriceEvent = simulationResult?.result?.events.findLast(
          (event) => event.type === 'TickUpdate'
        );

        // if market limit simulation made no update to the liquidity then skip
        if (!lastPriceEvent) {
          return;
        }

        const denomIn = getTokenId(tokenIn);

        // calculate tolerance from user slippage settings
        // set tiny minimum of tolerance as the frontend calculations
        // don't always exactly align with the backend calculations
        const tolerance = Math.max(1e-12, Number(formState.slippage) || 0);
        const toleranceFactor = 1 + tolerance;
        // calculate last price out from matching event results
        const lastPrice =
          mapEventAttributes<DexTickUpdateEvent>(lastPriceEvent)?.attributes;
        const direction =
          lastPrice.TokenIn === denomIn
            ? lastPrice.TokenIn === lastPrice.TokenZero
            : lastPrice.TokenIn === lastPrice.TokenOne;

        return direction
          ? Math.floor(Number(lastPrice.TickIndex) / toleranceFactor)
          : Math.floor(Number(lastPrice.TickIndex) * toleranceFactor);
      };

      const tickIndexLimitInToOut = formState.limitPrice
        ? displayPriceToTickIndex(
            new BigNumber(formState.limitPrice),
            tokenIn,
            tokenOut
          )
            ?.multipliedBy(buyMode ? 1 : -1)
            ?.toNumber()
        : getMarketLimitIndex();

      // if the msg is defined and the limit is ok, then proceed
      if (simulatedMsgPlaceLimitOrder && tickIndexLimitInToOut !== undefined) {
        const msgPlaceLimitOrder = {
          ...simulatedMsgPlaceLimitOrder,
          tick_index_in_to_out: Long.fromNumber(tickIndexLimitInToOut),
        };
        const gasEstimate = simulationResult?.gasInfo?.gasUsed.toNumber();
        swapRequest(msgPlaceLimitOrder, (gasEstimate || 0) * 1.5);
      }
    },
    [
      formState.limitPrice,
      formState.slippage,
      tokenIn,
      tokenOut,
      buyMode,
      simulatedMsgPlaceLimitOrder,
      simulationResult?.result?.events,
      simulationResult?.gasInfo?.gasUsed,
      swapRequest,
    ]
  );

  const warning = useMemo<string | undefined>(() => {
    // check simulation-less conditions first
    // check if sell input amount is too high
    if (
      !buyMode &&
      tokenIn &&
      amountInBaseAmount &&
      userBalanceTokenIn &&
      userBalanceTokenInDisplayAmount &&
      new BigNumber(amountInBaseAmount).isGreaterThan(userBalanceTokenIn)
    ) {
      return `Order limited to input balance: ${formatAmount(
        userBalanceTokenInDisplayAmount
      )}${tokenIn?.symbol}`;
    }
    // else check simulation results
    else if (simulatedMsgPlaceLimitOrder && simulationResult?.response) {
      // set tolerance for imprecise checks
      const tolerance = 0.0001;

      // check direct sell type (car be in buy mode using balance range slider)
      const sellOrderIsLimited =
        amountInBaseAmount !== undefined &&
        userBalanceTokenIn !== undefined &&
        new BigNumber(amountInBaseAmount).isGreaterThan(userBalanceTokenIn);

      // note: this warning can be triggered by amount in ~= the user's balance
      const buyOrderIsLimited =
        amountInBaseAmount === undefined &&
        userBalanceTokenIn !== undefined &&
        simulationResult &&
        new BigNumber(simulationResult.response.coin_in.amount)
          // make up for possible rounding on Dex (note this is inaccurate)
          .multipliedBy(1 + tolerance)
          .isGreaterThan(userBalanceTokenIn);

      // check if the trade has been limited
      if (buyOrderIsLimited || sellOrderIsLimited) {
        return `Order limited to input balance: ${formatAmount(
          userBalanceTokenInDisplayAmount || '?'
        )}${tokenIn?.symbol}`;
      }
    }

    if (Number(simulatedMsgPlaceLimitOrder?.amount_in)) {
      if (simulationResult?.error?.message.includes('Swap amount too small')) {
        return '"Swap amount too small" error';
      }
      if (simulationResult?.error?.insufficientLiquidity) {
        return 'Insufficient Liquidity: cannot complete order';
      }
    }

    if (simulationResult?.error?.message.includes('executed in its entirety')) {
      return 'Cannot execute Fill Or Kill order in its entirety';
    }

    return undefined;
  }, [
    amountInBaseAmount,
    buyMode,
    simulatedMsgPlaceLimitOrder,
    simulationResult,
    tokenIn,
    userBalanceTokenIn,
    userBalanceTokenInDisplayAmount,
  ]);

  // set fee token from native chain if not yet set
  const [chainFeeToken, setChainFeeToken] = useChainFeeToken();
  const { data: nativeChain } = useNativeChain();
  useEffect(() => {
    const firstFeeToken = nativeChain?.fees?.fee_tokens.at(0);
    if (firstFeeToken) {
      setChainFeeToken((feeToken) => feeToken || firstFeeToken.denom);
    }
  }, [nativeChain, setChainFeeToken]);

  const [lastKnownPrice, setLastKnownPrice] = useState<number>(0);
  useEffect(() => {
    if (simulationResult?.response) {
      const price = new BigNumber(simulationResult.response.coin_in.amount).div(
        simulationResult.response.taker_coin_out.amount
      );
      setLastKnownPrice(price.toNumber());
    }
  }, [simulationResult?.response]);

  // find coinIn and coinOut from the simulation results
  const tranchedReserves =
    (simulatedMsgPlaceLimitOrder &&
      nonImmediateOrderTypes.includes(
        simulatedMsgPlaceLimitOrder.order_type as number
      ) &&
      simulationResult?.response?.tranchedReserves) ||
    0;
  // determine the amount of coin out that should be possible from tranches
  const tranchedAmountOut =
    tranchedReserves /
      (simulatedMsgPlaceLimitOrder?.tick_index_in_to_out
        ? // use the limit price
          tickIndexToPrice(
            new BigNumber(
              simulatedMsgPlaceLimitOrder.tick_index_in_to_out.toNumber()
            )
          ).toNumber()
        : // use the market price or NaN
          currentPrice ?? 0) || 0;
  const coinIn = Number(simulationResult?.response?.coin_in.amount || 0);
  const coinOut =
    Number(simulationResult?.response?.taker_coin_out.amount || 0) +
    tranchedAmountOut;

  // disable fieldset with no address because the estimation requires a signed client
  const fieldset = (
    <fieldset disabled={!address}>
      <div className="mt-2 mb-4">
        <NumericInputRow
          prefix="Amount"
          placeholder={
            isValidatingBuyAmountSimulationResult ? 'finding...' : '0'
          }
          value={
            buyMode ? amountOutDisplayAmount || '' : amountInDisplayAmount || ''
          }
          onChange={(value) => {
            formSetState.setAmount?.(value);
            setTokenInBalanceFraction(undefined);
          }}
          suffix={tokenB?.symbol}
          format={formatNumericAmount('')}
        />
      </div>
      <RangeListSliderInput
        className="mb-4"
        list={userBankBalanceRangePercentages}
        disabled={
          !userBalanceTokenInDisplayAmount && isLoadingUserBalanceTokenIn
        }
        value={
          tokenInBalanceFraction ||
          (buyMode
            ? // in buy mode estimate the fraction of the token out
              Number(userBalanceTokenOut)
              ? Number(amountOutBaseAmount) / Number(userBalanceTokenOut) || 0
              : 0
            : // in sell mode estimate the fraction of the token in
              new BigNumber(
                // use amount given from text input or range slider input
                amountInBaseAmount ||
                  // estimate amount from price
                  new BigNumber(amountOutBaseAmount || 0).multipliedBy(
                    lastKnownPrice || currentPrice || 0
                  )
              )
                .dividedBy(userBalanceTokenIn || 1)
                .toNumber()) ||
          0
        }
        onChange={useCallback(
          (value: number) => {
            const numericValue = Math.max(0, Math.min(1, Number(value) || 0));
            if (buyMode) {
              formSetState.setAmount?.('');
              setTokenInBalanceFraction(numericValue);
            } else {
              setTokenInBalanceFraction(undefined);
              const display = new BigNumber(
                userBalanceTokenInDisplayAmount || 0
              );
              const newValue =
                numericValue < 1
                  ? // round calculated values
                    formatAmount(display.multipliedBy(numericValue).toNumber())
                  : // or pass full value (while truncating fractional zeros)
                    display.toFixed();
              if (newValue) {
                formSetState.setAmount?.(newValue || '');
              }
            }
          },
          [buyMode, formSetState, userBalanceTokenInDisplayAmount]
        )}
      />
      {showLimitPrice && (
        <div className="my-md">
          <NumericInputRow
            prefix={`Limit ${buyMode ? '<=' : '>='}`}
            value={formState.limitPrice ?? ''}
            placeholder="market"
            onChange={formSetState.setLimitPrice}
            suffix={tokenA && tokenB && `${tokenA.symbol} per ${tokenB.symbol}`}
            format={formatNumericAmount('')}
          />
        </div>
      )}
      <div className="my-md">
        <div className="mb-2">
          Order type{' '}
          <a
            className="button button-primary-outline px-2 py-0"
            href="https://docs.neutron.org/neutron/modules/dex/messages/#order-types"
            target="_blank"
            rel="noreferrer"
          >
            ?
          </a>
        </div>
        <SelectInput<AllowedLimitOrderTypeKey>
          className="flex col m-0 p-0"
          list={inputOrderTypes}
          getLabel={(key = defaultExecutionType) => orderTypeTextMap[key]}
          value={formState.execution}
          onChange={formSetState.setExecution}
          floating
        />
        <Drawer expanded={formState.execution === 'GOOD_TIL_TIME'}>
          <div className="mb-3 flex row gap-3">
            <NumericInputRow
              className="mb-3"
              prefix="Time"
              value={formState.timeAmount ?? ''}
              onChange={formSetState.setTimeAmount}
            />
            <SelectInput<TimePeriod>
              className="flex col m-0 p-0"
              list={timePeriods.slice()}
              getLabel={(key = 'days') => timePeriodLabels[key]}
              value={formState.timePeriod}
              onChange={formSetState.setTimePeriod}
              floating
            />
          </div>
        </Drawer>
      </div>
      <div>
        <NumericValueRow
          prefix="Est. Fee"
          value={
            chainFeeToken && simulationResult?.gasInfo?.gasUsed
              ? formatPrice(
                  formatMaximumSignificantDecimals(
                    getDisplayDenomAmount(
                      chainFeeToken,
                      simulationResult.gasInfo.gasUsed.toString()
                    ) || 0,
                    3
                  )
                )
              : '-'
          }
          suffix={chainFeeToken?.symbol}
        />
      </div>
      <div>
        <NumericValueRow
          prefix="Est. Avg. Price"
          value={formatPrice(
            formatMaximumSignificantDecimals(
              simulationResult?.response
                ? !buyMode
                  ? coinOut / coinIn || '-'
                  : coinIn / coinOut || '-'
                : '-'
            )
          )}
          suffix={tokenA && tokenB && `${tokenA.symbol} per ${tokenB.symbol}`}
        />
      </div>
      <div>
        <NumericValueRow
          prefix={`Total ${buyMode ? 'Cost' : 'Result'}`}
          loading={isValidatingSimulation}
          value={
            tokenIn && simulationResult
              ? formatAmount(
                  getDisplayDenomAmount(
                    tokenIn,
                    buyMode ? coinIn || '-' : coinOut || '-'
                  ) || 0
                )
              : '-'
          }
          suffix={tokenA?.symbol}
        />
      </div>
      {warning ? (
        // show a warning if an amount has been entered, but the form fails validation
        <div className="mt-4">
          <div className="text-error flex text-center">{warning}</div>
        </div>
      ) : Number(formState.amount) && simulationResult && !coinIn ? (
        // show a warning if an amount in, but no amount out
        <div className="mt-4">
          <div className="text-warning flex text-center">
            <p>No trade will occur with this type of order</p>
            <p>and this limit price at this time</p>
            <p>Choose a limit closer to the current price</p>
          </div>
        </div>
      ) : error ? (
        <div className="mt-4">
          <div className="text-error flex text-center">{error}</div>
        </div>
      ) : null}
      <div className="flex row">
        <button
          className="limit-order__confirm-button flex button-primary my-lg py-4"
          onClick={!address ? connectWallet : undefined}
          disabled={
            isValidatingSwap ||
            !simulationResult ||
            !coinOut ||
            (!Number(amountInBaseAmount) && !Number(amountOutBaseAmount))
          }
        >
          {!address ? 'Connect Wallet' : buyMode ? 'Buy' : 'Sell'}
        </button>
      </div>
      <NumericValueRow
        prefix="Available Balance"
        value={formatAmount(
          formatMaximumSignificantDecimals(
            tokenIn
              ? (userBalanceTokenInDisplayAmount ??
                  (isLoadingUserBalanceTokenIn && '-')) ||
                  0
              : '-',
            3
          ),
          {
            useGrouping: true,
          }
        )}
        suffix={tokenIn?.symbol}
      />
    </fieldset>
  );
  return <form onSubmit={onFormSubmit}>{fieldset}</form>;
}

function NumericInputRow({
  className,
  prefix = '',
  value = '',
  placeholder = '0',
  onInput,
  onChange = onInput,
  suffix = '',
  min,
  max,
  format,
  readOnly = false,
}: {
  className?: string;
  prefix?: string;
  value: string;
  placeholder?: string;
  onInput?: (value: string) => void;
  onChange?: (value: string) => void;
  suffix?: string;
  min?: number;
  max?: number;
  format?: (value: number) => string;
  readOnly?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [internalValue = value, setInternalValue] = useState<string>();
  /**
   * Makes sure the value is valid number within the proper range
   * @param newValue the proposed new value to be checked
   */
  const maybeUpdate = useCallback(
    (newValueString: string, onChange?: (value: string) => void) => {
      if (onChange) {
        const newValue = Number(newValueString);
        if (min !== undefined && newValue < min) {
          return onChange(format ? format(min) : min.toFixed());
        }
        if (max !== undefined && newValue > max) {
          return onChange(format ? format(max) : max.toFixed());
        }
        if (!Number.isNaN(newValue)) {
          return onChange(format ? format(newValue) : newValue.toFixed());
        }
      }
    },
    [min, max, format]
  );

  return (
    <div
      className={['numeric-value-input flex row py-3 px-4', className]
        .filter(Boolean)
        .join(' ')}
    >
      {prefix && (
        <div className="numeric-value-input__prefix mr-3">{prefix}</div>
      )}
      <input
        type="number"
        className="numeric-value-input__input flex"
        placeholder={placeholder}
        value={internalValue}
        onInput={() => maybeUpdate(inputRef.current?.value || '', onInput)}
        onChange={(e) => {
          setInternalValue(e.target.value);
          maybeUpdate(e.target.value || '', onChange);
        }}
        onBlur={() => setInternalValue(undefined)}
        readOnly={readOnly}
        style={readOnly ? { outline: 'none' } : undefined}
      ></input>
      {suffix && (
        <div className="numeric-value-input__suffix ml-3">{suffix}</div>
      )}
    </div>
  );
}

function NumericValueRow({
  prefix = '',
  loading = false,
  value = '',
  suffix = '',
  tooltip,
}: {
  prefix?: string;
  loading?: boolean;
  value: string;
  suffix?: string;
  tooltip?: string;
}) {
  return (
    <div className="numeric-value-row flex row py-2">
      <div className="numeric-value-row__prefix">
        {prefix}
        {tooltip && <Tooltip>{tooltip}</Tooltip>}
      </div>
      <div className="numeric-value-row__loading ml-auto">
        {loading && <FontAwesomeIcon className="fa-spin" icon={faSpinner} />}
      </div>
      <div className="numeric-value-row__value ml-3">{value}</div>
      {suffix && <div className="numeric-value-row__suffix ml-3">{suffix}</div>}
    </div>
  );
}
