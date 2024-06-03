import Long from 'long';
import BigNumber from 'bignumber.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowDown, faSpinner } from '@fortawesome/free-solid-svg-icons';
import {
  ReactNode,
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
import { useRealtimeDisplayPrice } from '../stats/hooks';

import TokenInputGroup from '../TokenInputGroup';
import NumberInput from '../inputs/NumberInput';
import {
  LimitOrderContextProvider,
  LimitOrderFormContext,
  LimitOrderFormSetContext,
} from './LimitOrderContext';
import RadioButtonGroupInput from '../RadioButtonGroupInput/RadioButtonGroupInput';
import SelectInput from '../inputs/SelectInput';
import { timeUnits } from '../../lib/utils/time';
import {
  orderTypeEnum,
  timePeriods,
  timePeriodLabels,
  TimePeriod,
  AllowedLimitOrderTypeKey,
  nonImmediateOrderTypes,
  immediateOrderTypes,
} from '../../lib/web3/utils/limitOrders';
import {
  DexPlaceLimitOrderEvent,
  DexTickUpdateEvent,
  DexTickUpdateReservesEvent,
  DexTickUpdateTrancheEvent,
  mapEventAttributes,
} from '../../lib/web3/utils/events';
import {
  displayPriceToTickIndex,
  tickIndexToDisplayPrice,
  tickIndexToPrice,
} from '../../lib/web3/utils/ticks';
import { guessInvertedOrder } from '../../lib/web3/utils/pairs';

import AssetIcon from '../assets/AssetIcon';
import AssetSymbol from '../assets/AssetName';

import Drawer from '../Drawer';

const { REACT_APP__MAX_TICK_INDEXES = '' } = import.meta.env;
const [, priceMaxIndex = Number.MAX_SAFE_INTEGER] =
  `${REACT_APP__MAX_TICK_INDEXES}`.split(',').map(Number).filter(Boolean);

const defaultExecutionType: AllowedLimitOrderTypeKey = 'FILL_OR_KILL';

export default function LimitOrderCard({
  tokenA,
  tokenB,
  getSetLimitPrice,
  setPriceIndication,
}: {
  tokenA?: Token;
  tokenB?: Token;
  getSetLimitPrice?: (setLimitPrice: (limitPrice: string) => void) => void;
  setPriceIndication?: React.Dispatch<React.SetStateAction<number | undefined>>;
}) {
  return (
    <div className="page-card flex limitorder-card py-0 px-md">
      {tokenA && tokenB && (
        <LimitOrderContextProvider defaultExecutionType={defaultExecutionType}>
          <LimitOrder
            tokenA={tokenA}
            tokenB={tokenB}
            getSetLimitPrice={getSetLimitPrice}
            setPriceIndication={setPriceIndication}
          />
        </LimitOrderContextProvider>
      )}
    </div>
  );
}

const modeTabs = ['Buy', 'Sell'] as const;
type ModeTab = typeof modeTabs[number];

const priceTabs = ['Swap', 'Limit'] as const;
type PriceTab = typeof priceTabs[number];

const expirationOptions = {
  none: 'None',
  '1 hours': '1 hour',
  '1 days': '1 day',
  '1 weeks': '1 week',
  custom: 'Custom',
} as const;
type ExpirationOptions = keyof typeof expirationOptions;

const buyLimitPriceOptions = {
  0: 'Market',
  1: '-1%',
  5: '-5%',
  10: '-10%',
  [-1]: 'Custom',
} as const;
const sellLimitPriceOptions = {
  0: 'Market',
  1: '+1%',
  5: '+5%',
  10: '+10%',
  [-1]: 'Custom',
} as const;
type LimitPriceOptions =
  | keyof typeof buyLimitPriceOptions
  | keyof typeof sellLimitPriceOptions;

function getShortcutExpirationTime(
  expiration: ExpirationOptions
): [number, TimePeriod] | undefined {
  const timeString = expiration.split(' ');
  if (timeString.length >= 2) {
    const [timeAmount, timePeriod] = timeString;
    return [Number(timeAmount), timePeriod as TimePeriod];
  }
}
function getCustomExpirationTimeMs(timeAmount: number, timePeriod: TimePeriod) {
  return timeAmount && timePeriod
    ? timePeriod === 'years' || timePeriod === 'months'
      ? (() => {
          const date = new Date();
          if (timePeriod === 'years') {
            date.setFullYear(date.getFullYear() + 1);
          }
          if (timePeriod === 'months') {
            date.setMonth(date.getMonth() + 1);
          }
          return date;
        })().getTime()
      : new Date(Date.now() + timeAmount * timeUnits[timePeriod]).getTime()
    : NaN;
}

function getExpirationTimeMs(
  expiration: ExpirationOptions,
  formState: { timeAmount?: string; timePeriod?: TimePeriod }
) {
  const [timeAmount, timePeriod]: [number, TimePeriod] =
    getShortcutExpirationTime(expiration) || [
      Number(formState.timeAmount ?? 1),
      formState.timePeriod || 'days',
    ];
  return getCustomExpirationTimeMs(timeAmount, timePeriod);
}

function LimitOrder({
  tokenA,
  tokenB,
  getSetLimitPrice,
  setPriceIndication,
}: {
  tokenA: Token;
  tokenB: Token;
  getSetLimitPrice?: (setLimitPrice: (limitPrice: string) => void) => void;
  setPriceIndication?: React.Dispatch<React.SetStateAction<number | undefined>>;
}) {
  const [modeTab, setModeTab] = useState<ModeTab>(modeTabs[0]);
  const [priceTab, setPriceTab] = useState<PriceTab>(priceTabs[0]);

  const formState = useContext(LimitOrderFormContext);
  const formSetState = useContext(LimitOrderFormSetContext);

  const [expiration, setExpiration] = useState<ExpirationOptions>('none');
  // allow an expiration change to change the custom time amount and period
  const switchExpiration = useCallback(
    (newExpiration: ExpirationOptions) => {
      // when selecting custom time: prefill the form with the previous shortcut
      if (newExpiration === 'custom') {
        const timeParts = expiration.split(' ') as [string, TimePeriod];
        if (timeParts.length > 1) {
          const [timeAmount, timePeriod] = timeParts;
          formSetState.setTimeAmount?.(timeAmount);
          formSetState.setTimePeriod?.(timePeriod);
        }
      }
      setExpiration(newExpiration);
    },
    [formSetState, expiration]
  );
  const hasExpiry = expiration !== 'none';

  const switchModeTab = useCallback(
    (newModeTab: ModeTab) => {
      // change tab
      setModeTab(newModeTab);
      // set new amount and estimated exchange rate
      if (modeTab !== newModeTab) {
        formSetState.setAmountInOut?.(([a, b]) => [b, a]);
      }
    },
    [formSetState, modeTab]
  );

  const switchPriceTab = useCallback(
    (newPriceTab: PriceTab) => {
      // change tab
      setPriceTab(newPriceTab);
      // enforce changed execution type
      const newExec =
        newPriceTab === 'Limit' ? 'GOOD_TIL_TIME' : 'FILL_OR_KILL';
      formSetState.setExecution?.(newExec);
    },
    [formSetState]
  );

  const cardModeNav = (
    <div className="row">
      <h3 className="h4 pb-0 pt-lg pr-md">Trade</h3>
      <div className="col ml-auto">
        <RadioButtonGroupInput<PriceTab>
          className="order-type-input my-4"
          values={priceTabs}
          value={priceTab}
          onChange={switchPriceTab}
        />
      </div>
      <div className="col ml-md h3">
        <RadioButtonGroupInput<ModeTab>
          className="order-type-input my-4"
          values={modeTabs}
          value={modeTab}
          onChange={switchModeTab}
        />
      </div>
    </div>
  );

  const buyMode = modeTab === 'Buy';
  const [denomA, denomB] = [getTokenId(tokenA), getTokenId(tokenB)];

  const tokenIn = !buyMode ? tokenB : tokenA;
  const tokenOut = buyMode ? tokenB : tokenA;
  const denomIn = getTokenId(tokenIn);
  const { data: userBalanceTokenIn, isLoading: isLoadingUserBalanceTokenIn } =
    useBankBalanceBaseAmount(denomIn);
  const { data: userBalanceTokenInDisplayAmount } =
    useBankBalanceDisplayAmount(denomIn);
  const { meta } = useTokenPairMapLiquidity([denomA, denomB]);

  const setAmountIn = useCallback(
    (v: string) => formSetState?.setAmountInOut?.([v, '']),
    [formSetState]
  );
  const setAmountOut = useCallback(
    (v: string) => formSetState?.setAmountInOut?.(['', v]),
    [formSetState]
  );

  const [{ isValidating: isValidatingSwap, error }, swapRequest] = useSwap(
    [denomA, denomB].filter((denom): denom is string => !!denom)
  );

  const { address, connectWallet } = useWeb3();

  const { amountInBaseAmount, amountOutBaseAmount } = useMemo(() => {
    if (tokenIn && tokenOut) {
      // return converted values for convenience
      return {
        amountInBaseAmount: formState.amountIn
          ? getBaseDenomAmount(tokenIn, formState.amountIn || 0)
          : undefined,
        amountOutBaseAmount: formState.amountOut
          ? getBaseDenomAmount(tokenOut, formState.amountOut || 0)
          : undefined,
      };
    }
    return {};
  }, [tokenIn, tokenOut, formState.amountIn, formState.amountOut]);

  const [, currentPriceAtoB] = useRealtimeDisplayPrice(tokenA, tokenB);
  const currentPriceInToOut = currentPriceAtoB
    ? tokenA === tokenIn
      ? currentPriceAtoB
      : 1 / currentPriceAtoB
    : undefined;

  const [limitOption, setLimitOption] = useState<LimitPriceOptions>(0);

  // combine offset and current price to get dynamic limit price
  const offsetLimitPrice = useMemo<string | undefined>(() => {
    if (currentPriceAtoB && limitOption >= 0) {
      return formatAmount(
        new BigNumber(currentPriceAtoB)
          .multipliedBy(1 + (buyMode ? -limitOption : limitOption) / 100)
          .toFixed(),
        { maximumSignificantDigits: 6 }
      );
    }
  }, [buyMode, currentPriceAtoB, limitOption]);

  const switchLimitOption = useCallback(
    (limitOption: LimitPriceOptions) => {
      // set value
      setLimitOption(limitOption);
      // remove custom limit price if setting one here
      if (Number(limitOption) >= 0) {
        formSetState.setLimitPrice?.('');
      } else {
        formSetState.setLimitPrice?.(offsetLimitPrice || '');
      }
    },
    [formSetState, offsetLimitPrice]
  );

  // pass up a callback for parents to set the limit price here
  useEffect(() => {
    getSetLimitPrice?.((limitPriceString) => {
      const limitPrice = Number(limitPriceString);
      if (currentPriceAtoB && limitPrice && !isNaN(limitPrice)) {
        setPriceTab('Limit');
        switchLimitOption(-1);
        setModeTab(currentPriceAtoB > limitPrice ? 'Buy' : 'Sell');
        formSetState.setLimitPrice?.(limitPriceString);
      } else {
        switchLimitOption(0);
      }
    });
  }, [currentPriceAtoB, formSetState, getSetLimitPrice, switchLimitOption]);

  // detect when the user has asked for a limit "outside liquidity bounds"
  // in these cases the simulation won't help because it can only compute the
  // immediate result of the msg tx: the future amountOut must be estimated
  const outsideBounds =
    // ensure bounds can be calculated
    currentPriceAtoB &&
    formState.limitPrice &&
    formState.execution &&
    // check if the user is using a limit order
    // ie. the user may have requested a price outside liquidity bounds
    priceTab === 'Limit' &&
    // check if the user is using a non-immediate order type
    // ie. the order may not be filled immediately in the simulation
    nonImmediateOrderTypes.includes(
      orderTypeEnum[formState.execution] as number
    ) &&
    // check if the user requested a price outside liquidity bounds
    // ie. the order may not be filled immediately in the simulation
    (buyMode
      ? new BigNumber(formState.limitPrice).lt(currentPriceAtoB)
      : new BigNumber(formState.limitPrice).gt(currentPriceAtoB));

  // the best estimated price will depend on whether the limit is out of bounds
  const [lastKnownPrice, setLastKnownPrice] = useState<number>(0);
  const estimatedPriceInToOut =
    outsideBounds && formState.limitPrice
      ? // calculate limitPriceInToOut value
        tokenA === tokenIn
        ? new BigNumber(formState.limitPrice).toNumber()
        : new BigNumber(1).dividedBy(formState.limitPrice).toNumber()
      : // or use last known price (for more accuracy)
      // falling back to current price (for less accuracy)
      lastKnownPrice && Number.isFinite(lastKnownPrice)
      ? lastKnownPrice
      : currentPriceInToOut || 0;

  const simulatedMsgPlaceLimitOrder: MsgPlaceLimitOrder | undefined =
    useMemo(() => {
      const [denomIn, denomOut] = [getTokenId(tokenIn), getTokenId(tokenOut)];

      const execution = formState.execution;
      // find limit price from custom limit price or limit price offset
      // calculation, and do not pass 0: allow NaN to act as market price
      const limitPrice = Number(
        formState.limitPrice || (priceTab === 'Limit' ? offsetLimitPrice : NaN)
      );

      // find amounts in/out for the order
      // in buy mode: buy the amount out with the user's available balance
      const amountIn = amountInBaseAmount || userBalanceTokenIn;
      // use amount out to set the order limit only if the amount in is not set
      const maxAmountOut = amountOutBaseAmount;

      // check format of request
      if (
        execution &&
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
            limitTickIndexInToOut !== undefined && priceTab === 'Limit'
              ? Long.fromNumber(limitTickIndexInToOut.toNumber())
              : Long.fromNumber(priceMaxIndex),
        };
        // optional params
        // only add maxOut for buy orders
        if (tokenOut && maxAmountOut && estimatedPriceInToOut) {
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
            // note: this is a bit of an awkward estimation that goes from the
            //       user's set limit to the current price
            const estimatedTokenIn =
              Number(maxAmountOut) *
              BigNumber[buyMode ? 'min' : 'max'](
                tickIndexToPrice(
                  limitTickIndexInToOut ?? new BigNumber(priceMaxIndex)
                ),
                estimatedPriceInToOut
              ).toNumber();
            msgPlaceLimitOrder.amount_in = BigNumber.min(
              msgPlaceLimitOrder.amount_in,
              estimatedTokenIn
            ).toFixed(0);
          }
        }
        // only add expiration time to timed limit orders
        if (formState.execution === 'GOOD_TIL_TIME') {
          const expirationTimeMs = getExpirationTimeMs(expiration, {
            timeAmount: '1',
            timePeriod: 'days',
          });
          if (hasExpiry && !isNaN(expirationTimeMs)) {
            msgPlaceLimitOrder.expiration_time = {
              seconds: Long.fromNumber(Math.round(expirationTimeMs / 1000)),
              nanos: 0,
            };
          } else {
            msgPlaceLimitOrder.order_type = orderTypeEnum['GOOD_TIL_CANCELLED'];
          }
        }
        return msgPlaceLimitOrder;
      }
    }, [
      address,
      amountInBaseAmount,
      amountOutBaseAmount,
      buyMode,
      estimatedPriceInToOut,
      expiration,
      formState.execution,
      formState.limitPrice,
      hasExpiry,
      offsetLimitPrice,
      priceTab,
      tokenIn,
      tokenOut,
      userBalanceTokenIn,
    ]);

  // keep track of whether the simulation result was calculated on the given
  // user inputs (but the dex price may be different) by tracking last msg
  const [lastSimulatedMsgPlaceLimitOrder, setLastSimulatedMsgPlaceLimitOrder] =
    useState<MsgPlaceLimitOrder>();
  const simulationResultMatchesInput = useMemo(() => {
    return (
      simulatedMsgPlaceLimitOrder !== undefined &&
      lastSimulatedMsgPlaceLimitOrder === simulatedMsgPlaceLimitOrder
    );
  }, [lastSimulatedMsgPlaceLimitOrder, simulatedMsgPlaceLimitOrder]);

  const { data: simulationResult, isValidating: isValidatingSimulation } =
    useSimulatedLimitOrderResult(simulatedMsgPlaceLimitOrder, {
      // if the limit order payload hasn't changed then keep the previous data
      keepPreviousData:
        // don't keep when input goes to 0
        Number(simulatedMsgPlaceLimitOrder?.amount_in) > 0 ||
        // don't change if input exists and hasn't changed
        simulationResultMatchesInput,
      // invalidate the request cache when the liquidity height changes
      memo: `height of ${meta?.height}`,
    });
  // update last simulatedMsgPlaceLimitOrder for comparison on the next render
  useEffect(() => {
    // set only after simulation result has been found
    if (!isValidatingSimulation) {
      setLastSimulatedMsgPlaceLimitOrder(simulatedMsgPlaceLimitOrder);
    }
  }, [isValidatingSimulation, simulatedMsgPlaceLimitOrder]);

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

      // find limit price from custom limit price or limit price offset
      // calculation, and do not pass 0: allow NaN to raise errors
      const limitPrice = Number(
        formState.limitPrice || (limitOption > 0 ? offsetLimitPrice : NaN)
      );

      const tickIndexLimitInToOut = limitPrice
        ? displayPriceToTickIndex(new BigNumber(limitPrice), tokenIn, tokenOut)
            ?.multipliedBy(buyMode ? 1 : -1)
            ?.toNumber()
        : getMarketLimitIndex();

      // if the msg is defined and the limit is ok, then proceed
      if (simulatedMsgPlaceLimitOrder && tickIndexLimitInToOut !== undefined) {
        const msgPlaceLimitOrder = {
          ...simulatedMsgPlaceLimitOrder,
          tick_index_in_to_out: Long.fromNumber(tickIndexLimitInToOut),
        };

        // only add expiration time to timed limit orders
        if (formState.execution === 'GOOD_TIL_TIME') {
          const expirationTimeMs = getExpirationTimeMs(expiration, {
            timeAmount: formState.timeAmount,
            timePeriod: formState.timePeriod,
          });
          if (hasExpiry && !isNaN(expirationTimeMs)) {
            msgPlaceLimitOrder.expiration_time = {
              seconds: Long.fromNumber(Math.round(expirationTimeMs / 1000)),
              nanos: 0,
            };
          } else {
            msgPlaceLimitOrder.order_type = orderTypeEnum['GOOD_TIL_CANCELLED'];
          }
        }

        const gasEstimate = simulationResult?.gasInfo?.gasUsed.toNumber();
        swapRequest(msgPlaceLimitOrder, (gasEstimate || 0) * 1.5);
      }
    },
    [
      formState.limitPrice,
      formState.slippage,
      formState.execution,
      formState.timeAmount,
      formState.timePeriod,
      limitOption,
      offsetLimitPrice,
      tokenIn,
      tokenOut,
      buyMode,
      simulatedMsgPlaceLimitOrder,
      simulationResult?.result?.events,
      simulationResult?.gasInfo?.gasUsed,
      swapRequest,
      expiration,
      hasExpiry,
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

  useEffect(() => {
    if (simulationResult?.response) {
      const price = new BigNumber(simulationResult.response.coin_in.amount).div(
        simulationResult.response.taker_coin_out.amount
      );
      // track last price state
      setLastKnownPrice(price.toNumber());
    }
  }, [simulationResult?.response]);

  // update the price indication from the form
  useEffect(() => {
    if (setPriceIndication) {
      // set limit price
      if (priceTab === 'Limit' && limitOption !== 0) {
        setPriceIndication(Number(formState.limitPrice || offsetLimitPrice));
      }
      // set market price slippage result: based on trade simulation end price
      else if (priceTab === 'Swap' && simulationResult?.result) {
        const events = simulationResult.result?.events.map(mapEventAttributes);
        // determine is this swap produced a tranche key (it should not)
        const resultTrancheKey = events.find(
          (event): event is DexPlaceLimitOrderEvent =>
            (event as DexPlaceLimitOrderEvent).attributes.action ===
            'PlaceLimitOrder'
        )?.attributes.TrancheKey;
        // get price events
        const orderPriceEvents = events
          // match reserve updates
          .filter<DexTickUpdateReservesEvent | DexTickUpdateTrancheEvent>(
            (event): event is DexTickUpdateReservesEvent =>
              // match reserves event
              !!(event as DexTickUpdateReservesEvent).attributes.TickIndex &&
              // unmatch result tranch event
              // note: this should be removable after the chain update to sdk-50
              (!resultTrancheKey ||
                (event as DexTickUpdateTrancheEvent).attributes.TrancheKey !==
                  resultTrancheKey)
          );
        // determine the resulting price
        const orderPriceEventIndexes = orderPriceEvents?.map(
          (event) =>
            Number(event.attributes.TickIndex) *
            (event.attributes.TokenIn === tokenA.base ? -1 : 1)
        );
        const endPriceTickIndex = buyMode
          ? Math.max(...orderPriceEventIndexes)
          : Math.min(...orderPriceEventIndexes);
        const endDisplayPrice =
          Number.isFinite(endPriceTickIndex) &&
          tickIndexToDisplayPrice(
            new BigNumber(endPriceTickIndex),
            tokenA,
            tokenB
          )?.toNumber();
        setPriceIndication(endDisplayPrice || currentPriceAtoB || undefined);
      }
      // set market price if available: no simulation result
      else {
        setPriceIndication(currentPriceAtoB || undefined);
      }
    }
  }, [
    buyMode,
    currentPriceAtoB,
    formState.limitPrice,
    limitOption,
    offsetLimitPrice,
    priceTab,
    setPriceIndication,
    simulationResult?.result,
    tokenA,
    tokenB,
  ]);

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
          currentPriceInToOut ?? 0) || 0;
  const coinIn =
    isValidatingSimulation && lastKnownPrice
      ? amountOutBaseAmount && lastKnownPrice > 0
        ? // don't estimate higher than the user's balance because the simulate
          // function won't accept an input higher than the user's balance
          BigNumber.min(
            userBalanceTokenIn || 0,
            new BigNumber(amountOutBaseAmount).multipliedBy(
              estimatedPriceInToOut
            )
          ).toNumber()
        : 0
      : Number(simulationResult?.response?.coin_in.amount || 0);
  const coinOut =
    isValidatingSimulation && lastKnownPrice
      ? amountInBaseAmount && lastKnownPrice > 0
        ? // don't estimate higher than the user's balance because the simulate
          // function won't accept an input higher than the user's balance
          BigNumber.min(
            userBalanceTokenIn || 0,
            new BigNumber(amountInBaseAmount)
          )
            .dividedBy(estimatedPriceInToOut || 1)
            .toNumber()
        : 0
      : Number(simulationResult?.response?.taker_coin_out.amount || 0) +
        tranchedAmountOut;

  const valueIn = useMemo(() => {
    return (
      formState?.amountIn ||
      formatAmount(getDisplayDenomAmount(tokenIn, coinIn) || 0, {
        maximumSignificantDigits: 5,
      })
    );
  }, [coinIn, formState?.amountIn, tokenIn]);
  const valueOut = useMemo(() => {
    return (
      formState?.amountOut ||
      formatAmount(getDisplayDenomAmount(tokenOut, coinOut) || 0, {
        maximumSignificantDigits: 5,
      })
    );
  }, [coinOut, formState?.amountOut, tokenOut]);

  const hasInsufficientFunds = new BigNumber(
    userBalanceTokenInDisplayAmount || 0
  ).isLessThan(Number(valueIn) || Number(valueOut) || 0);

  // disable fieldset with no address because the estimation requires a signed client
  const fieldset = (
    <fieldset>
      <Drawer expanded={priceTab === 'Limit'}>
        <LimitPriceInput
          className="focusable"
          tokenA={tokenA}
          tokenB={tokenB}
          limitPrice={formState.limitPrice || offsetLimitPrice || ''}
          onLimitPriceChange={(price) => {
            // and remove generated market offset price
            if (limitOption >= 0) {
              switchLimitOption(-1);
            }
            // set price
            formSetState.setLimitPrice?.(price);
          }}
          limitOptions={buyMode ? buyLimitPriceOptions : sellLimitPriceOptions}
          limitOption={limitOption}
          onLimitOptionChange={switchLimitOption}
        />
        <div style={{ height: 0 }}>&nbsp;</div>
      </Drawer>
      <div className="row">
        <TokenInputGroup
          className="focusable flex"
          header="You pay"
          subHeader={
            (!address && 'Wallet not connected') ||
            (!userBalanceTokenIn &&
              hasInsufficientFunds &&
              `Your balance: ${formatAmount(
                userBalanceTokenInDisplayAmount || 0
              )}`)
          }
          onValueChanged={setAmountIn}
          token={tokenIn}
          variant={hasInsufficientFunds && 'error'}
          inactive={!formState?.amountIn && isValidatingSimulation}
          value={valueIn}
          disabledInput={isLoadingUserBalanceTokenIn}
        ></TokenInputGroup>
      </div>
      <div className="row gutter-y-3 flex-centered direction-button-row">
        <button
          type="button"
          disabled={isValidatingSwap}
          onClick={() => switchModeTab(modeTab === 'Buy' ? 'Sell' : 'Buy')}
          className="icon-button direction-button"
        >
          <FontAwesomeIcon icon={faArrowDown}></FontAwesomeIcon>
        </button>
      </div>
      <div className="row">
        <TokenInputGroup
          className="focusable flex"
          header="You receive"
          onValueChanged={setAmountOut}
          token={tokenOut}
          inactive={!formState?.amountOut && isValidatingSimulation}
          value={valueOut}
          maxValue={0}
          disabledInput={isLoadingUserBalanceTokenIn}
        ></TokenInputGroup>
      </div>
      <div className="limit-expiry-selection my-md">
        <Drawer expanded={formState.execution === 'GOOD_TIL_TIME'}>
          <div className="row flex-centered">
            <div className="col my-2 mr-2">Expiry</div>
            <div className="col ml-auto">
              <RadioButtonGroupInput<ExpirationOptions>
                className="order-type-input text-s"
                values={expirationOptions}
                value={expiration}
                onChange={switchExpiration}
              />
            </div>
          </div>
        </Drawer>
        <Drawer
          expanded={
            formState.execution === 'GOOD_TIL_TIME' && expiration === 'custom'
          }
        >
          <div className="my-3 flex row gap-3">
            <NumericInputRow
              className="focusable mb-3"
              prefix="Time"
              format={formatAmount}
              value={formState.timeAmount ?? ''}
              onChange={(v) => {
                setExpiration('custom');
                formSetState.setTimeAmount?.(v);
              }}
            />
            <SelectInput<TimePeriod>
              className="focusable flex col m-0 p-0"
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
          loading={isValidatingSimulation}
          value={formatPrice(
            formatMaximumSignificantDecimals(
              simulationResult?.response
                ? !buyMode
                  ? (isValidatingSimulation
                      ? 1 / estimatedPriceInToOut
                      : coinOut / coinIn) || '-'
                  : (isValidatingSimulation
                      ? estimatedPriceInToOut
                      : coinIn / coinOut) || '-'
                : '-'
            )
          )}
          suffix={tokenA && tokenB && `${tokenA.symbol} per ${tokenB.symbol}`}
        />
      </div>
      {warning ? (
        // show a warning if an amount has been entered, but the form fails validation
        <div className="mt-4">
          <div className="text-error flex text-center">{warning}</div>
        </div>
      ) : simulationResult &&
        ((Number(formState.amountIn) && !coinOut) ||
          (Number(formState.amountOut) && !coinIn)) ? (
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
        {address ? (
          <button
            className="h4 flex button-primary mt-lg mb-md p-4"
            disabled={
              isValidatingSwap ||
              !simulationResult ||
              !simulationResultMatchesInput ||
              (!Number(amountInBaseAmount) && !Number(amountOutBaseAmount))
            }
          >
            {buyMode ? 'Buy' : 'Sell'}
          </button>
        ) : (
          <button
            className="h4 flex button-primary mt-lg mb-md p-4"
            onClick={connectWallet}
          >
            Connect Wallet
          </button>
        )}
      </div>
    </fieldset>
  );
  return (
    <>
      {cardModeNav}
      <form onSubmit={onFormSubmit}>{fieldset}</form>
    </>
  );
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
  prefix?: ReactNode;
  value: string;
  placeholder?: string;
  onInput?: (value: string) => void;
  onChange?: (value: string) => void;
  suffix?: ReactNode;
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
      className={['numeric-value-input flex row', className]
        .filter(Boolean)
        .join(' ')}
      onClick={() => inputRef.current?.focus()}
      onKeyDown={() => inputRef.current?.focus()}
      role="button"
      tabIndex={0}
    >
      {prefix && (
        <div className="numeric-value-input__prefix mr-3">{prefix}</div>
      )}
      <input
        ref={inputRef}
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
    <div className="numeric-value-row flex row py-2 gapx-3">
      <div className="numeric-value-row__prefix">
        {prefix}
        {tooltip && <Tooltip>{tooltip}</Tooltip>}
      </div>
      <div className="numeric-value-row__right ml-auto text-right">
        <span className="nowrap">
          <span className="numeric-value-row__loading">
            <FontAwesomeIcon
              className={['fa-spin', !loading && 'invisible']
                .filter(Boolean)
                .join(' ')}
              icon={faSpinner}
            />
          </span>
          <span className="numeric-value-row__value ml-3">{value}</span>
        </span>
        {suffix && (
          <span className="numeric-value-row__suffix ml-3">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function LimitPriceInput({
  className,
  tokenA,
  tokenB,
  limitPrice,
  onLimitPriceChange,
  limitOptions,
  limitOption,
  onLimitOptionChange,
}: {
  className?: string;
  tokenA: Token;
  tokenB: Token;
  limitPrice: string;
  onLimitPriceChange: (limitPrice: string) => void;
  limitOptions: Record<LimitPriceOptions, ReactNode>;
  limitOption: LimitPriceOptions;
  onLimitOptionChange: (limitOption: LimitPriceOptions) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleClick = useCallback((event: { target: EventTarget }) => {
    // only focus input if click comes from an unfocusable element
    const target = event.target as HTMLElement | null;
    if (target && target.tabIndex < 0) {
      inputRef.current?.focus();
    }
  }, []);
  const handleLimitOptionChange = useCallback(
    (limitOption: LimitPriceOptions) => {
      // action callback
      onLimitOptionChange(limitOption);
      // focus input when "custom" is selected
      if (limitOption < 0) {
        inputRef.current?.select();
      }
    },
    [onLimitOptionChange]
  );
  return (
    <div
      className={[
        className,
        'limit-price mb-4',
        // handle '0' value limit price with an error style
        limitPrice && !Number(limitPrice) && 'limit-price--error',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={handleClick}
      onKeyDown={handleClick}
      role="button"
      tabIndex={-1}
    >
      <div
        className="flex row flex-centered gap-2"
        style={{ alignItems: 'center', justifyContent: 'flex-start' }}
      >
        <span>When 1</span>
        <div className="col my-2">
          <AssetIcon asset={tokenB} height="1.5em" />
        </div>
        <div className="col">
          <AssetSymbol asset={tokenB} />
        </div>
        <span>is worth</span>
      </div>
      <div className="numeric-value-input flex row">
        <NumberInput
          innerRef={inputRef}
          value={limitPrice}
          onChange={onLimitPriceChange}
        />
        <div className="row flex-centered gap-2 ml-2">
          <div className="col my-2">
            <AssetIcon asset={tokenA} height="1.5em" />
          </div>
          <div className="col">
            <AssetSymbol asset={tokenA} />
          </div>
        </div>
      </div>
      <div className="row">
        <RadioButtonGroupInput<LimitPriceOptions>
          className="mt-3 order-type-input text-s"
          values={limitOptions}
          value={limitOption}
          onChange={handleLimitOptionChange}
        />
      </div>
    </div>
  );
}
