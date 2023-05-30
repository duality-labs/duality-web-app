import { ReactNode } from 'react';

import './ButtonGroup.scss';

export default function ButtonGroup({
  buttonGroup,
  className,
  tabIndex,
  setTabIndex,
}: {
  buttonGroup: Array<ReactNode>;
  className?: string;
  tabIndex: number;
  setTabIndex: React.Dispatch<React.SetStateAction<number>>;
}) {
  return (
    <div
      className={['button-group flex row', className].filter(Boolean).join(' ')}
    >
      {buttonGroup.map((button, index) => {
        return (
          <button
            key={index}
            className={[
              'button-group-button',
              'px-3',
              index === tabIndex && 'active',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setTabIndex(index)}
          >
            {button}
          </button>
        );
      })}
    </div>
  );
}
