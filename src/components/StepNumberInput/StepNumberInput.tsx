import { useCallback, useEffect, useRef, useState } from 'react';
import useOnContinualPress from '../hooks/useOnContinualPress';

import './StepNumberInput.scss';

type Direction = 1 | -1;

interface StepNumberInputProps {
  onChange?: (value: string) => void;
  tabbableButtons?: boolean;
  pressedInterval?: number;
  disableLimit?: boolean;
  pressedDelay?: number;
  description?: string;
  disabled?: boolean;
  editable?: boolean;
  title?: string;
  value: string;
  stepFunction?: (value: number, direction: number) => number;
  step?: string | number;
  max?: string | number;
  min?: string | number;
  parse?: (value: string) => number;
  format?: (value: number) => string;
}

export default function StepNumberInput({
  onChange,
  tabbableButtons = false,
  pressedInterval = 50,
  disableLimit = true,
  pressedDelay = Infinity,
  description,
  disabled = false,
  editable = true,
  title,
  value,
  stepFunction,
  step: rawStep,
  max: rawMax,
  min: rawMin = 0,
  parse = Number,
  format = String,
}: StepNumberInputProps) {
  const step =
    typeof rawStep === 'number' ? rawStep : rawStep ? parse(rawStep) : 1;
  const max =
    typeof rawMax === 'number' ? rawMax : rawMax ? parse(rawMax) : undefined;
  const min =
    typeof rawMin === 'number' ? rawMin : rawMin ? parse(rawMin) : undefined;

  if (min !== undefined && max !== undefined && max < min) {
    throw new Error(
      'Invalid Range, max limit cannot be smaller than the min limit'
    );
  }
  const [currentValue, setCurrentValue] = useState(() => parse(value));
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Update current value when unparsed value has changed
   */
  useEffect(() => {
    setCurrentValue(parse(value));
  }, [value, parse]);

  /**
   * Makes sure the value is valid number within the proper range
   * @param newValue the proposed new value to be checked
   */
  const validateValue = useCallback(
    (oldValue: number, newValue: number) => {
      if (min && newValue < min) {
        return min;
      }
      if (max && newValue > max) {
        return max;
      }
      if (newValue !== undefined && !isNaN(newValue)) {
        return newValue;
      } else {
        return oldValue;
      }
    },
    [min, max]
  );

  /**
   * Increases / Decreases the current value based on the step
   * @param direction -1 to decrease by -step and 1 to increase by +step
   */
  const onStep = useCallback(
    (direction: Direction) => {
      setCurrentValue((oldValue) => {
        return validateValue(
          oldValue,
          stepFunction?.(oldValue, direction) ?? oldValue + step * direction
        );
      });
    },
    [step, stepFunction, validateValue]
  );
  const onSubStep = useCallback(() => onStep(-1), [onStep]);
  const onAddStep = useCallback(() => onStep(+1), [onStep]);

  const [startAutoSub, stopAutoSub] = useOnContinualPress(
    onSubStep,
    pressedDelay,
    pressedInterval
  );
  const [startAutoAdd, stopAutoAdd] = useOnContinualPress(
    onAddStep,
    pressedDelay,
    pressedInterval
  );

  /**
   * To be called when there is a change with the input
   */
  const onInputChange = useCallback(() => {
    const value = inputRef.current?.value;
    setCurrentValue((oldValue) => validateValue(oldValue, parse(value || '0')));
  }, [validateValue, parse]);

  useEffect(() => {
    if (onChange) {
      onChange(format(currentValue));
    }
  }, [onChange, currentValue, format]);

  return (
    <div className="range-step-input">
      {title && <h6 className="range-step-title">{title}</h6>}
      <div className="range-step-controls">
        <button
          type="button"
          onClick={onSubStep}
          onMouseDown={startAutoSub}
          onMouseUp={stopAutoSub}
          onMouseLeave={stopAutoSub}
          disabled={
            disabled ||
            (disableLimit && min !== undefined && currentValue <= min)
          }
          tabIndex={tabbableButtons ? 0 : -1}
        >
          -
        </button>
        {editable || disabled ? (
          <input
            type="number"
            value={currentValue}
            onInput={onInputChange}
            ref={inputRef}
          />
        ) : (
          <span>{currentValue}</span>
        )}
        <button
          type="button"
          onClick={onAddStep}
          onMouseDown={startAutoAdd}
          onMouseUp={stopAutoAdd}
          onMouseLeave={stopAutoAdd}
          disabled={
            disabled ||
            (disableLimit && max !== undefined && currentValue >= max)
          }
          tabIndex={tabbableButtons ? 0 : -1}
        >
          +
        </button>
      </div>
      {description && (
        <span className="range-step-description">{description}</span>
      )}
    </div>
  );
}
