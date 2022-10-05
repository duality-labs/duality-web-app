import React, { useCallback } from 'react';
import BigNumber from 'bignumber.js';

import TokenPicker from '../TokenPicker';

import { Token } from '../TokenPicker/hooks';

import { useBankBalance } from '../../lib/web3/indexerProvider';
import { useSimplePrice } from '../../lib/tokenPrices';
import { cleanInput } from './utils';

import './TokenInputGroup.scss';

const minSignificantDigits = 12;
const maxSignificantDigits = 20;
const placeholder = '...';

interface InputGroupProps {
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
  title?: string;
  maxValue?: number;
  relevantValue?: string;
}

function selectAll(e: React.MouseEvent<HTMLInputElement>) {
  e.currentTarget.select();
}

export default function TokenInputGroup({
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
  title,
  maxValue,
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
      ? `$${new BigNumber(value).multipliedBy(price).toFixed(2)}`
      : undefined);

  const { data: balance } = useBankBalance(token);
  return (
    <div className={`${className || ''} token-input-group`}>
      {title && <h5 className="token-group-title">{title}</h5>}
      {!disabledInput && balance && Number(balance) > 0 && (
        <span className="token-group-balance">
          <button type="button" onClick={() => onValueChanged?.(balance)}>
            MAX
          </button>
          <button
            type="button"
            onClick={() =>
              onValueChanged?.(new BigNumber(balance).dividedBy(2).toFixed())
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
