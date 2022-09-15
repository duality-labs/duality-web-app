import BigNumber from 'bignumber.js';
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

  const currentValue = parse(value);
  if (min !== undefined && max !== undefined && max < min) {
    throw new Error(
      'Invalid Range, max limit cannot be smaller than the min limit'
    );
  }
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Makes sure the value is valid number within the proper range
   * @param newValue the proposed new value to be checked
   */
  const maybeUpdate = useCallback(
    (newValueString: string) => {
      if (onChange) {
        const newValue = new BigNumber(newValueString);
        if (min !== undefined && newValue.isLessThan(min)) {
          return onChange(new BigNumber(min).toFixed());
        }
        if (max !== undefined && newValue.isGreaterThan(max)) {
          return onChange(new BigNumber(max).toFixed());
        }
        if (!newValue.isNaN()) {
          return onChange(newValueString);
        }
      }
    },
    [min, max, onChange]
  );

  /**
   * Increases / Decreases the current value based on the step
   * @param direction -1 to decrease by -step and 1 to increase by +step
   */
  const onStep = useCallback(
    (direction: Direction) => {
      if (maybeUpdate) {
        const newValue = new BigNumber(
          stepFunction?.(currentValue, direction) ??
            currentValue + step * direction
        );
        // restrict to certain significant digits
        const newValueString =
          newValue.dp() >= 6
            ? newValue.toFixed(
                Math.max(0, newValue.dp() - newValue.sd(true) + 6),
                direction > 0 ? BigNumber.ROUND_UP : BigNumber.ROUND_DOWN
              )
            : newValue.toFixed();

        maybeUpdate(newValueString);
      }
    },
    [step, stepFunction, maybeUpdate, currentValue]
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

  const [subDisabled, setSubDisabled] = useState(() => false);
  useEffect(() => {
    const disabled = disableLimit && min !== undefined && currentValue <= min;
    if (disabled) stopAutoSub();
    setSubDisabled(disabled);
  }, [disableLimit, currentValue, min, stopAutoSub]);

  const [addDisabled, setAddDisabled] = useState(() => false);
  useEffect(() => {
    const disabled = disableLimit && max !== undefined && currentValue >= max;
    if (disabled) stopAutoAdd();
    setAddDisabled(disabled);
  }, [disableLimit, currentValue, max, stopAutoAdd]);

  /**
   * To be called when there is a change with the input
   */
  const onInputChange = useCallback(() => {
    const value = inputRef.current?.value;
    maybeUpdate?.(value || '0');
  }, [maybeUpdate]);

  useEffect(() => {
    function handleArrowKeyStep(event: KeyboardEvent) {
      // catch arrow presses
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          onAddStep();
          break;
        case 'ArrowDown': {
          event.preventDefault();
          onSubStep();
          break;
        }
      }
    }
    const input = inputRef.current;
    if (input) {
      input.addEventListener('keydown', handleArrowKeyStep);
      return () => input.removeEventListener('keydown', handleArrowKeyStep);
    }
  }, [onSubStep, onAddStep]);

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
          disabled={disabled || subDisabled}
          tabIndex={tabbableButtons ? 0 : -1}
        >
          -
        </button>
        {editable || disabled ? (
          <input
            type="number"
            value={value}
            onInput={onInputChange}
            ref={inputRef}
          />
        ) : (
          <span>{value}</span>
        )}
        <button
          type="button"
          onClick={onAddStep}
          onMouseDown={startAutoAdd}
          onMouseUp={stopAutoAdd}
          onMouseLeave={stopAutoAdd}
          disabled={disabled || addDisabled}
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
