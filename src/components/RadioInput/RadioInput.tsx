import { useEffect, useId, useState } from 'react';
import './RadioInput.scss';

interface RadioInputProps {
  onChange?: (value: string, index: number) => void;
  render: () => Array<JSX.Element>;
  value?: string;
  index?: number;
  name?: string;
}

export default function RadioInput({
  render,
  name,
  value,
  index,
  onChange,
}: RadioInputProps) {
  const entries = render().reduce<{ [key: string]: JSX.Element }>(function (
    result,
    value
  ) {
    if (!value.key) throw new Error('All children must have a key');
    result[value.key] = value;
    return result;
  },
  {});
  const [selectedIndex, setSelectedIndex] = useState(
    index ??
      (value ? nullif(Object.keys(entries).indexOf(value), -1) : null) ??
      0
  );
  const groupID = useId();
  const groupName = name || groupID;

  useEffect(() => {
    if (onChange) onChange(Object.keys(entries)[selectedIndex], selectedIndex);
  }, [selectedIndex, onChange, entries]);

  return (
    <div className="radio-input-group">
      {Object.entries(entries).map(function ([key, children], index) {
        const id = `${groupName}-${key}`;

        return (
          <>
            <input
              type="radio"
              name={groupName}
              id={id}
              checked={index === selectedIndex}
              onChange={(e) => e.target.value && setSelectedIndex(index)}
            ></input>
            <label htmlFor={id}>{children}</label>
          </>
        );
      })}
    </div>
  );
}

function nullif<T>(value: T, nullValue: T): T | null {
  return value === nullValue ? null : value;
}
