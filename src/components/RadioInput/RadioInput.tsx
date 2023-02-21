import { useId, useMemo } from 'react';
import './RadioInput.scss';

export interface OptionProps<T> {
  option: T;
  id: string;
  index: number;
}
export interface RadioInputProps<T> {
  inputType?: 'radio' | 'checkbox';
  OptionComponent?: React.ElementType<OptionProps<T>>;
  OptionContainerComponent?: React.ElementType;
  onChange?: (value: T, index: number) => void;
  onClick?: React.MouseEventHandler<HTMLInputElement>;
  list: Array<T>;
  maxColumnCount?: number;
  value?: T;
  name?: string;
  className?: string;
  containerClassName?: string;
}

function DefaultOptionComponent<T>({ option }: OptionProps<T>) {
  return <span>{`${option}`}</span>;
}

export default function RadioInput<T>({
  inputType = 'radio',
  OptionComponent = DefaultOptionComponent,
  OptionContainerComponent = 'div',
  onChange,
  onClick,
  list,
  maxColumnCount,
  value,
  name,
  className,
  containerClassName,
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
          <OptionContainerComponent
            key={id}
            className={['radio-input-option', containerClassName]
              .filter(Boolean)
              .join(' ')}
          >
            <input
              type={inputType}
              name={groupName}
              id={id}
              checked={index === selectedIndex}
              onChange={() => onChange?.(option, index)}
              onClick={onClick}
            ></input>
            <label htmlFor={id} style={labelStyle}>
              <OptionComponent option={option} id={id} index={index} />
            </label>
          </OptionContainerComponent>
        );
      })}
    </div>
  );
}
