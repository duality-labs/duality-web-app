import { Fragment, useId, useMemo } from 'react';
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
  name,
}: RadioInputProps<T>) {
  const selectedIndex = value !== undefined ? list.indexOf(value) : -1;
  const groupID = useId();
  const groupName = name || groupID;
  const labelStyle = useMemo(
    () => ({
      // set column width style
      flexBasis: maxColumnCount ? `${100 / maxColumnCount}%` : undefined,
    }),
    [maxColumnCount]
  );

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
              onChange={() => onChange?.(option, index)}
            ></input>
            <label
              htmlFor={id}
              className="button button-primary"
              style={labelStyle}
            >
              {renderOption(option, id, index)}
            </label>
          </Fragment>
        );
      })}
    </div>
  );
}
