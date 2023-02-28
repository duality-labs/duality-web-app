import {
  ReactNode,
  useCallback,
  useLayoutEffect,
  useMemo,
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
      // todo: this has been changed to allow rerendering changed components to cause an animation
      // this has however caused the animation to start on component creation
      updateValue(value);
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
  const entries = useMemo(() => {
    return Array.isArray(values)
      ? values.map<[T, string]>((value) => [value, `${value}`])
      : values instanceof Map
      ? Array.from(values.entries())
      : (Object.entries(values).map(([value, description]) => [
          value,
          description,
        ]) as [T, string][]);
  }, [values]);
  const selectedIndex = entries.findIndex(
    ([entryValue]) => entryValue === value
  );
  const includedIndexes = useMemo(() => {
    return (
      entries
        .map((_, index, entries) => {
          // cumulate weightings
          let result = 0;
          // weight extents of list
          if (index === 0 || index === entries.length - 1) {
            result += 25;
          }
          // weight start of list
          if (index < 5) {
            result += Math.pow(5 - index, 2);
          }
          // weight end of list
          if (index >= entries.length - 5) {
            result += Math.pow(5 - (entries.length - 1 - index), 2);
          }
          // weight to left near selection
          if (index >= selectedIndex - 4 && index <= selectedIndex) {
            result += Math.pow(5 - (selectedIndex - index), 2);
          }
          // weight to right near selection
          if (index >= selectedIndex && index <= selectedIndex + 4) {
            result += Math.pow(5 - (index - selectedIndex), 2);
          }
          return [index, result];
        })
        // get most weighted indexes
        .sort((a, b) => b[1] - a[1])
        // truncated to top 10
        .slice(0, 10)
        // get just the indexes, remove the weightings
        .map((a) => a[0])
        // sort indexes in order
        .sort((a, b) => a - b)
    );
  }, [entries, selectedIndex]);

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
        const previousIndex = includedIndexes.includes(index - 1);
        const currentIndex = includedIndexes.includes(index);
        const nextIndex = includedIndexes.includes(index + 1);

        // include button if required or if excluding it
        // will not reduce the number of shown buttons
        if (currentIndex || (previousIndex && nextIndex)) {
          return (
            <button
              key={entryValue}
              type="button"
              className={[
                'button non-moving',
                buttonClassName,
                selectedIndex === index && 'active',
              ]
                .filter(Boolean)
                .join(' ')}
              ref={createRefForValue(entryValue)}
              onClick={() => onChange(entryValue)}
            >
              {description}
            </button>
          );
        }

        // button is not included and button before this was also not included (ignore)
        if (!previousIndex) return [];

        // else calculate value to use for an ellipsis (…) button
        const nextIncludedIndex = includedIndexes.indexOf(index - 1) + 1;
        const nextAverageIndex =
          nextIncludedIndex < includedIndexes.length
            ? Math.floor((includedIndexes[nextIncludedIndex] + index) / 2)
            : includedIndexes.length - 1; // don't look past array bounds
        const nextAverageKey = entries[nextAverageIndex][0];

        return (
          <button
            key={nextAverageKey}
            type="button"
            className={['button non-moving', buttonClassName]
              .filter(Boolean)
              .join(' ')}
            ref={createRefForValue(nextAverageKey)}
            onClick={() => onChange(nextAverageKey)}
          >
            …
          </button>
        );
      })}
    </div>
  );
}
