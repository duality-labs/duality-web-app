import { InputHTMLAttributes, useCallback, useMemo } from 'react';
import { faCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import './RangeInput.scss';

interface RangeSliderInputProps<T = string | number>
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'onInput' | 'onChange' | 'list' | 'value'
  > {
  // restrict value type to only strings for easier handling
  list: Array<T>;
  onInput?: (value: T) => void;
  onChange?: (value: T) => void;
  value: T;
  innerRef?: React.RefObject<HTMLInputElement>;
}

export default function RangeListSliderInput<T>({
  className,
  onInput,
  onChange = onInput,
  list,
  value,
  innerRef,
  ...inputProps
}: RangeSliderInputProps<T>) {
  const selectedIndex = useMemo(() => {
    const numericValue = Number(value);
    const maxIndex = list.length - 1 || 1;
    return (
      maxIndex -
      (list
        .slice()
        .reverse()
        .findIndex((option) => {
          const numericOptionValue = Number(option);
          return numericValue >= numericOptionValue;
        }) ?? maxIndex)
    );
  }, [list, value]);

  return (
    <div
      className={['flex row my-3 range-list-slider-input', className]
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
            width: `${(100 * selectedIndex) / (list.length - 1 || 1)}%`,
          }}
        ></div>
      </aside>
      <aside className="slider-input__background flex row">
        {list.map((option, index, options) => {
          const numericValue = Number(value);
          const numericOptionValue = Number(option);
          return (
            <FontAwesomeIcon
              key={numericOptionValue}
              icon={faCircle}
              size="xs"
              style={{ left: `${(100 * index) / (options.length - 1 || 1)}%` }}
              className={[numericValue > numericOptionValue && 'active'].join()}
            />
          );
        })}
      </aside>
      <input
        ref={innerRef}
        type="range"
        className="flex slider-input"
        value={selectedIndex}
        onChange={useCallback(
          (e: React.ChangeEvent<HTMLInputElement>) => {
            const newSelectedIndex = Number(e.target.value) || 0;
            const newSelectedValue = list[newSelectedIndex];
            onChange?.(newSelectedValue);
          },
          [list, onChange]
        )}
        min={0}
        max={list.length - 1}
        {...inputProps}
      />
    </div>
  );
}
