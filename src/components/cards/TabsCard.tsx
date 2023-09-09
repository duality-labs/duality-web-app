import { useState } from 'react';

import { Tab } from '../Tabs/Tabs';

import './TabsCard.scss';

export default function TabsCard({
  tabs,
  className,
  ...props
}: JSX.IntrinsicElements['div'] & {
  tabs: Array<Tab>;
}) {
  const [tabIndex, setTabIndex] = useState<number>(0);
  const { Tab } = tabs[tabIndex];

  return (
    <div
      className={['page-card tabs-card p-0', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <div className="tabs-card__nav row">
        {tabs.map((tab, index) => {
          return (
            <button
              key={index}
              className={[
                'tabs-card__nav-button',
                'py-md px-4',
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
      <div className="tabs-card__tab flex row">
        <div className="flex col">
          <Tab />
        </div>
      </div>
    </div>
  );
}
