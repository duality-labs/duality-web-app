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
  styledAsButtons?: boolean;
  name?: string;
  className?: string;
  containerClassName?: string;
  labelClassName?: string;
}

function DefaultOptionComponent<T>({ option }: OptionProps<T>) {
  return <span>{`${option}`}</span>;
}

export default function RadioInput<T>({
  styledAsButtons = true,
  // when rendered as buttons a checkbox keyboard navigation is more inuitive
  inputType = styledAsButtons ? 'checkbox' : 'radio',
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
  labelClassName = styledAsButtons ? 'button' : '',
}: RadioInputProps<T>) {
  const selectedIndex = value !== undefined ? list.indexOf(value) : -1;
  const groupID = useId();
  const groupName = name || groupID;
  const labelStyle = useMemo(
    () => ({
      // set column width style
      flexBasis: maxColumnCount
        ? `calc(${100 / maxColumnCount}% - ${
            ((maxColumnCount - 1) / maxColumnCount) * 0.5
          }rem)`
        : undefined,
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
            style={labelStyle}
          >
            <input
              type={inputType}
              name={groupName}
              id={id}
              checked={index === selectedIndex}
              onChange={() => onChange?.(option, index)}
              onClick={onClick}
            ></input>
            <label className={labelClassName} htmlFor={id}>
              <OptionComponent option={option} id={id} index={index} />
            </label>
          </OptionContainerComponent>
        );
      })}
    </div>
  );
}
