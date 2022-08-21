import { useCallback, useEffect, useRef, useState } from 'react';

type Direction = 1 | -1;

interface StepNumberInputProps {
  onChange?: (value: number) => void;
  value: number;
  step?: number;
  max?: number;
  min?: number;
}

export default function StepNumberInput({
  onChange,
  value = 0,
  step = 1,
  max = Number.MAX_SAFE_INTEGER,
  min = 0,
}: StepNumberInputProps) {
  if (max < min) {
    throw new Error(
      'Invalid Range, max limit cannot be smaller than the min limit'
    );
  }

  const [currentValue, setCurrentValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Makes sure the value is valid number within the proper range
   * @param newValue the proposed new value to be checked
   */
  const validateValue = useCallback(
    (newValue: number) => {
      const numberValue = isNaN(newValue)
        ? isNaN(value)
          ? min
          : value
        : newValue;
      return Math.min(Math.max(min, numberValue), max);
    },
    [min, max, value]
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
    if (onChange) onChange(currentValue);
  }, [onChange, currentValue]);

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

// TODO: improve/replace text=>number parser
function parseText(text: string) {
  return +text;
}
