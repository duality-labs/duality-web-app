import BigNumber from 'bignumber.js';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import useOnContinualPress from '../hooks/useOnContinualPress';

import './StepNumberInput.scss';

type Direction = 1 | -1;

interface StepNumberInputProps<T extends number | string = string> {
  onChange?: (value: T) => void;
  tabbableButtons?: boolean;
  pressedInterval?: number;
  disableLimit?: boolean;
  pressedDelay?: number;
  description?: string;
  disabled?: boolean;
  editable?: boolean;
  title?: string;
  value: T;
  stepFunction?: (value: T, direction: number) => number;
  step?: string | number;
  max?: string | number;
  min?: string | number;
  parse?: (value: string) => T;
  format?: (value: T) => string;
}

export default function StepNumberInput<T extends number | string = string>({
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
  step: rawStep = 1,
  max: rawMax,
  min: rawMin,
  parse,
  format = String,
}: StepNumberInputProps<T>) {
  const step = Number(rawStep);
  const max = Number(rawMax);
  const min = Number(rawMin);

  const currentValue = format ? format(value) : `${value}`;
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
        // note: allow unsafe parsing to deal with parsing to type T
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        const safeParse = (parse || (String as any)) as (v: string) => T;
        const onChangeSafe = (value: string) => onChange(safeParse(value));
        if (min !== undefined && newValue.isLessThan(min)) {
          return onChangeSafe(new BigNumber(min).toFixed());
        }
        if (max !== undefined && newValue.isGreaterThan(max)) {
          return onChangeSafe(new BigNumber(max).toFixed());
        }
        if (!newValue.isNaN()) {
          return onChangeSafe(newValueString);
        }
      }
    },
    [min, max, onChange, parse]
  );

  /**
   * Increases / Decreases the current value based on the step
   * @param direction -1 to decrease by -step and 1 to increase by +step
   */
  const onStep = useCallback(
    (direction: Direction) => {
      if (maybeUpdate) {
        const newValue = stepFunction
          ? new BigNumber(stepFunction(value, direction))
          : new BigNumber(value).plus(step * direction);
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
    [step, stepFunction, maybeUpdate, value]
  );
  const onSubStep = useCallback(() => onStep(-1), [onStep]);
  const onAddStep = useCallback(() => onStep(+1), [onStep]);

  const subDisabled = useMemo(() => {
    return (
      disableLimit &&
      min !== undefined &&
      new BigNumber(value).isLessThanOrEqualTo(min)
    );
  }, [disableLimit, value, min]);

  const addDisabled = useMemo(() => {
    return (
      disableLimit &&
      max !== undefined &&
      new BigNumber(value).isGreaterThanOrEqualTo(max)
    );
  }, [disableLimit, value, max]);

  const [startAutoSub, stopAutoSub] = useOnContinualPress(
    onSubStep,
    subDisabled,
    pressedDelay,
    pressedInterval
  );
  const [startAutoAdd, stopAutoAdd] = useOnContinualPress(
    onAddStep,
    addDisabled,
    pressedDelay,
    pressedInterval
  );

  /**
   * To be called when there is a change with the input
   */
  const onInputChange = useCallback(() => {
    maybeUpdate(inputRef.current?.value || '0');
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
