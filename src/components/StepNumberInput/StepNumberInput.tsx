import { useCallback, useEffect, useRef, useState } from 'react';

import './StepNumberInput.scss';

type ValueType = string | number;
type Direction = 1 | -1;

interface StepNumberInputProps<VT extends ValueType> {
  onChange?: (value: VT) => void;
  tabbableButtons?: boolean;
  pressedInterval?: number;
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
  const [, setTimeoutID] = useState<number>();
  const [, setIntervalID] = useState<number>();
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
      return min <= newValue && newValue <= max ? newValue : oldValue;
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
        return validateValue(oldValue, oldValue + step * direction);
      });
    },
    [step, validateValue]
  );
  const onSubStep = useCallback(() => onStep(-1), [onStep]);
  const onAddStep = useCallback(() => onStep(+1), [onStep]);

  /**
   * To be called when the mouse gets released, to start the hold to step faster functionality
   * @param direction -1 to start decreasing by -step every pressedInterval and 1 to start increasing by +step every pressedInterval
   */
  const onPressed = useCallback(
    (direction: Direction) => {
      setTimeoutID((oldID) => {
        if (pressedDelay === Infinity) return oldID;
        clearTimeout(oldID);
        return setTimeout(startCounting as TimerHandler, pressedDelay);
      });

      function startCounting() {
        setIntervalID((oldID) => {
          clearInterval(oldID);
          return setInterval(onTick as TimerHandler, pressedInterval);
        });
      }

      function onTick() {
        onStep(direction);
      }
    },
    [pressedDelay, pressedInterval, onStep]
  );
  const onSubPressed = useCallback(() => onPressed(-1), [onPressed]);
  const onAddPressed = useCallback(() => onPressed(+1), [onPressed]);

  /**
   * To be called when the mouse gets released, so that all hold to step faster functionality ceases
   */
  const onReleased = useCallback(() => {
    setTimeoutID((oldID) => {
      clearTimeout(oldID);
      return undefined;
    });
    setIntervalID((oldID) => {
      clearInterval(oldID);
      return undefined;
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
          onClick={onSubStep}
          onMouseDown={onSubPressed}
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
          onClick={onAddStep}
          onMouseDown={onAddPressed}
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
