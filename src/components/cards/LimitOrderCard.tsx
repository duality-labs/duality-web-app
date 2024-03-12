import Long from 'long';
import BigNumber from 'bignumber.js';
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

import RangeListSliderInput from '../inputs/RangeInput/RangeListSliderInput';
import {
  LimitOrderContextProvider,
  LimitOrderFormContext,
  LimitOrderFormSetContext,
} from './LimitOrderContext';
import SelectInput from '../inputs/SelectInput';
import { timeUnits } from '../../lib/utils/time';
import {
  inputOrderTypeTextMap,
  orderTypeEnum,
  timePeriods,
  timePeriodLabels,
  TimePeriod,
  AllowedLimitOrderTypeKey,
} from '../../lib/web3/utils/limitOrders';
import {
  DexTickUpdateEvent,
  mapEventAttributes,
} from '../../lib/web3/utils/events';
import { displayPriceToTickIndex } from '../../lib/web3/utils/ticks';

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

  const tokenIn = !buyMode ? tokenA : tokenB;
  const tokenOut = buyMode ? tokenA : tokenB;
  const { data: userBalanceTokenIn, isLoading: isLoadingUserBalanceTokenIn } =
    useBankBalanceBaseAmount(tokenIn?.base);
  const { data: userBalanceTokenInDisplayAmount } = useBankBalanceDisplayAmount(
    tokenIn?.base
  );

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
    isLoading: isLoadingBuyAmountSimulationResult,
  } = useSimulatedLimitOrderResult(buyAmountSimulatedMsgPlaceLimitOrder);

  const {
    amountInDisplayAmount,
    amountInBaseAmount,
    amountOutDisplayAmount,
    amountOutBaseAmount,
  } = useMemo(() => {
    if (tokenIn && tokenOut) {
      // get amount in from sell mode
      const amountInDisplayAmount = !buyMode ? formState.amount : undefined;
      // get amount out from buy mode
      const amountOutDisplayAmount =
        (buyMode || undefined) &&
        (buyAmountSimulationResult || isLoadingBuyAmountSimulationResult
          ? // if we have a buy simulation result then show it or its loading state
            buyAmountSimulationResult?.response
            ? getDisplayDenomAmount(
                tokenOut,
                buyAmountSimulationResult.response.taker_coin_out.amount,
                {
                  // output a little more rounded than usual
                  fractionalDigits: 3,
                  significantDigits: 5,
                }
              )
            : ''
          : // else use the amount value directly
            formState.amount);

      // return converted values for convenience
      return {
        amountInDisplayAmount,
        amountInBaseAmount:
          amountInDisplayAmount &&
          getBaseDenomAmount(tokenIn, amountInDisplayAmount),
        amountOutDisplayAmount,
        amountOutBaseAmount:
          amountOutDisplayAmount &&
          getBaseDenomAmount(tokenOut, amountOutDisplayAmount),
      };
    }
    return {};
  }, [
    buyAmountSimulationResult,
    buyMode,
    formState.amount,
    isLoadingBuyAmountSimulationResult,
    tokenIn,
    tokenOut,
  ]);

  const simulatedMsgPlaceLimitOrder: MsgPlaceLimitOrder | undefined =
    useMemo(() => {
      const [denomIn, denomOut] = [getTokenId(tokenIn), getTokenId(tokenOut)];

      const { execution, timePeriod } = formState;
      const timeAmount = Number(formState.timeAmount ?? NaN);
      const limitPrice = Number(formState.limitPrice || NaN); // do not allow 0
      // calculate the expiration time in JS epoch (milliseconds)
      const expirationTimeMs =
        timeAmount && timePeriod
          ? new Date(Date.now() + timeAmount * timeUnits[timePeriod]).getTime()
          : NaN;

      // in buy mode: buy the amount out with the user's available balance
      const amountIn =
        tokenIn &&
        (buyMode
          ? // use bank balance
            userBalanceTokenIn && Number(userBalanceTokenIn) > 0
            ? userBalanceTokenIn
            : undefined
          : // use given amount
            amountInBaseAmount);
      const maxAmountOut = buyMode ? amountOutBaseAmount : undefined;

      // check format of request
      if (
        execution &&
        (execution === 'GOOD_TIL_TIME' ? !isNaN(expirationTimeMs) : true) &&
        (execution === 'GOOD_TIL_TIME' ? timePeriod !== undefined : true) &&
        address &&
        denomIn &&
        denomOut &&
        amountIn &&
        Number(amountIn) > 0 &&
        userBalanceTokenIn &&
        Number(userBalanceTokenIn) > 0 &&
        // check that amount out is valid if in buy mode
        (!buyMode || !isNaN(Number(maxAmountOut || NaN)))
      ) {
        // when buying: select tick index below the limit
        // when selling: select tick index above the limit
        const rounding = buyMode ? 'floor' : 'ceil';
        const limitTickIndexInToOut =
          limitPrice > 0
            ? displayPriceToTickIndex(
                new BigNumber(limitPrice),
                tokenOut,
                tokenIn,
                rounding
              )
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
        // only add maxOut for "taker" (immediate) orders
        if (
          tokenOut &&
          maxAmountOut &&
          (execution === 'FILL_OR_KILL' || execution === 'IMMEDIATE_OR_CANCEL')
        ) {
          msgPlaceLimitOrder.max_amount_out = maxAmountOut;
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
      formState,
      tokenIn,
      tokenOut,
      userBalanceTokenIn,
    ]);

  const { data: simulationResult, isValidating: isValidatingSimulation } =
    useSimulatedLimitOrderResult(simulatedMsgPlaceLimitOrder);

  const onFormSubmit = useCallback(
    function (event?: React.FormEvent<HTMLFormElement>) {
      if (event) event.preventDefault();

      // calculate last price out from result
      const lastPriceEvent = simulationResult?.result?.events.findLast(
        (event) => event.type === 'TickUpdate'
      );

      if (lastPriceEvent) {
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

        const tickIndexLimitInToOut = direction
          ? Math.floor(Number(lastPrice.TickIndex) / toleranceFactor)
          : Math.floor(Number(lastPrice.TickIndex) * toleranceFactor);

        if (simulatedMsgPlaceLimitOrder && tickIndexLimitInToOut) {
          const msgPlaceLimitOrder = {
            ...simulatedMsgPlaceLimitOrder,
            tick_index_in_to_out: Long.fromNumber(tickIndexLimitInToOut),
          };
          const gasEstimate = simulationResult?.gasInfo?.gasUsed.toNumber();
          swapRequest(msgPlaceLimitOrder, gasEstimate || 0);
        }
      }
    },
    [
      formState,
      tokenIn,
      simulatedMsgPlaceLimitOrder,
      simulationResult,
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
    else if (simulationResult?.response) {
      // check if buy input amount is too high
      if (
        buyMode &&
        amountOutBaseAmount &&
        userBalanceTokenInDisplayAmount &&
        new BigNumber(amountOutBaseAmount).isGreaterThan(
          simulationResult.response.taker_coin_out.amount || 0
        )
      ) {
        // check if amount in was limited to the bank balance
        if (
          userBalanceTokenIn &&
          new BigNumber(simulationResult.response.coin_in.amount || 0)
            .multipliedBy(1.001)
            .isGreaterThan(userBalanceTokenIn)
        ) {
          return `Order limited to input balance: ${formatAmount(
            userBalanceTokenInDisplayAmount
          )}${tokenIn?.symbol}`;
        } else {
          return 'Insufficient liquidity available';
        }
      }
      if (
        !buyMode &&
        amountInBaseAmount &&
        userBalanceTokenInDisplayAmount &&
        // allow for rounding on Dex
        new BigNumber(amountInBaseAmount)
          .multipliedBy(0.999)
          .isGreaterThan(simulationResult.response.coin_in.amount || 0)
      ) {
        // check if amount in was limited to the bank balance
        if (
          userBalanceTokenIn &&
          new BigNumber(simulationResult.response.coin_in.amount || 0)
            .multipliedBy(1.001)
            .isGreaterThanOrEqualTo(userBalanceTokenIn)
        ) {
          return `Order limited to input balance: ${formatAmount(
            userBalanceTokenInDisplayAmount
          )}${tokenIn?.symbol}`;
        } else {
          return 'Insufficient liquidity available';
        }
      }
    }
    return undefined;
  }, [
    amountInBaseAmount,
    amountOutBaseAmount,
    buyMode,
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

  // disable fieldset with no address because the estimation requires a signed client
  const fieldset = (
    <fieldset disabled={!address}>
      <div className="mt-2 mb-4">
        <NumericInputRow
          prefix="Amount"
          placeholder={isLoadingBuyAmountSimulationResult ? 'finding...' : '0'}
          value={
            buyMode ? amountOutDisplayAmount || '' : amountInDisplayAmount || ''
          }
          onChange={(value) => {
            formSetState.setAmount?.(value);
            setTokenInBalanceFraction(undefined);
          }}
          suffix={tokenA?.symbol}
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
          new BigNumber(
            buyMode
              ? simulationResult?.response
                ? // get actual async amount
                  simulationResult.response.coin_in.amount
                : // estimate amount from price
                  new BigNumber(amountOutBaseAmount || 0).multipliedBy(
                    lastKnownPrice
                  )
              : amountInBaseAmount || 0
          )
            .dividedBy(userBalanceTokenIn || 1)
            .toNumber() ||
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
            prefix={`Limit Price ${buyMode ? '<=' : '>='}`}
            value={formState.limitPrice ?? ''}
            placeholder="market"
            onChange={formSetState.setLimitPrice}
            suffix={tokenA && tokenB && `${tokenA.symbol}/${tokenB.symbol}`}
            format={formatNumericAmount('')}
          />
        </div>
      )}
      <div className="my-md">
        <SelectInput<AllowedLimitOrderTypeKey>
          className="flex col m-0 p-0"
          list={
            Object.keys(inputOrderTypeTextMap) as Array<
              keyof typeof inputOrderTypeTextMap
            >
          }
          getLabel={(key = defaultExecutionType) =>
            key && inputOrderTypeTextMap[key]
          }
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
          prefix="Est. Average Price"
          value={formatPrice(
            formatMaximumSignificantDecimals(
              simulationResult?.response
                ? !buyMode
                  ? new BigNumber(
                      simulationResult.response.taker_coin_out.amount
                    ).div(simulationResult.response.coin_in.amount)
                  : new BigNumber(simulationResult.response.coin_in.amount).div(
                      simulationResult.response.taker_coin_out.amount
                    )
                : '-'
            )
          )}
          suffix={tokenA && tokenB && `${tokenA.symbol}/${tokenB.symbol}`}
        />
      </div>
      <div>
        <NumericValueRow
          prefix={`Total ${buyMode ? 'Cost' : 'Result'}`}
          value={
            tokenIn && simulationResult?.response
              ? formatAmount(
                  getDisplayDenomAmount(
                    tokenIn,
                    buyMode
                      ? simulationResult.response.coin_in.amount
                      : simulationResult.response.taker_coin_out.amount
                  ) || 0
                )
              : '-'
          }
          suffix={tokenB?.symbol}
        />
      </div>
      {warning ? (
        // show a warning if an amount has been entered, but the form fails validation
        <div className="mt-4">
          <div className="text-error flex text-center">{warning}</div>
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
            isValidatingSimulation ||
            !simulationResult ||
            !!warning ||
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
  value = '',
  suffix = '',
  tooltip,
}: {
  prefix?: string;
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
      <div className="numeric-value-row__value ml-auto">{value}</div>
      {suffix && <div className="numeric-value-row__suffix ml-3">{suffix}</div>}
    </div>
  );
}
