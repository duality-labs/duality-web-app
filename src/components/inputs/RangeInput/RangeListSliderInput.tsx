import { InputHTMLAttributes, useCallback } from 'react';
import { faCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import './RangeInput.scss';

interface RangeSliderInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'onInput' | 'onChange' | 'list' | 'value'
  > {
  // restrict value type to only strings for easier handling
  list: Array<number>;
  onInput?: (value: number) => void;
  onChange?: (value: number) => void;
  value: number;
  innerRef?: React.RefObject<HTMLInputElement>;
}

export default function RangeListSliderInput({
  className,
  onInput,
  onChange = onInput,
  list,
  value,
  innerRef,
  disabled,
  ...inputProps
}: RangeSliderInputProps) {
  // get min and max values from list
  const min = list.at(0) || 0;
  const max = list.at(-1) || 0;

  return (
    <div
      className={[
        'flex row my-3 range-list-slider-input',
        className,
        disabled && 'disabled',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <aside className="slider-input__background flex row">
        <div className="slider-input__track"></div>
      </aside>
      <aside className="slider-input__background flex row">
        <div
          className="slider-input__track active"
          style={{
            width: `${(100 * (value - min)) / (max - min || 1)}%`,
          }}
        ></div>
      </aside>
      <aside className="slider-input__background flex row">
        {list.map((option) => {
          const numericValue = Number(value);
          const numericOptionValue = Number(option);
          return (
            <FontAwesomeIcon
              key={numericOptionValue}
              icon={faCircle}
              size="xs"
              className={[numericValue > numericOptionValue && 'active'].join()}
            />
          );
        })}
      </aside>
      <input
        ref={innerRef}
        type="range"
        className="flex slider-input"
        disabled={disabled}
        value={value}
        onChange={useCallback(
          (e: React.ChangeEvent<HTMLInputElement>) => {
            onChange?.(Number(e.target.value) || 0);
          },
          [onChange]
        )}
        min={min}
        max={max}
        step={(Number(max) - Number(min)) / (list.length - 1)}
        {...inputProps}
      />
    </div>
  );
}
