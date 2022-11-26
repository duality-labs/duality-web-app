import React, { useCallback } from 'react';
import BigNumber from 'bignumber.js';

import TokenPicker from '../TokenPicker';

import { Token } from '../TokenPicker/hooks';

import { useBankBalance } from '../../lib/web3/indexerProvider';
import { useSimplePrice } from '../../lib/tokenPrices';
import { cleanInput } from './utils';
import {
  formatAmount,
  formatCurrency,
  formatLongPrice,
} from '../../lib/utils/number';

import './TokenInputGroup.scss';

const { REACT_APP__MAX_FRACTION_DIGITS = '' } = process.env;
const maxFractionDigits = parseInt(REACT_APP__MAX_FRACTION_DIGITS) || 20;

const minSignificantDigits = 12;
const maxSignificantDigits = 20;
const placeholder = '...';

interface InputGroupProps {
  variant?: 'success' | 'error' | false;
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
  relevantValue?: string;
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
  relevantValue,
}: InputGroupProps) {
  const onInputChange = useCallback(
    function (event: React.ChangeEvent<HTMLInputElement>) {
      if (typeof onValueChanged === 'function')
        onValueChanged(event.currentTarget.value);
    },
    [onValueChanged]
  );

  const onPickerChange = useCallback(
    function (newToken: Token | undefined) {
      if (newToken === exclusion) return;
      if (typeof onTokenChanged === 'function') onTokenChanged(newToken);
    },
    [onTokenChanged, exclusion]
  );

  const { data: price } = useSimplePrice(token);
  const secondaryValue =
    relevantValue ||
    (price !== undefined && value !== undefined
      ? `${formatCurrency(new BigNumber(value).multipliedBy(price).toFixed(2))}`
      : undefined);

  const { data: balance } = useBankBalance(token);
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
          Available {formatAmount(maxValue, { maximumSignificantDigits: 9 })}
        </h5>
      )}
      {!disabledInput && maxValue && Number(maxValue) > 0 && (
        <span className="token-group-balance">
          <button
            type="button"
            onClick={() =>
              onValueChanged?.(
                // allow max value be as long as it needs to be to perfectly fit user's balance
                new BigNumber(maxValue).toFixed(
                  maxFractionDigits,
                  BigNumber.ROUND_DOWN
                )
              )
            }
          >
            MAX
          </button>
          <button
            type="button"
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
        value={token}
        onChange={onPickerChange}
        tokenList={tokenList}
        exclusion={exclusion}
        disabled={disabledToken}
      />
      <input
        type="text"
        className={[
          'token-group-input',
          'ml-auto',
          !Number(value) && 'input--zero',
        ]
          .filter(Boolean)
          .join(' ')}
        value={value || placeholder}
        onInput={onInput}
        onChange={onInputChange}
        onClick={selectAll}
        disabled={disabledInput}
        style={
          value
            ? {
                // set width of input based on current values but restrained to a min/max
                minWidth: `${
                  minSignificantDigits + (value.includes('.') ? 1 : 0)
                }ch`,
                maxWidth: `${
                  maxSignificantDigits + (value.includes('.') ? 1 : 0)
                }ch`,
                width: `${value?.length}ch`,
              }
            : { width: `${placeholder.length}ch` }
        }
      />
      <span className="token-group-value">{secondaryValue}</span>
    </div>
  );
}

/**
 * Clear invalid characters from the input
 * @param event change event
 */
function onInput(event: React.UIEvent<HTMLInputElement>) {
  cleanInput(event.currentTarget);
}
