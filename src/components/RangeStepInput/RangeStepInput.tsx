import { useCallback, useRef, useState } from 'react';
import './RangeStepInput.scss';

type Direction = 1 | -1;

interface RangeStepInputProps {
  onChange?: (value: number, valueText: string) => void;
  abortInvalid?: boolean;
  pressedInterval?: number;
  pressedDelay?: number;
  description?: string;
  textValue?: string;
  editable?: boolean;
  value?: number;
  title?: string;
  step?: number;
  max?: number;
  min?: number;
}

export default function RangeStepInput({
  value,
  textValue,
  title,
  description,
  onChange,
  abortInvalid = false,
  min = 0,
  max = Infinity,
  step = 1,
  editable = true,
  pressedInterval = 50,
  pressedDelay = 5e2,
}: RangeStepInputProps) {
  if (max < min)
    throw new Error(
      'Invalid Range, max limit cannot be smaller than the min limit'
    );
  const [currentValue, setCurrentValue] = useState(
    (value ?? (textValue && parseText(textValue))) || 0
  );
  const [, setPressedID] = useState<number>();
  const inputRef = useRef<HTMLInputElement>(null);

  const validateValue = useCallback(
    function (currentValue: number, newValue: number) {
      if (abortInvalid) {
        if (newValue < min) return currentValue;
        if (newValue > max) return currentValue;
        return newValue;
      } else {
        return Math.min(Math.max(min, newValue), max);
      }
    },
    [min, max, abortInvalid]
  );

  const onStep = useCallback(
    function (direction: Direction) {
      setCurrentValue((oldValue) =>
        validateValue(oldValue, oldValue + step * direction)
      );
    },
    [step, validateValue]
  );

  const onPressed = useCallback(
    function (direction: Direction) {
      let lastID = 0; // fix react calling setPressedID twice
      setPressedID(function (oldID) {
        if (lastID) return lastID;
        clearInterval(oldID);
        clearTimeout(oldID);

        lastID = setTimeout(startCounting as TimerHandler, pressedDelay);
        return lastID;
      });

      function startCounting() {
        setPressedID(function (oldID) {
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

  const onReleased = useCallback(function () {
    setPressedID(function (oldID) {
      clearInterval(oldID);
      clearTimeout(oldID);
      return undefined;
    });
  }, []);

  const onInputChange = useCallback(
    function () {
      const input = inputRef.current;
      if (input)
        setCurrentValue((oldValue) =>
          validateValue(oldValue, parseText(input.value))
        );
    },
    [validateValue]
  );

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
        >
          -
        </button>
        {editable ? (
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

function parseText(text: string) {
  return +text;
}
