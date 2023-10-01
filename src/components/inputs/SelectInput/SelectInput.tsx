import { faAngleDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ReactNode, useCallback, useState } from 'react';
import Drawer from '../../Drawer';
import RadioInput from '../../RadioInput';
import { OptionProps, RadioInputProps } from '../../RadioInput/RadioInput';

import './SelectInput.scss';

// re-export the reused OptionProps
export type { OptionProps };

type GetNode<T> = (item: T | undefined) => ReactNode;
interface SelectedComponentProps<T> {
  value: T | undefined;
  getSelectedText: GetNode<T>;
}
function DefaultSelectedComponent<T>({
  value,
  getSelectedText,
}: SelectedComponentProps<T>) {
  return <>{getSelectedText(value)}</>;
}

interface SelectOptionsProps<T> extends OptionProps<T> {
  getLabel: GetNode<T>;
  getDescription: GetNode<T>;
}

function DefaultOptionComponent<T>({
  option,
  getLabel,
  getDescription,
}: SelectOptionsProps<T>) {
  const label = getLabel(option) ?? '';
  const description = getDescription(option) ?? '';
  return (
    <>
      <div className="label mr-auto">{label}</div>
      <div
        className={[
          'description',
          'row flex-centered gap-1',
          !description && 'hide',
          'ml-auto',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {description}
      </div>
    </>
  );
}

interface SelectInputProps<T> extends RadioInputProps<T> {
  SelectedComponent?: React.ComponentType<SelectedComponentProps<T>>;
  getSelectedText?: GetNode<T>;
  getLabel?: GetNode<T>;
  getDescription?: GetNode<T>;
  floating?: boolean;
}

function defaultGetLabelText<T>(item: T) {
  return (item as unknown as { label: string })?.['label'] || '';
}

function defaultGetDescriptionText<T>(item: T) {
  return (item as unknown as { description: string })?.['description'] || '';
}

export default function SelectInput<T>({
  className,
  SelectedComponent = DefaultSelectedComponent,
  getLabel = defaultGetLabelText,
  getDescription = defaultGetDescriptionText,
  getSelectedText = getLabel,
  list,
  value,
  maxColumnCount = 1,
  floating,
  ...radioInputProps
}: SelectInputProps<T>) {
  const selectedItem = list.find((item) => item === value);
  const [expanded, setExpanded] = useState(false);
  const toggleExpand = useCallback(
    () => setExpanded((expanded) => !expanded),
    []
  );
  const close = useCallback(() => setExpanded(false), []);
  return (
    <div
      className={['select-input', className, expanded && 'expanded']
        .filter(Boolean)
        .join(' ')}
    >
      <button
        className="select-input-selection row flex flex-centered"
        type="button"
        onClick={toggleExpand}
        onBlur={close}
      >
        <div className="col mr-auto">
          <SelectedComponent
            value={selectedItem}
            getSelectedText={getSelectedText}
          />
        </div>
        <div className="col ml-auto flex-centered">
          <FontAwesomeIcon icon={faAngleDown} />
        </div>
      </button>
      <Drawer
        containerClassName="select-input-options"
        expanded={expanded}
        floating={floating}
      >
        <RadioInput<T>
          inputType="checkbox"
          className={[
            'select-input-group',
            `select-input-group--${maxColumnCount === 1 ? 'column' : 'row'}`,
          ].join(' ')}
          containerClassName="select-input-option"
          styledAsButtons={maxColumnCount !== 1}
          // set default OptionComponent to use getters
          OptionComponent={useCallback(
            (optionComponentProps: OptionProps<T>) => (
              <DefaultOptionComponent
                {...optionComponentProps}
                getLabel={getLabel}
                getDescription={getDescription}
              />
            ),
            [getLabel, getDescription]
          )}
          onClick={useCallback(() => setExpanded(false), [])}
          // allow overwriting with custom components
          {...radioInputProps}
          list={list}
          value={value}
          maxColumnCount={maxColumnCount}
        />
      </Drawer>
    </div>
  );
}
