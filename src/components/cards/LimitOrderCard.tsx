import Long from 'long';
import BigNumber from 'bignumber.js';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import TabsCard from './TabsCard';
import Tabs from '../Tabs';

import {
  Token,
  getBaseDenomAmount,
  getDisplayDenomAmount,
} from '../../lib/web3/utils/tokens';
import { dualityMainToken } from '../../lib/web3/hooks/useTokens';
import {
  formatAmount,
  formatMaximumSignificantDecimals,
  formatPercentage,
  formatPrice,
} from '../../lib/utils/number';

import './LimitOrderCard.scss';
import Tooltip from '../Tooltip';
import { useSwap } from '../../pages/Swap/hooks/useSwap';
import { useRouterResult } from '../../pages/Swap/hooks/useRouter';
import { useWeb3 } from '../../lib/web3/useWeb3';
import { useOrderedTokenPair } from '../../lib/web3/hooks/useTokenPairs';
import { useTokenPairTickLiquidity } from '../../lib/web3/hooks/useTickLiquidity';
import { useBankBalanceDisplayAmount } from '../../lib/web3/hooks/useUserBankBalances';
import RangeListSliderInput from '../inputs/RangeInput/RangeListSliderInput';
import {
  LimitOrderTypeKeys,
  LimitOrderContextProvider,
  orderTypeTextMap,
  LimitOrderFormContext,
  LimitOrderFormSetContext,
  defaultExecutionType,
  orderTypeEnum,
  timePeriods,
  timePeriodLabels,
  TimePeriod,
} from './LimitOrderContext';
import SelectInput from '../inputs/SelectInput';
import { timeUnits } from '../../lib/utils/time';
import { displayPriceToTickIndex } from '../../lib/web3/utils/ticks';
import Drawer from '../Drawer';

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
      <LimitOrderContextProvider>
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
  showTriggerPrice = false,
}: {
  tokenA?: Token;
  tokenB?: Token;
  sell?: boolean;
  showLimitPrice?: boolean;
  showTriggerPrice?: boolean;
}) {
  const buyMode = !sellMode;
  const [token0, token1] =
    useOrderedTokenPair([tokenA?.address, tokenB?.address]) || [];
  const {
    data: [token0Ticks, token1Ticks],
  } = useTokenPairTickLiquidity([token0, token1]);

  const formState = useContext(LimitOrderFormContext);
  const formSetState = useContext(LimitOrderFormSetContext);

  const tokenIn = !buyMode ? tokenA : tokenB;
  const tokenOut = buyMode ? tokenA : tokenB;
  const {
    data: userTokenInDisplayAmount,
    isValidating: isLoadingUserTokenInDisplayAmount,
  } = useBankBalanceDisplayAmount(tokenIn);
  const {
    data: userTokenOutDisplayAmount,
    isValidating: isLoadingUserTokenOutDisplayAmount,
  } = useBankBalanceDisplayAmount(tokenOut);

  const [fee] = useState('0');
  const [{ isValidating: isValidatingSwap, error }, swapRequest] = useSwap();

  const { data: routerResult } = useRouterResult({
    tokenA: tokenIn?.address,
    tokenB: tokenOut?.address,
    valueA: formState.amount,
    valueB: undefined,
  });
  const { address, connectWallet } = useWeb3();

  const onFormSubmit = useCallback(
    function (event?: React.FormEvent<HTMLFormElement>) {
      if (event) event.preventDefault();
      // calculate tolerance from user slippage settings
      // set tiny minimum of tolerance as the frontend calculations
      // don't always exactly align with the backend calculations
      const tolerance = Math.max(1e-12, Number(formState.slippage) || 0);
      const tickIndexOut = routerResult?.tickIndexOut?.toNumber() || NaN;
      const { execution, timePeriod } = formState;
      const amount = Number(formState.amount ?? NaN);
      const timeAmount = Number(formState.timeAmount ?? NaN);
      const limitPrice = Number(formState.limitPrice ?? NaN);
      const triggerPrice = Number(formState.triggerPrice ?? NaN);
      // calculate the expiration time in JS epoch (milliseconds)
      const expirationTimeMs =
        timeAmount && timePeriod
          ? new Date(Date.now() + timeAmount * timeUnits[timePeriod]).getTime()
          : NaN;
      if (
        !isNaN(amount) &&
        execution &&
        (execution === 'GOOD_TIL_TIME' ? !isNaN(expirationTimeMs) : true) &&
        (execution === 'GOOD_TIL_TIME' ? timePeriod !== undefined : true) &&
        (showLimitPrice ? !isNaN(limitPrice) : true) &&
        (showTriggerPrice ? !isNaN(triggerPrice) : true) &&
        address &&
        routerResult &&
        tokenIn &&
        tokenOut &&
        !isNaN(tolerance) &&
        !isNaN(tickIndexOut)
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
        const tickIndexLimit = tickIndexOut * (forward ? 1 : -1);
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
            amountIn: getBaseDenomAmount(tokenIn, result.amountIn) || '0',
            tokenIn: result.tokenIn,
            tokenOut: result.tokenOut,
            creator: address,
            receiver: address,
            // see LimitOrderType in types repo (cannot import at runtime)
            // https://github.com/duality-labs/dualityjs/blob/2cf50a7af7bf7c6b1490a590a4e1756b848096dd/src/codegen/duality/dex/tx.ts#L6-L13
            // using type IMMEDIATE_OR_CANCEL so that partially filled requests
            // succeed (in testing when swapping 1e18 utokens, often the order
            // would be filled with 1e18-2 utokens and FILL_OR_KILL would fail)
            // todo: use type FILL_OR_KILL: order must be filled completely
            orderType: orderTypeEnum[execution],
            // todo: set tickIndex to allow for a tolerance:
            //   the below function is a tolerance of 0
            tickIndex: Long.fromNumber(
              showLimitPrice
                ? // set given limit price
                  displayPriceToTickIndex(
                    new BigNumber(limitPrice),
                    forward ? tokenIn : tokenOut,
                    forward ? tokenOut : tokenIn
                  )?.toNumber() || NaN
                : // or default to market end trade price (with tolerance)
                  tickIndexLimit
            ),
            // optional params
            // only add maxOut for "taker" (immediate) orders
            ...((execution === 'FILL_OR_KILL' ||
              execution === 'IMMEDIATE_OR_CANCEL') && {
              maxAmountOut:
                getBaseDenomAmount(tokenOut, result.amountOut) || '0',
            }),
            // only add expiration time to timed limit orders
            ...(execution === 'GOOD_TIL_TIME' &&
              !isNaN(expirationTimeMs) && {
                expirationTime: {
                  seconds: Long.fromNumber(Math.round(expirationTimeMs / 1000)),
                  nanos: 0,
                },
              }),
          },
          gasEstimate
        );
      }
    },
    [
      formState,
      routerResult,
      showLimitPrice,
      showTriggerPrice,
      address,
      tokenIn,
      tokenOut,
      token0,
      token1Ticks,
      token0Ticks,
      swapRequest,
    ]
  );

  const warning = useMemo<string | undefined>(() => {
    const { amount, limitPrice } = formState;
    if (Number(amount) > 0) {
      if (showLimitPrice && !Number(limitPrice)) {
        return 'Limit Price is not valid';
      }
    }
    return undefined;
  }, [formState, showLimitPrice]);

  return (
    <form onSubmit={onFormSubmit}>
      <div className="mt-2 mb-4">
        <NumericInputRow
          prefix="Amount"
          value={
            buyMode
              ? formatAmount(routerResult?.amountOut.toNumber() || 0)
              : formState.amount || ''
          }
          onChange={formSetState.setAmount}
          suffix={tokenA?.symbol}
          format={formatAmount}
          // todo: estimate amountIn needed to match an amountOut value
          //       to be able to allow setting amountOut here in buyMode
          readOnly={buyMode}
        />
      </div>
      <RangeListSliderInput
        className="mb-4"
        list={userBankBalanceRangePercentages}
        disabled={
          !userTokenInDisplayAmount && isLoadingUserTokenInDisplayAmount
        }
        value={
          new BigNumber(formState.amount || 0)
            .dividedBy(userTokenInDisplayAmount || 1)
            .toNumber() || 0
        }
        onChange={useCallback(
          (value: number) => {
            const numericValue = Number(value);
            const newValue =
              numericValue < 1
                ? // round calculated values
                  formatAmount(
                    new BigNumber(userTokenInDisplayAmount || 0)
                      .multipliedBy(numericValue)
                      .toNumber()
                  )
                : // or pass full value (while truncating fractional zeros)
                  new BigNumber(userTokenInDisplayAmount || '0').toFixed();
            if (newValue) {
              formSetState.setAmount?.(newValue || '');
            }
          },
          [formSetState, userTokenInDisplayAmount]
        )}
      />
      {showLimitPrice && (
        <div className="my-md">
          <NumericInputRow
            prefix="Limit Price"
            value={formState.limitPrice ?? ''}
            onChange={formSetState.setLimitPrice}
            suffix={`${tokenA?.symbol}/${tokenB?.symbol}`}
            format={formatAmount}
          />
        </div>
      )}
      {showTriggerPrice && (
        <div className="my-md">
          <NumericInputRow
            prefix="Trigger Price"
            value={formState.triggerPrice ?? ''}
            onChange={formSetState.setTriggerPrice}
            suffix={`${tokenA?.symbol}/${tokenB?.symbol}`}
            format={formatAmount}
          />
        </div>
      )}
      <div className="my-md">
        <SelectInput<LimitOrderTypeKeys>
          className="flex col m-0 p-0"
          list={Object.keys(orderTypeTextMap) as LimitOrderTypeKeys[]}
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
          value={formatPrice(
            formatMaximumSignificantDecimals(
              getDisplayDenomAmount(dualityMainToken, fee) || 0,
              3
            )
          )}
          suffix={dualityMainToken.symbol}
        />
      </div>
      <div>
        <NumericValueRow
          prefix="Est. Slippage"
          tooltip="Slippage"
          value={formatPercentage(0)}
        />
      </div>
      <div>
        <NumericValueRow
          prefix="Est. Average Price"
          value={formatPrice(
            formatMaximumSignificantDecimals(
              tokenB ? getDisplayDenomAmount(tokenB, fee) || 0 : '-',
              3
            )
          )}
          suffix={tokenB?.symbol}
        />
      </div>
      <div>
        <NumericValueRow
          prefix="Total"
          value={formatAmount(
            !buyMode
              ? routerResult?.amountOut.toNumber() || 0
              : formState.amount || 0
          )}
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
          disabled={isValidatingSwap || !!warning || !Number(formState.amount)}
        >
          {!address ? 'Connect Wallet' : buyMode ? 'Buy' : 'Sell'}
        </button>
      </div>
      {!buyMode ? (
        <NumericValueRow
          prefix="Available Balance"
          value={formatAmount(
            formatMaximumSignificantDecimals(
              tokenA
                ? (userTokenInDisplayAmount ??
                    (isLoadingUserTokenInDisplayAmount && '-')) ||
                    0
                : '-',
              3
            ),
            {
              useGrouping: true,
            }
          )}
          suffix={tokenA?.symbol}
        />
      ) : (
        <NumericValueRow
          prefix="Available Balance"
          value={formatAmount(
            formatMaximumSignificantDecimals(
              tokenB
                ? (userTokenOutDisplayAmount ??
                    (isLoadingUserTokenOutDisplayAmount && '-')) ||
                    0
                : '-',
              3
            ),
            {
              useGrouping: true,
            }
          )}
          suffix={tokenB?.symbol}
        />
      )}
    </form>
  );
}

function NumericInputRow({
  className,
  prefix = '',
  value = '',
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
      className={['token-amount-input flex row py-3 px-4', className]
        .filter(Boolean)
        .join(' ')}
    >
      {prefix && (
        <div className="token-amount-input__prefix mr-3">{prefix}</div>
      )}
      <input
        className="token-amount-input__input flex"
        placeholder="0"
        value={internalValue}
        onInput={() => maybeUpdate(inputRef.current?.value || '0', onInput)}
        onChange={(e) => {
          setInternalValue(e.target.value);
          maybeUpdate(e.target.value || '0', onChange);
        }}
        onBlur={() => setInternalValue(undefined)}
        readOnly={readOnly}
        style={readOnly ? { outline: 'none' } : undefined}
      ></input>
      {suffix && (
        <div className="token-amount-input__suffix ml-3">{suffix}</div>
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
