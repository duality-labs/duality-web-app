import { useCallback, useEffect, useRef, useState } from 'react';

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
  const numericValue = typeof value === 'number' ? value : parse(value);
  const [currentValue, setCurrentValue] = useState(numericValue);
  const [, setTimeoutID] = useState<number>();
  const [, setIntervalID] = useState<number>();
  const clear = useCallback(() => {
    setTimeoutID((oldID) => {
      clearTimeout(oldID);
      return undefined;
    });
    setIntervalID((oldID) => {
      clearInterval(oldID);
      return undefined;
    });
  }, []);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * If the min or max "push" the current value outside the valid range, readjust
   */
  useEffect(() => {
    if (min !== undefined && min > currentValue) setCurrentValue(min);
    if (max !== undefined && max < currentValue) setCurrentValue(max);
  }, [min, max, currentValue]);

  /**
   * Makes sure the value is valid number within the proper range
   * @param newValue the proposed new value to be checked
   */
  const validateValue = useCallback(
    (oldValue: number, newValue: number) => {
      if (min && newValue < min) {
        clear();
        return min;
      }
      if (max && newValue > max) {
        clear();
        return max;
      }
      if (newValue !== undefined && !isNaN(newValue)) {
        return newValue;
      } else {
        clear();
        return oldValue;
      }
    },
    [min, max, clear]
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
  const onReleased = clear;

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
          onMouseDown={onSubPressed}
          onMouseUp={onReleased}
          onMouseLeave={onReleased}
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
          onMouseDown={onAddPressed}
          onMouseUp={onReleased}
          onMouseLeave={onReleased}
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
