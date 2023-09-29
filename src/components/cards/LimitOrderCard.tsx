import Long from 'long';
import BigNumber from 'bignumber.js';
import { useCallback, useMemo, useRef, useState } from 'react';

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
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle } from '@fortawesome/free-solid-svg-icons';
import Tooltip from '../Tooltip';
import { useSwap } from '../../pages/Swap/hooks/useSwap';
import { useRouterResult } from '../../pages/Swap/hooks/useRouter';
import { useWeb3 } from '../../lib/web3/useWeb3';
import { useOrderedTokenPair } from '../../lib/web3/hooks/useTokenPairs';
import { useTokenPairTickLiquidity } from '../../lib/web3/hooks/useTickLiquidity';
import { useBankBalanceDisplayAmount } from '../../lib/web3/hooks/useUserBankBalances';

export default function LimitOrderCard({
  tokenA,
  tokenB,
}: {
  tokenA?: Token;
  tokenB?: Token;
}) {
  return (
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
            Tab: () => <LimitOrderType tokenA={tokenA} tokenB={tokenB} />,
          },
          {
            nav: 'Sell',
            Tab: () => <LimitOrderType tokenA={tokenA} tokenB={tokenB} sell />,
          },
        ];
      }, [tokenA, tokenB])}
    />
  );
}

function LimitOrderType({
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
        Tab: () => <LimitOrder {...props} />,
      },
      {
        nav: 'Market',
        Tab: () => <LimitOrder {...props} />,
      },
      {
        nav: 'Stop Limit',
        Tab: () => <LimitOrder {...props} />,
      },
    ];
  }, [tokenA, tokenB, sell]);

  return (
    <div className="pt-4 px-md">
      <Tabs className="limitorder-type" tabs={tabs} />
    </div>
  );
}

const sliderValues = [0, 0.25, 0.5, 0.75, 1];

function LimitOrder({
  tokenA,
  tokenB,
  sell: sellMode = false,
}: {
  tokenA?: Token;
  tokenB?: Token;
  sell?: boolean;
}) {
  const buyMode = !sellMode;
  const [token0, token1] =
    useOrderedTokenPair([tokenA?.address, tokenB?.address]) || [];
  const {
    data: [token0Ticks, token1Ticks],
  } = useTokenPairTickLiquidity([token0, token1]);

  const [amount, setAmount] = useState('0');
  const {
    data: userTokenADisplayAmount,
    isValidating: isLoadingUserTokenADisplayAmount,
  } = useBankBalanceDisplayAmount(tokenA);
  const [sliderIndex, setSliderIndex] = useState<number>(0);
  const slippage = 0.1;

  const [fee] = useState('0');
  const [{ isValidating: isValidatingSwap }, swapRequest] = useSwap();

  const { data: routerResult } = useRouterResult({
    tokenA: tokenA?.address,
    tokenB: tokenB?.address,
    valueA: amount,
    valueB: undefined,
  });
  const { address, connectWallet } = useWeb3();

  const onFormSubmit = useCallback(
    function (event?: React.FormEvent<HTMLFormElement>) {
      if (event) event.preventDefault();
      // calculate tolerance from user slippage settings
      // set tiny minimum of tolerance as the frontend calculations
      // don't always exactly align with the backend calculations
      const tolerance = Math.max(1e-12, slippage);
      const tickIndexLimit = routerResult?.tickIndexOut?.toNumber();
      if (
        address &&
        routerResult &&
        tokenA &&
        tokenB &&
        !isNaN(tolerance) &&
        tickIndexLimit &&
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
            orderType: 2,
            // todo: set tickIndex to allow for a tolerance:
            //   the below function is a tolerance of 0
            tickIndex: Long.fromNumber(tickIndexLimit * (forward ? 1 : -1)),
            maxAmountOut: getBaseDenomAmount(tokenB, result.amountOut) || '0',
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

  return (
    <form onSubmit={onFormSubmit}>
      <div className="mt-2 mb-4">
        <NumericInputRow
          prefix="Amount"
          value={amount}
          onChange={setAmount}
          suffix={tokenA?.symbol}
        />
      </div>
      <div
        className={[
          'flex row my-3 slider-input-container',
          !userTokenADisplayAmount &&
            isLoadingUserTokenADisplayAmount &&
            'disabled',
        ].join(' ')}
      >
        <aside className="slider-input__background flex row">
          <div className="slider-input__track"></div>
        </aside>
        <aside className="slider-input__background flex row">
          <div
            className="slider-input__track active"
            style={{
              width: `${(100 * sliderIndex) / (sliderValues.length - 1)}%`,
            }}
          ></div>
        </aside>
        <aside className="slider-input__background flex row">
          {sliderValues.map((_, index) => {
            return (
              <FontAwesomeIcon
                key={index}
                icon={faCircle}
                size="xs"
                className={[sliderIndex > index && 'active'].join()}
              />
            );
          })}
        </aside>
        <input
          type="range"
          disabled={
            !userTokenADisplayAmount && isLoadingUserTokenADisplayAmount
          }
          className="flex slider-input"
          value={sliderIndex}
          onChange={useCallback(
            (e: React.ChangeEvent<HTMLInputElement>) => {
              const newSliderIndex = Number(e.target.value) || 0;
              setSliderIndex(newSliderIndex);
              const newSliderValue = sliderValues[newSliderIndex];
              const newValue =
                newSliderValue < 1
                  ? // round calculated values
                    formatAmount(
                      new BigNumber(userTokenADisplayAmount || 0)
                        .multipliedBy(newSliderValue)
                        .toNumber()
                    )
                  : // or pass full value
                    userTokenADisplayAmount;
              if (newValue) {
                setAmount(newValue || '');
              }
            },
            [userTokenADisplayAmount]
          )}
          min={0}
          max={3}
        />
      </div>
      <div className="my-4">
        <NumericInputRow
          prefix="Total"
          value={formatAmount(routerResult?.amountOut?.toNumber() ?? 0)}
          suffix={tokenB?.symbol}
          readOnly
        />
      </div>
      <div className="flex row">
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
      <div className="flex row">
        <NumericValueRow
          prefix="Est. Slippage"
          tooltip="Slippage"
          value={formatPercentage(0)}
        />
      </div>
      <div className="flex row">
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
      <div className="flex row">
        <button
          className="limit-order__confirm-button flex button-primary my-lg py-4"
          onClick={!address ? connectWallet : undefined}
          disabled={isValidatingSwap}
        >
          {!address ? 'Connect Wallet' : buyMode ? 'Buy' : 'Sell'}
        </button>
      </div>
      <div className="flex row">
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
      <div className="flex row">
        <NumericValueRow
          prefix="USD Available"
          tooltip="Estimated USD equivalent"
          value={formatCurrency(0)}
          suffix={tokenB?.symbol}
        />
      </div>
      <div className="flex row">
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
