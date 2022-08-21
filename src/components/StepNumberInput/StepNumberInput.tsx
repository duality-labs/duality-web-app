import { useCallback, useEffect, useRef, useState } from 'react';

type Direction = 1 | -1;

interface StepNumberInputProps {
  onChange?: (value: number) => void;
  value: number;
  step?: number;
}

export default function StepNumberInput({
  onChange,
  value = 0,
  step = 1,
}: StepNumberInputProps) {
  const [currentValue, setCurrentValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Increases / Decreases the current value based on the step
   * @param direction -1 to decrease by -step and 1 to increase by +step
   */
  const onStep = useCallback(
    (direction: Direction) => {
      setCurrentValue((oldValue) => oldValue + step * direction);
    },
    [step]
  );

  /**
   * To be called when there is a change with the input
   */
  const onInputChange = useCallback(() => {
    if (!inputRef.current) return;
    setCurrentValue(parseText(inputRef.current.value));
  }, []);

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
