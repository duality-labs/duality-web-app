import { ReactNode, useState } from 'react';

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
    <div className={['tabs', className].filter(Boolean).join(' ')}>
      <div className="tabs__nav flex row">
        {tabs.map((tab, index) => {
          return (
            <button
              key={index}
              className={index === tabIndex ? 'active' : ''}
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
