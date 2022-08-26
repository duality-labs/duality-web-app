import { Fragment, useCallback, useEffect, useId, useState } from 'react';
import './RadioInput.scss';

interface RadioInputProps<T> {
  renderOption: (option: T, id: string, index: number) => React.ReactNode;
  onChange?: (value: T, index: number) => void;
  list: Array<T>;
  maxColumnCount?: number;
  value?: T;
  index?: number;
  name?: string;
}

export default function RadioInput<T>({
  renderOption,
  onChange,
  list,
  maxColumnCount,
  value,
  index,
  name,
}: RadioInputProps<T>) {
  const valueIndex = value ? list.indexOf(value) : -1;
  const [selectedIndex, setSelectedIndex] = useState(
    index ?? (valueIndex === -1 ? null : valueIndex) ?? 0
  );
  const groupID = useId();
  const groupName = name || groupID;
  const flexBasis = maxColumnCount ? `${100 / maxColumnCount}%` : undefined;
  const getChild = useCallback(
    (index: number) =>
      renderOption(list[index], `${groupName}-${index}`, index),
    [groupName, list, renderOption]
  );
  const [children, setChildren] = useState(
    list.map((_, index) => getChild(index))
  );

  useEffect(() => {
    if (onChange) onChange(list[selectedIndex], selectedIndex);
  }, [onChange, selectedIndex, list]);

  useEffect(() => {
    setChildren(list.map((_, index) => getChild(index)));
  }, [getChild, list]);

  return (
    <div className="radio-input-group">
      {children.map((child, index) => {
        const id = `${groupName}-${index}`;

        return (
          <Fragment key={id}>
            <input
              type="radio"
              name={groupName}
              id={id}
              checked={index === selectedIndex}
              onChange={(e) => e.target.value && setSelectedIndex(index)}
            ></input>
            <label
              htmlFor={id}
              className="button button-primary"
              style={{ flexBasis }}
            >
              {child}
            </label>
          </Fragment>
        );
      })}
    </div>
  );
}
