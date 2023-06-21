import React, { useCallback, useMemo } from 'react';
import BigNumber from 'bignumber.js';

import TokenPicker from '../TokenPicker';
import { Token } from '../../lib/web3/utils/tokens';

import NumberInput from '../inputs/NumberInput';
import { useBankBigBalance } from '../../lib/web3/indexerProvider';
import { useSimplePrice } from '../../lib/tokenPrices';
import {
  formatAmount,
  formatCurrency,
  formatLongPrice,
} from '../../lib/utils/number';

import './TokenInputGroup.scss';

const { REACT_APP__MAX_FRACTION_DIGITS = '' } = process.env;
const maxFractionDigits = parseInt(REACT_APP__MAX_FRACTION_DIGITS) || 20;

const maxSignificantDigits = 20;
const placeholder = '0';

interface InputGroupProps {
  variant?: 'primary' | 'success' | 'error' | false;
  onTokenChanged?: (token?: Token) => void;
  onValueChanged?: (value: string) => void;
  tokenList: Array<Token>;
  className?: string;
  exclusion?: Token;
  value?: string;
  token?: Token;
  /** disables both the input and the token (gets overwritten by the other 2) */
  disabled?: boolean;
  disabledInput?: boolean;
  disabledToken?: boolean;
  maxValue?: number;
}

function selectAll(e: React.MouseEvent<HTMLInputElement>) {
  e.currentTarget.select();
}

export default function TokenInputGroup({
  variant,
  onTokenChanged,
  onValueChanged,
  tokenList,
  className,
  exclusion,
  value,
  token,
  disabled = false,
  disabledInput = disabled,
  disabledToken = disabled,
  maxValue: givenMaxValue,
}: InputGroupProps) {
  const onPickerChange = useCallback(
    function (newToken: Token | undefined) {
      if (newToken === exclusion) return;
      if (typeof onTokenChanged === 'function') onTokenChanged(newToken);
    },
    [onTokenChanged, exclusion]
  );

  const { data: price } = useSimplePrice(token);
  // render a valid currency value as the secondary value (or nothing at all)
  const secondaryValue = useMemo(() => {
    if (price !== undefined && value !== undefined && value !== '') {
      const currencyValue = new BigNumber(value).multipliedBy(price);
      if (!currencyValue.isNaN()) {
        return formatCurrency(currencyValue.toFixed(2));
      }
    }
    return '';
  }, [value, price]);

  const { data: balance } = useBankBigBalance(token);
  const maxValue = givenMaxValue || balance;
  return (
    <div
      className={[
        className,
        'token-input-group',
        variant && `token-input-group--${variant}`,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {maxValue && (
        <h5 className="token-group-title">
          Available{' '}
          {formatAmount(maxValue, {
            maximumSignificantDigits: 9,
            useGrouping: true,
          })}
        </h5>
      )}
      {!disabledInput && maxValue && Number(maxValue) > 0 && (
        <span className="token-group-balance">
          <button
            type="button"
            className="badge badge-light"
            onClick={() =>
              onValueChanged?.(
                // allow max value be as long as it needs to be to perfectly fit user's balance
                new BigNumber(maxValue)
                  .toFixed(maxFractionDigits, BigNumber.ROUND_DOWN)
                  // replace trailing zeros
                  .replace(/\.([0-9]*[1-9])?0+$/, '.$1')
                  // remove trailing decimal point
                  .replace(/\.$/, '')
              )
            }
          >
            MAX
          </button>
          <button
            type="button"
            className="badge badge-light"
            onClick={() =>
              // allow rounding on half of balance because we don't need an exact target
              onValueChanged?.(formatLongPrice(Number(maxValue) / 2))
            }
          >
            HALF
          </button>
        </span>
      )}
      <TokenPicker
        className="gutter-l-3"
        value={token}
        onChange={onPickerChange}
        tokenList={tokenList}
        exclusion={exclusion}
        disabled={disabledToken}
      />
      <NumberInput
        type="text"
        className={['token-group-input', !Number(value) && 'input--zero']
          .filter(Boolean)
          .join(' ')}
        value={value}
        placeholder={placeholder}
        onChange={onValueChanged}
        onClick={selectAll}
        disabled={disabledInput}
        style={useMemo(() => {
          return {
            // set width of input based on current values but restrained to max characters
            minWidth: '100%',
            maxWidth: `${
              maxSignificantDigits + (value?.includes('.') ? 1 : 0)
            }ch`,
            width: `${(value || placeholder).length}ch`,
          };
        }, [value])}
      />
      <span className="token-group-value">{secondaryValue}</span>
    </div>
  );
}
