import React, { useCallback, useMemo } from 'react';
import BigNumber from 'bignumber.js';

import TokenPicker from '../TokenPicker';
import { Token, roundToBaseUnit } from '../../lib/web3/utils/tokens';

import NumberInput from '../inputs/NumberInput';
import { useBankBalanceDisplayAmount } from '../../lib/web3/hooks/useUserBankBalances';
import { useSimplePrice } from '../../lib/tokenPrices';
import { formatAmount, formatCurrency } from '../../lib/utils/number';

import './TokenInputGroup.scss';

const placeholder = '0';

interface InputGroupProps {
  variant?: 'success' | 'error' | false;
  onTokenChanged?: (token?: Token) => void;
  onValueChanged?: (value: string) => void;
  tokenList?: Array<Token>;
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

  const { data: balance } = useBankBalanceDisplayAmount(token);
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
      {!disabledInput && token && maxValue && Number(maxValue) > 0 && (
        <span className="token-group-balance">
          <button
            type="button"
            className="badge badge-light"
            onClick={() =>
              onValueChanged?.(
                // allow max value be as long as it needs to be to perfectly fit user's balance
                roundToBaseUnit(token, maxValue) || ''
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
              onValueChanged?.(
                roundToBaseUnit(token, Number(maxValue) / 2) || ''
              )
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
            // set width as minimum amount available
            minWidth: '100%',
            width: 0,
          };
        }, [])}
      />
      <span className="token-group-value">{secondaryValue}</span>
    </div>
  );
}
