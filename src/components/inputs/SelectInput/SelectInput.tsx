import { faAngleDown, faAngleUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useCallback, useState } from 'react';
import RadioInput from '../../RadioInput';
import { RadioInputProps } from '../../RadioInput/RadioInput';

import './SelectInput.scss';

interface SelectInputProps<T> extends RadioInputProps<T> {
  SelectedComponent: React.ComponentType<{ value: T | undefined }>;
}

export default function SelectInput<T>({
  className,
  SelectedComponent,
  list,
  value,
  ...radioInputProps
}: SelectInputProps<T>) {
  const selectedItem = list.find((item) => item === value);
  const [expanded, setExpanded] = useState(false);
  const toggleExpand = useCallback(
    () => setExpanded((expanded) => !expanded),
    []
  );
  return (
    <div className="select-input">
      <div className="select-input-selection row">
        <div className="col">
          <SelectedComponent value={selectedItem} />
        </div>
        <div className="col ml-auto flex-centered">
          <button type="button" onClick={toggleExpand}>
            <FontAwesomeIcon icon={!expanded ? faAngleDown : faAngleUp} />
          </button>
        </div>
      </div>
      <div
        className={['select-input-options', !expanded ? 'hide' : ''].join(' ')}
      >
        <RadioInput<T>
          className="select-input-group"
          OptionContainerComponent={({ children }) => (
            <div className="select-input-option">{children}</div>
          )}
          onClick={() => setExpanded(false)}
          // allow overwriting with custom components
          {...radioInputProps}
          list={list}
          value={value}
        />
      </div>
    </div>
  );
}
