import { InputHTMLAttributes, useCallback, useMemo } from 'react';
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
  const step = useMemo(
    () => (Number(max) - Number(min)) / (list.length - 1 || 1),
    [list.length, max, min]
  );
  const getPercent = useCallback(
    (value: number) => (value - min) / (max - min || 1),
    [max, min]
  );
  const snapToStep = useCallback(
    (value: number) => {
      const percent = getPercent(value);
      const roundedListIndex = Math.round(percent * (list.length - 1 || 1));
      return onChange?.(min + roundedListIndex * step);
    },
    [getPercent, list.length, min, onChange, step]
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
            const value = Number(e.target.value) || 0;
            snapToStep(value);
          },
          [snapToStep]
        )}
        // round to nearest step when clicked
        onClick={useCallback(() => {
          snapToStep(value);
        }, [snapToStep, value])}
        min={min}
        max={max}
        step="any"
        {...inputProps}
      />
    </div>
  );
}
