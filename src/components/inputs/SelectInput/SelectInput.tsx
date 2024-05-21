import { faAngleDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
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

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(event: Event) {
      // only collapse if new focus doesn't exist or is outside of the container
      const target = event.target as Element | null;
      if (!target?.nodeType || !containerRef.current?.contains(target)) {
        setExpanded(false);
      }
    }
    // Bind the event listener to document
    if (expanded) {
      // use focusout instead of blur because blur don't not always bubble
      // use focusin instead of focusout because tabbing to a child triggers
      // "focusout" with the document.body as the activeElement
      // use click and keydown and touchstart to catch start of all input types
      // - https://www.quirksmode.org/dom/events/blurfocus.html
      // - https://developer.mozilla.org/en-US/docs/Web/API/Element/focusin_event
      // - https://developer.mozilla.org/en-US/docs/Web/API/Element/focusout_event
      document.addEventListener('focusin', handleClickOutside);
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      return () => {
        // Unbind the event listener on clean up
        document.removeEventListener('focusin', handleClickOutside);
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('keydown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }
  }, [expanded]);

  return (
    <div
      ref={containerRef}
      className={['select-input', className, expanded && 'expanded']
        .filter(Boolean)
        .join(' ')}
    >
      <button
        className="select-input-selection row flex gap-3 flex-centered"
        type="button"
        onClick={toggleExpand}
      >
        <div className="col flex">
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
          disabled={!expanded}
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
