import { ReactNode, useCallback, useLayoutEffect, useState } from 'react';

import './RadioButtonGroupInput.scss';

function useSelectedButtonBackgroundMove<T extends string>(
  value: T
): [
  (ref: HTMLButtonElement | null) => void,
  (value: T) => (ref: HTMLButtonElement | null) => void
] {
  const [movingButton, setMovingButton] = useState<HTMLButtonElement | null>();
  const movingButtonRef = useCallback(
    (ref: HTMLButtonElement | null) => setMovingButton(ref),
    []
  );

  const [refsByValue, setRefsByValue] = useState<{
    [value in T]?: HTMLElement | null;
  }>({});

  const createRefForValue = useCallback((value: T) => {
    return (ref: HTMLButtonElement | null) => {
      setRefsByValue((refs) => {
        // update element refs only if they have changed
        if (ref && ref !== refs[value]) {
          return { ...refs, [value]: ref };
        }
        return refs;
      });
    };
  }, []);

  useLayoutEffect(() => {
    const targetButton = refsByValue[value];
    if (movingButton && targetButton) {
      movingButton.style.width = `${targetButton.offsetWidth}px`;
      movingButton.style.left = `${targetButton.offsetLeft}px`;
      movingButton?.classList.add('transition-ready');
    }
  }, [value, movingButton, refsByValue]);

  return [movingButtonRef, createRefForValue];
}

interface Props<T extends string> {
  className?: string;
  values: { [value in T]: ReactNode } | T[];
  value: T;
  onChange: (value: T) => void;
}

export default function RadioButtonGroupInput<T extends string>({
  className,
  values = [],
  value,
  onChange,
}: Props<T>) {
  const [movingAssetRef, createRefForValue] =
    useSelectedButtonBackgroundMove<T>(value);
  const entries = Array.isArray(values)
    ? values.map<[T, string]>((value) => [value, value])
    : (Object.entries(values).map(([value, description]) => [
        value,
        description,
      ]) as [T, string][]);
  return (
    <div
      className={['radio-button-group-switch', className]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        className="button moving-background"
        disabled
        ref={movingAssetRef}
      />
      {entries.map(([entryValue, description]) => (
        <button
          key={entryValue}
          type="button"
          className="button py-3 px-4"
          ref={createRefForValue(entryValue)}
          onClick={() => onChange(entryValue)}
        >
          {description}
        </button>
      ))}
    </div>
  );
}
