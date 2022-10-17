import { Fragment, useId, useMemo } from 'react';
import './RadioInput.scss';

export interface OptionProps<T> {
  option: T;
  id: string;
  index: number;
}
interface RadioInputProps<T> {
  OptionComponent?: React.ElementType<OptionProps<T>>;
  onChange?: (value: T, index: number) => void;
  list: Array<T>;
  maxColumnCount?: number;
  value?: T;
  index?: number;
  name?: string;
  className?: string;
}

function DefaultOptionComponent<T>({ option }: OptionProps<T>) {
  return <span>{`${option}`}</span>;
}

export default function RadioInput<T>({
  OptionComponent = DefaultOptionComponent,
  onChange,
  list,
  maxColumnCount,
  value,
  name,
  className,
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
    <div className={['radio-input-group', className].filter(Boolean).join(' ')}>
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
            <label htmlFor={id} style={labelStyle}>
              <OptionComponent option={option} id={id} index={index} />
            </label>
          </Fragment>
        );
      })}
    </div>
  );
}
