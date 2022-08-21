import { useCallback, useEffect, useRef, useState } from 'react';

import './StepNumberInput.scss';

type ValueType = string | number;
type Direction = 1 | -1;

interface StepNumberInputProps<VT extends ValueType> {
  onChange?: (value: VT) => void;
  value: VT;
  step?: VT;
  max?: VT;
  min?: VT;
}

export default function StepNumberInput<VT extends ValueType>({
  onChange,
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
   * Makes sure the value is valid number within the proper range
   * @param newValue the proposed new value to be checked
   */
  const validateValue = useCallback(
    (newValue: number) => {
      let tempValue = newValue;
      if (isNaN(tempValue)) {
        if (isNaN(numericValue)) {
          tempValue = min;
        } else {
          tempValue = numericValue;
        }
      }
      return Math.min(Math.max(min, tempValue), max);
    },
    [min, max, numericValue]
  );

  /**
   * Increases / Decreases the current value based on the step
   * @param direction -1 to decrease by -step and 1 to increase by +step
   */
  const onStep = useCallback(
    (direction: Direction) => {
      setCurrentValue((oldValue) => validateValue(oldValue + step * direction));
    },
    [step, validateValue]
  );

  /**
   * To be called when there is a change with the input
   */
  const onInputChange = useCallback(() => {
    if (!inputRef.current) return;
    setCurrentValue(validateValue(parseText(inputRef.current.value)));
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
