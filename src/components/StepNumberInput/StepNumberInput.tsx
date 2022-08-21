import { useCallback, useEffect, useRef, useState } from 'react';

import './StepNumberInput.scss';

type ValueType = string | number;
type Direction = 1 | -1;

interface StepNumberInputProps<VT extends ValueType> {
  onChange?: (value: VT) => void;
  revertInvalid?: boolean;
  value: VT;
  step?: VT;
  max?: VT;
  min?: VT;
}

export default function StepNumberInput<VT extends ValueType>({
  onChange,
  revertInvalid = false,
  value,
  step: rawStep,
  max: rawMax,
  min: rawMin,
}: StepNumberInputProps<VT>) {
  const step =
    typeof rawStep === 'number' ? rawStep : rawStep ? parseText(rawStep) : 1;
  const max =
    typeof rawMax === 'number' ? rawMax : rawMax ? parseText(rawMax) : Infinity;
  const min =
    typeof rawMin === 'number' ? rawMin : rawMin ? parseText(rawMin) : 0;
  if (max < min) {
    throw new Error(
      'Invalid Range, max limit cannot be smaller than the min limit'
    );
  }
  const numericValue = typeof value === 'number' ? value : parseText(value);
  const [currentValue, setCurrentValue] = useState(numericValue);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * If the min or max "push" the current value outside the valid range, readjust
   */
  useEffect(() => {
    if (min > currentValue) setCurrentValue(min);
    if (max < currentValue) setCurrentValue(max);
  }, [min, max, currentValue]);

  /**
   * Makes sure the value is valid number within the proper range
   * @param newValue the proposed new value to be checked
   */
  const validateValue = useCallback(
    (oldValue: number, newValue: number) => {
      let tempValue = newValue;
      if (isNaN(tempValue)) {
        if (revertInvalid) {
          tempValue = oldValue;
        } else if (isNaN(numericValue)) {
          tempValue = min;
        } else {
          tempValue = numericValue;
        }
      }
      if (revertInvalid) {
        if (tempValue < min) return oldValue;
        if (tempValue > max) return oldValue;
        return tempValue;
      } else {
        return Math.min(Math.max(min, tempValue), max);
      }
    },
    [min, max, revertInvalid, numericValue]
  );

  /**
   * Increases / Decreases the current value based on the step
   * @param direction -1 to decrease by -step and 1 to increase by +step
   */
  const onStep = useCallback(
    (direction: Direction) => {
      setCurrentValue((oldValue) =>
        validateValue(oldValue, oldValue + step * direction)
      );
    },
    [step, validateValue]
  );

  /**
   * To be called when there is a change with the input
   */
  const onInputChange = useCallback(() => {
    const value = inputRef.current?.value;
    if (!value) return;
    setCurrentValue((oldValue) => validateValue(oldValue, parseText(value)));
  }, [validateValue]);

  useEffect(() => {
    if (onChange) {
      if (typeof value === 'string') {
        onChange(numberToString(currentValue) as VT);
      } else {
        onChange(currentValue as VT);
      }
    }
  }, [onChange, currentValue, value]);

  return (
    <div className="range-step-input">
      <div className="range-step-controls">
        <button type="button" onClick={() => onStep(-1)}>
          -
        </button>
        <input
          type="number"
          value={currentValue}
          onInput={onInputChange}
          ref={inputRef}
        />
        <button type="button" onClick={() => onStep(1)}>
          +
        </button>
      </div>
    </div>
  );
}

function numberToString(value: number) {
  return `${value}`;
}

// TODO: improve/replace text=>number parser
function parseText(text: string) {
  return +text;
}
