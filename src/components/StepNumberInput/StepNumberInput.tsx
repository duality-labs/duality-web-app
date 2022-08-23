import { useCallback, useEffect, useRef, useState } from 'react';

import './StepNumberInput.scss';

type ValueType = string | number;
type Direction = 1 | -1;

interface StepNumberInputProps<VT extends ValueType> {
  calculateStep?: (
    value: VT,
    direction: Direction,
    step: VT,
    defaultValue: VT
  ) => VT;
  onChange?: (value: VT) => void;
  tabbableButtons?: boolean;
  pressedInterval?: number;
  revertInvalid?: boolean;
  disableLimit?: boolean;
  pressedDelay?: number;
  description?: string;
  disabled?: boolean;
  editable?: boolean;
  title?: string;
  value: VT;
  step?: VT;
  max?: VT;
  min?: VT;
}

export default function StepNumberInput<VT extends ValueType>({
  calculateStep,
  onChange,
  tabbableButtons = false,
  pressedInterval = 50,
  revertInvalid = false,
  disableLimit = true,
  pressedDelay = Infinity,
  description,
  disabled = false,
  editable = true,
  title,
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
  const [, setPressedTimeID] = useState<number>();
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
      setCurrentValue((oldValue) => {
        let tempValue = oldValue + step * direction;
        if (calculateStep) {
          const mixedValue = calculateStep(
            fixType(oldValue, value),
            direction,
            fixType(step, value),
            fixType(tempValue, value)
          );
          tempValue =
            typeof mixedValue === 'string' ? parseText(mixedValue) : mixedValue;
        }
        return validateValue(oldValue, tempValue);
      });
    },
    [step, calculateStep, validateValue, value]
  );

  /**
   * To be called when the mouse gets released, to start the hold to step faster functionality
   * @param direction -1 to start decreasing by -step every pressedInterval and 1 to start increasing by +step every pressedInterval
   */
  const onPressed = useCallback(
    (direction: Direction) => {
      let lastID = 0; // fix react calling setPressedID twice
      setPressedTimeID((oldID) => {
        if (pressedDelay === Infinity) return lastID;
        if (lastID) return lastID;
        clearInterval(oldID);
        clearTimeout(oldID);

        lastID = setTimeout(startCounting as TimerHandler, pressedDelay);
        return lastID;
      });

      function startCounting() {
        setPressedTimeID((oldID) => {
          clearInterval(oldID);
          clearTimeout(oldID);

          return setInterval(onTick as TimerHandler, pressedInterval);
        });
      }

      function onTick() {
        onStep(direction);
      }
    },
    [pressedDelay, pressedInterval, onStep]
  );

  /**
   * To be called when the mouse gets released, so that all hold to step faster functionality ceases
   */
  const onReleased = useCallback(() => {
    setPressedTimeID((oldID) => {
      clearInterval(oldID);
      clearTimeout(oldID);
      return void 0;
    });
  }, []);

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
      onChange(fixType(currentValue, value));
    }
  }, [onChange, currentValue, value]);

  return (
    <div className="range-step-input">
      {title && <h6 className="range-step-title">{title}</h6>}
      <div className="range-step-controls">
        <button
          type="button"
          onClick={() => onStep(-1)}
          onMouseDown={() => onPressed(-1)}
          onMouseUp={onReleased}
          onMouseLeave={onReleased}
          disabled={disabled || (disableLimit && currentValue <= min)}
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
          onClick={() => onStep(1)}
          onMouseDown={() => onPressed(1)}
          onMouseUp={onReleased}
          onMouseLeave={onReleased}
          disabled={disabled || (disableLimit && currentValue >= max)}
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

function numberToString(value: number) {
  return `${value}`;
}

// TODO: improve/replace text=>number parser
function parseText(text: string) {
  return +text;
}

function fixType<VT extends ValueType>(value: number, valueType: VT) {
  if (typeof valueType === 'string') {
    return numberToString(value) as VT;
  } else {
    return value as VT;
  }
}
