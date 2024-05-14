import React, { ReactNode, useCallback, useMemo, useRef } from 'react';
import BigNumber from 'bignumber.js';

import TokenPicker from '../TokenPicker';
import { TokenPickerAssetMode } from '../TokenPicker/TokenPicker';
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
  denoms?: Array<string>;
  className?: string;
  exclusion?: Token;
  value?: string;
  token?: Token;
  denom?: string;
  defaultAssetMode?: TokenPickerAssetMode;
  /** disables both the input and the token (gets overwritten by the other 2) */
  disabled?: boolean;
  disabledInput?: boolean;
  disabledToken?: boolean;
  header?: ReactNode;
  maxValue?: number;
}

function selectAll(e: React.MouseEvent<HTMLInputElement>) {
  e.currentTarget.select();
}

export default function TokenInputGroup({
  variant,
  onTokenChanged,
  onValueChanged,
  className,
  exclusion,
  value,
  token,
  denom = token?.base,
  defaultAssetMode,
  header,
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

  const { data: balance } = useBankBalanceDisplayAmount(denom);
  const maxValue = givenMaxValue ?? balance;
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      className={[
        className,
        'token-input-group',
        variant && `token-input-group--${variant}`,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => inputRef.current?.focus()}
      onKeyDown={() => inputRef.current?.focus()}
      role="button"
      tabIndex={0}
    >
      <div className="row gap-3">
        <div className="col flex my-1">
          <h5 className="token-group-title">
            {header ||
              (maxValue &&
                `Available ${formatAmount(maxValue, {
                  useGrouping: true,
                })}`) || <>&nbsp;</>}
          </h5>
        </div>
        {!disabledInput && token && !!maxValue && Number(maxValue) > 0 && (
          <div className="col token-group-balance gap-3">
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
          </div>
        )}
      </div>
      <div className="row">
        <div className="col flex">
          <TokenPicker
            className="gutter-l-3"
            value={token}
            onChange={onTokenChanged ? onPickerChange : undefined}
            exclusion={exclusion}
            disabled={disabledToken}
            defaultAssetMode={defaultAssetMode}
          />
        </div>
        <div className="col flex mt-sm">
          <NumberInput
            type="text"
            innerRef={inputRef}
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
      </div>
    </div>
  );
}
