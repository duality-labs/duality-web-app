import {
  ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

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

  const updateValue = useCallback(
    (newValue?: T) => {
      const targetButton = refsByValue[newValue || value];
      if (movingButton && targetButton) {
        movingButton.style.width = `${targetButton.offsetWidth}px`;
        movingButton.style.left = `${targetButton.offsetLeft}px`;
        if (newValue) {
          movingButton.classList.add('transition-ready');
        } else {
          movingButton?.classList.remove('transition-ready');
        }
      }
    },
    [value, refsByValue, movingButton]
  );

  const lastValue = useRef<T>(value);
  // update button size on *any* paint frame to catch button resizing
  useLayoutEffect(() => {
    if (lastValue.current !== value) {
      lastValue.current = value;
      updateValue(value);
    } else {
      updateValue();
    }
  });

  return [movingButtonRef, createRefForValue];
}

interface Props<T extends string> {
  className?: string;
  values: { [value in T]: ReactNode } | Map<T, ReactNode> | T[];
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
    : values instanceof Map
    ? Array.from(values.entries())
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
          className="button non-moving"
          ref={createRefForValue(entryValue)}
          onClick={() => onChange(entryValue)}
        >
          {description}
        </button>
      ))}
    </div>
  );
}
