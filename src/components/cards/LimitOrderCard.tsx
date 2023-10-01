import Long from 'long';
import BigNumber from 'bignumber.js';
import { useCallback, useContext, useMemo, useRef, useState } from 'react';

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
  formatCurrency,
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
} from './LimitOrderContext';
import SelectInput from '../inputs/SelectInput';
import { timeUnits } from '../../lib/utils/time';

export default function LimitOrderCard({
  tokenA,
  tokenB,
}: {
  tokenA?: Token;
  tokenB?: Token;
}) {
  return (
    <LimitOrderContextProvider>
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
    </LimitOrderContextProvider>
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
      {
        nav: 'Stop Limit',
        Tab: () => <LimitOrder {...props} showLimitPrice showTriggerPrice />,
      },
    ];
  }, [tokenA, tokenB, sell]);

  return (
    <div className="p-md pt-4">
      <Tabs className="limitorder-type" tabs={tabs} />
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

  const {
    data: userTokenADisplayAmount,
    isValidating: isLoadingUserTokenADisplayAmount,
  } = useBankBalanceDisplayAmount(tokenA);

  const [fee] = useState('0');
  const [{ isValidating: isValidatingSwap }, swapRequest] = useSwap();

  const { data: routerResult } = useRouterResult({
    tokenA: tokenA?.address,
    tokenB: tokenB?.address,
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
        tokenA &&
        tokenB &&
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
            amountIn: getBaseDenomAmount(tokenA, result.amountIn) || '0',
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
              showLimitPrice ? limitPrice : tickIndexLimit
            ),
            // optional params
            maxAmountOut: getBaseDenomAmount(tokenB, result.amountOut) || '0',
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
      tokenA,
      tokenB,
      token0,
      token1Ticks,
      token0Ticks,
      swapRequest,
    ]
  );

  return (
    <form onSubmit={onFormSubmit}>
      <div className="mt-2 mb-4">
        <NumericInputRow
          prefix="Amount"
          value={formState.amount ?? ''}
          onChange={formSetState.setAmount}
          suffix={tokenA?.symbol}
        />
      </div>
      <RangeListSliderInput
        className="mb-4"
        list={userBankBalanceRangePercentages}
        disabled={!userTokenADisplayAmount && isLoadingUserTokenADisplayAmount}
        value={
          new BigNumber(formState.amount || 0)
            .dividedBy(userTokenADisplayAmount || 1)
            .toNumber() || 0
        }
        onChange={useCallback(
          (value: number) => {
            const numericValue = Number(value);
            const newValue =
              numericValue < 1
                ? // round calculated values
                  formatAmount(
                    new BigNumber(userTokenADisplayAmount || 0)
                      .multipliedBy(numericValue)
                      .toNumber()
                  )
                : // or pass full value (while truncating fractional zeros)
                  new BigNumber(userTokenADisplayAmount || '0').toFixed();
            if (newValue) {
              formSetState.setAmount?.(newValue || '');
            }
          },
          [formSetState, userTokenADisplayAmount]
        )}
      />
      {showLimitPrice && (
        <div className="my-md">
          <NumericInputRow
            prefix="Limit Price"
            value={formState.limitPrice ?? ''}
            onChange={formSetState.setLimitPrice}
            suffix={`${tokenA?.symbol}/${tokenB?.symbol}`}
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
          />
        </div>
      )}
      <div className="my-md flex row">
        <SelectInput<LimitOrderTypeKeys>
          className="flex col m-0 p-0"
          list={Object.keys(orderTypeTextMap) as LimitOrderTypeKeys[]}
          getLabel={(key = defaultExecutionType) => orderTypeTextMap[key]}
          value={formState.execution}
          onChange={formSetState.setExecution}
          floating
        />
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
          value={formatAmount(routerResult?.amountOut?.toNumber() ?? 0)}
          suffix={tokenB?.symbol}
        />
      </div>
      <div className="flex row">
        <button
          className="limit-order__confirm-button flex button-primary my-lg py-4"
          onClick={!address ? connectWallet : undefined}
          disabled={isValidatingSwap}
        >
          {!address ? 'Connect Wallet' : buyMode ? 'Buy' : 'Sell'}
        </button>
      </div>
      <div>
        <NumericValueRow
          prefix={`${tokenA?.symbol} Available`}
          value={formatPrice(
            formatMaximumSignificantDecimals(
              tokenA ? getDisplayDenomAmount(tokenA, fee) || 0 : '-',
              3
            )
          )}
          suffix={tokenA?.symbol}
        />
      </div>
      <div>
        <NumericValueRow
          prefix="USD Available"
          tooltip="Estimated USD equivalent"
          value={formatCurrency(0)}
          suffix={tokenB?.symbol}
        />
      </div>
      <div>
        <NumericValueRow
          prefix={`${tokenB?.symbol} Available`}
          value={formatPrice(
            formatMaximumSignificantDecimals(
              tokenB ? getDisplayDenomAmount(tokenB, fee) || 0 : '-',
              3
            )
          )}
          suffix={tokenB?.symbol}
        />
      </div>
    </form>
  );
}

function NumericInputRow({
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
    <div className="token-amount-input flex row py-3 px-4">
      <div className="token-amount-input__prefix">{prefix}</div>
      <input
        className="token-amount-input__input mx-3 flex"
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
      <div className="token-amount-input__suffix">{suffix}</div>
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
