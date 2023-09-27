import { useCallback, useMemo, useRef, useState } from 'react';

import TabsCard from './TabsCard';
import Tabs from '../Tabs';

import { Token, getDisplayDenomAmount } from '../../lib/web3/utils/tokens';
import { dualityMainToken } from '../../lib/web3/hooks/useTokens';
import {
  formatCurrency,
  formatMaximumSignificantDecimals,
  formatPercentage,
  formatPrice,
} from '../../lib/utils/number';

import './LimitOrderCard.scss';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle } from '@fortawesome/free-solid-svg-icons';
import Tooltip from '../Tooltip';

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

const sliderValues = [0.1, 0.25, 0.5, 1];
const sliderPositions = [0, 1 / 3, 2 / 3, 1];

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

  const [amount, setAmount] = useState('0');
  const [total, setTotal] = useState('0');
  const [sliderIndex, setSliderIndex] = useState<number>(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const sliderValue = sliderValues[sliderIndex] || 0;

  const [fee] = useState('0');

  return (
    <div>
      <div className="mt-2 mb-4">
        <NumericInputRow
          prefix="Amount"
          value={amount}
          onChange={setAmount}
          suffix={tokenA?.symbol}
        />
      </div>
      <div className="flex row my-3 slider-input-container">
        <aside className="slider-input__background flex row">
          <div className="slider-input__track"></div>
        </aside>
        <aside className="slider-input__background flex row">
          <div
            className="slider-input__track active"
            style={{ width: `${100 * sliderPositions[sliderIndex]}%` }}
          ></div>
        </aside>
        <aside className="slider-input__background flex row">
          <FontAwesomeIcon
            icon={faCircle}
            size="xs"
            style={{ left: `${100 * sliderPositions[0]}%` }}
            className={[sliderIndex > 0 && 'active'].join()}
          />
          <FontAwesomeIcon
            icon={faCircle}
            size="xs"
            style={{ left: `${100 * sliderPositions[1]}%` }}
            className={[sliderIndex > 1 && 'active'].join()}
          />
          <FontAwesomeIcon
            icon={faCircle}
            size="xs"
            style={{ left: `${100 * sliderPositions[2]}%` }}
            className={[sliderIndex > 2 && 'active'].join()}
          />
          <FontAwesomeIcon
            icon={faCircle}
            size="xs"
            style={{ left: `${100 * sliderPositions[3]}%` }}
            className={[sliderIndex > 3 && 'active'].join()}
          />
        </aside>
        <input
          type="range"
          className="flex slider-input"
          value={sliderIndex}
          onChange={useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
            setSliderIndex(Number(e.target.value) || 0);
          }, [])}
          min={0}
          max={3}
        />
      </div>
      <div className="my-4">
        <NumericInputRow
          prefix="Total"
          value={total}
          onChange={setTotal}
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
        <button className="limit-order__confirm-button flex button-primary my-lg py-4">
          {buyMode ? 'Buy' : 'Sell'}
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
    </div>
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
