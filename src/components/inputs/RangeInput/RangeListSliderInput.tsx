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
  const getPercent = useCallback(
    (value: number) => (value - min) / (max - min || 1),
    [max, min]
  );
  const snapToListValue = useCallback(
    (value: number) => {
      const sortedList = list.slice().sort((a, b) => {
        return (a - value) * (a - value) - (b - value) * (b - value);
      });
      const closestValue = sortedList.at(0);
      if (closestValue !== undefined) {
        return onChange?.(closestValue);
      }
    },
    [list, onChange]
  );

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
            width: `${100 * getPercent(value)}%`,
          }}
        ></div>
      </aside>
      <aside className="slider-input__background flex row">
        {list.map((option) => {
          const numericValue = Number(value);
          const numericOptionValue = Number(option);
          const percent = 100 * getPercent(numericOptionValue);
          return (
            <FontAwesomeIcon
              key={numericOptionValue}
              icon={faCircle}
              size="xs"
              style={{
                position: 'absolute',
                left: `${percent}%`,
                translate: `-${percent}%`,
              }}
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
            const value = Number(e.target.value) || 0;
            snapToListValue(value);
          },
          [snapToListValue]
        )}
        // round to nearest step when clicked
        onClick={useCallback(() => {
          snapToListValue(value);
        }, [snapToListValue, value])}
        min={min}
        max={max}
        step="any"
        {...inputProps}
      />
    </div>
  );
}
