import { ReactNode, useState } from 'react';

interface Tab {
  key: string;
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
  const [{ key, Tab }, setTab] = useState<Tab>(tabs[0]);

  return (
    <div className={['tabs', className].filter(Boolean).join(' ')}>
      <div className="tabs__nav row">
        <div className="col">
          {tabs.map((tab) => {
            return (
              <button
                key={tab.key}
                className={tab.key === key ? 'active' : ''}
                onClick={() => setTab(tab)}
              >
                {tab.nav}
              </button>
            );
          })}
        </div>
      </div>
      <div className="tabs__tab row">
        <div className="col">
          <Tab />
        </div>
      </div>
    </div>
  );
}
