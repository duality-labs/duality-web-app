import { Fragment, useEffect, useState } from 'react';
import './RadioInput.scss';

interface RadioInputProps {
  onChange?: (index: number) => void;
  children: Array<JSX.Element>;
  index?: number;
}

export default function RadioInput({
  onChange,
  children,
  index = 0,
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
  const [selectedIndex, setSelectedIndex] = useState(index);

  useEffect(() => {
    if (onChange) onChange(selectedIndex);
  }, [onChange, selectedIndex]);

  return (
    <div className="radio-input-group">
      {Object.entries(entries).map(([key, child], index) => {
        return (
          <Fragment key={key}>
            <input
              type="radio"
              id={key}
              checked={index === selectedIndex}
              onChange={(e) => e.target.value && setSelectedIndex(index)}
            ></input>
            <label htmlFor={key} className="button button-primary">
              {child}
            </label>
          </Fragment>
        );
      })}
    </div>
  );
}
