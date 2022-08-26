import { Fragment, useEffect, useId, useState } from 'react';
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

  useEffect(() => {
    if (onChange) onChange(list[selectedIndex], selectedIndex);
  }, [onChange, selectedIndex, list]);

  return (
    <div className="radio-input-group">
      {list.map((option, index) => {
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
              {renderOption(option, id, index)}
            </label>
          </Fragment>
        );
      })}
    </div>
  );
}
