import { ReactNode, useState } from 'react';

import './Tabs.scss';

export interface Tab {
  nav: ReactNode;
  Tab: React.FunctionComponent;
}
export default function Tabs({
  tabs,
  value: givenTabIndex,
  onChange: givenSetTabIndex,
  className,
}: {
  tabs: Array<Tab>;
  className?: string;
  value?: number;
  onChange?: (index: number) => void;
}) {
  const [defaultTabIndex, defaultSetTabIndex] = useState<number>(0);
  // allow tab index to be set internally or externally
  const [tabIndex, setTabIndex] =
    givenTabIndex !== undefined
      ? [givenTabIndex, givenSetTabIndex]
      : [defaultTabIndex, defaultSetTabIndex];
  const { Tab } = tabs[tabIndex];

  return (
    <div className={['tabs col gap-4', className].filter(Boolean).join(' ')}>
      <div className="tabs__nav flex row gutter-x-3">
        {tabs.map((tab, index) => {
          return (
            <button
              key={index}
              className={[
                'tabs__nav-button',
                'px-3',
                index === tabIndex && 'active',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setTabIndex?.(index)}
            >
              {tab.nav}
            </button>
          );
        })}
      </div>
      <div className="tabs__tab flex row">
        <div className="flex col">
          <Tab />
        </div>
      </div>
    </div>
  );
}
