import { ReactNode, useState } from 'react';

import './Tabs.scss';

interface Tab {
  nav: ReactNode;
  Tab: React.FunctionComponent;
}
export default function Tabs({
  tabs,
  className,
}: {
  tabs: Array<Tab>;
  className?: string;
}) {
  const [tabIndex, setTabIndex] = useState<number>(0);
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
              onClick={() => setTabIndex(index)}
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
