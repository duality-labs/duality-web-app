import {
  ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import './RadioButtonGroupInput.scss';

function useSelectedButtonBackgroundMove<T extends string | number>(
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
        if (newValue !== undefined) {
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

interface Props<T extends string | number> {
  className?: string;
  buttonClassName?: string;
  values: { [value in T]: ReactNode } | Map<T, ReactNode> | T[];
  value: T;
  onChange: (value: T) => void;
}

export default function RadioButtonGroupInput<T extends string | number>({
  className,
  buttonClassName,
  values = [],
  value,
  onChange,
}: Props<T>) {
  const [movingAssetRef, createRefForValue] =
    useSelectedButtonBackgroundMove<T>(value);
  const entries = Array.isArray(values)
    ? values.map<[T, string]>((value) => [value, `${value}`])
    : values instanceof Map
    ? Array.from(values.entries())
    : (Object.entries(values).map(([value, description]) => [
        value,
        description,
      ]) as [T, string][]);
  const selectedIndex = entries.findIndex(
    ([entryValue]) => entryValue === value
  );
  return (
    <div
      className={['radio-button-group-switch', className]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        className={['button moving-background', buttonClassName]
          .filter(Boolean)
          .join(' ')}
        disabled
        ref={movingAssetRef}
      />
      {entries.flatMap(([entryValue, description], index, entries) => {
        const previousIndex = includeIndex(
          index - 1,
          entries.length,
          selectedIndex
        );
        const currentIndex = includeIndex(index, entries.length, selectedIndex);
        const futureIndex = includeIndex(
          index + 1,
          entries.length,
          selectedIndex
        );
        return currentIndex || (previousIndex && futureIndex) ? (
          // include button
          <button
            key={entryValue}
            type="button"
            className={['button non-moving', buttonClassName]
              .filter(Boolean)
              .join(' ')}
            ref={createRefForValue(entryValue)}
            onClick={() => onChange(entryValue)}
          >
            {description}
          </button>
        ) : previousIndex ? (
          // button is not included and button before this was included
          <span key={entryValue}>...</span>
        ) : (
          // button is not included and button before this was also not included (ignore)
          []
        );
      })}
    </div>
  );
}

function includeIndex(
  index: number,
  length: number,
  selectedIndex?: number
): boolean {
  // if value is of first 3 values
  if (index < 3) {
    return true;
  }
  // if value is of last 3 values
  else if (index >= length - 3) {
    return true;
  }
  // if value is of middle 5 values
  else if (
    selectedIndex !== undefined &&
    selectedIndex >= 0 &&
    index >= selectedIndex - 2 &&
    index <= selectedIndex + 2
  ) {
    return true;
  }
  // else return false
  else {
    return false;
  }
}
