import BigNumber from 'bignumber.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useOnContinualPress from '../hooks/useOnContinualPress';

import './StepNumberInput.scss';

type Direction = 1 | -1;

interface StepNumberInputProps<T extends number | string = string> {
  onInput?: (value: T) => void;
  onChange?: (value: T) => void;
  tabbableButtons?: boolean;
  pressedInterval?: number;
  disableLimit?: boolean;
  pressedDelay?: number;
  description?: string;
  disabled?: boolean; // is the input field text and buttons disabled
  editable?: boolean; // can the input field text be edited
  readOnly?: boolean; // force the input to be an uneditable span instead of an input
  title?: string;
  value: T;
  stepFunction?: (value: T, direction: number, valueString: string) => T;
  step?: string | number;
  max?: string | number;
  min?: string | number;
  minSignificantDigits?: number | ((valueString: string) => number);
  maxSignificantDigits?: number | ((valueString: string) => number);
  parse?: (value: string) => T;
  format?: (value: T) => string;
}

export default function StepNumberInput<T extends number | string = string>({
  onInput,
  onChange = onInput,
  tabbableButtons = false,
  pressedInterval = 50,
  disableLimit = true,
  pressedDelay = Infinity,
  description,
  disabled = false,
  editable = true,
  readOnly = false,
  title,
  value,
  stepFunction,
  step: rawStep = 1,
  max: rawMax,
  min: rawMin,
  minSignificantDigits: minSignificantDigitsOrCallback = 2,
  maxSignificantDigits: maxSignificantDigitsOrCallback = 6,
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

  const [internalValue = currentValue, setInternalValue] = useState<string>();

  /**
   * Makes sure the value is valid number within the proper range
   * @param newValue the proposed new value to be checked
   */
  const maybeUpdate = useCallback(
    (newValueString: string, onChange?: (value: T) => void) => {
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
    [min, max, parse]
  );

  /**
   * Increases / Decreases the current value based on the step
   * @param direction -1 to decrease by -step and 1 to increase by +step
   */
  const onStep = useCallback(
    (direction: Direction) => {
      if (maybeUpdate) {
        const newValue = stepFunction
          ? new BigNumber(stepFunction(value, direction, currentValue))
          : new BigNumber(value).plus(step * direction);
        maybeUpdate(newValue.toFixed(), onChange);
      }
    },
    [step, stepFunction, maybeUpdate, onChange, value, currentValue]
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

  // note: these dynamic styles could be made redundant if a monospaced font
  //       is used for the numeric text here. the dynamic style here is to
  //       avoid the size of the input field resizing for every number change
  const dynamicInputStyle = useMemo(() => {
    const minSignificantDigits =
      typeof minSignificantDigitsOrCallback === 'function'
        ? minSignificantDigitsOrCallback(internalValue)
        : minSignificantDigitsOrCallback;
    const maxSignificantDigits =
      typeof maxSignificantDigitsOrCallback === 'function'
        ? maxSignificantDigitsOrCallback(internalValue)
        : maxSignificantDigitsOrCallback;
    return {
      // set width of input based on current values but restrained to a min/max
      minWidth: `${minSignificantDigits}ch`,
      maxWidth: `${
        maxSignificantDigits + (internalValue.includes('.') ? 1 : 0)
      }ch`,
      width: `${internalValue.length}ch`,
    };
  }, [
    internalValue,
    minSignificantDigitsOrCallback,
    maxSignificantDigitsOrCallback,
  ]);

  const dynamicContainerStyle = useMemo(() => {
    return {
      minWidth: `${internalValue.length + 17}ch`,
    };
  }, [internalValue]);

  return (
    <div
      className={['range-step-input', readOnly && 'range-step-input--read-only']
        .filter(Boolean)
        .join(' ')}
      style={dynamicContainerStyle}
    >
      {title && <h6 className="range-step-title">{title}</h6>}
      <div className="range-step-controls row flex-centered my-2">
        {!readOnly && (
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
        )}
        {!readOnly && editable ? (
          <input
            type="number"
            value={internalValue}
            onInput={() => maybeUpdate(inputRef.current?.value || '0', onInput)}
            onChange={(e) => {
              setInternalValue(e.target.value);
              maybeUpdate(e.target.value || '0', onChange);
            }}
            onBlur={() => setInternalValue(undefined)}
            ref={inputRef}
            style={dynamicInputStyle}
          />
        ) : (
          <span style={dynamicInputStyle}>{currentValue}</span>
        )}
        {!readOnly && (
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
        )}
      </div>
      {description && (
        <span className="range-step-description">{description}</span>
      )}
    </div>
  );
}
