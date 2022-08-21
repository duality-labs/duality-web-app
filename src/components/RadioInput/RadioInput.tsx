import { Fragment, useEffect, useId, useState } from 'react';
import './RadioInput.scss';

interface RadioInputProps {
  onChange?: (value: string, index: number) => void;
  children: Array<JSX.Element>;
  value?: string;
  index?: number;
  name?: string;
}

export default function RadioInput({
  onChange,
  children,
  value,
  index,
  name,
}: RadioInputProps) {
  const entries = children.reduce<{ [key: string]: JSX.Element }>(function (
    result,
    value
  ) {
    if (!value.key) throw new Error('All children must have a key');
    result[value.key] = value;
    return result;
  },
  {});
  const valueIndex = value ? Object.keys(entries).indexOf(value) : -1;
  const [selectedIndex, setSelectedIndex] = useState(
    index ?? (valueIndex === -1 ? null : valueIndex) ?? 0
  );
  const groupID = useId();
  const groupName = name || groupID;

  useEffect(() => {
    if (onChange) onChange(Object.keys(entries)[selectedIndex], selectedIndex);
  }, [onChange, selectedIndex, entries]);

  return (
    <div className="radio-input-group">
      {Object.entries(entries).map(([key, child], index) => {
        const id = `${groupName}-${key}`;

        return (
          <Fragment key={id}>
            <input
              type="radio"
              name={groupName}
              id={id}
              checked={index === selectedIndex}
              onChange={(e) => e.target.value && setSelectedIndex(index)}
            ></input>
            <label htmlFor={id} className="button button-primary">
              {child}
            </label>
          </Fragment>
        );
      })}
    </div>
  );
}
