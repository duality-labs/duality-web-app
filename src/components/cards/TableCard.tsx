import { ReactNode } from 'react';

import RadioButtonGroupInput from '../RadioButtonGroupInput/RadioButtonGroupInput';
import SearchInput from '../inputs/SearchInput/SearchInput';

import './TableCard.scss';

export default function TableCard<T extends string | number>({
  className,
  title,
  switchValues,
  switchValue,
  switchOnChange,
  searchValue = '',
  setSearchValue,
  children,
}: {
  className?: string;
  title: ReactNode;
  switchValues?: { [value in T]: ReactNode } | Map<T, ReactNode> | T[];
  switchValue?: T;
  switchOnChange?: React.Dispatch<React.SetStateAction<T>>;
  searchValue?: string;
  setSearchValue?: React.Dispatch<React.SetStateAction<string>>;
  children: ReactNode;
}) {
  // show loken list cards
  return (
    <div className={['table-card', className].filter(Boolean).join(' ')}>
      <div className="col flex">
        <div className="table-card__header row flex-centered gap-3 m-lg mb-0">
          <div className="col flex">
            <h2 className="table-card__hero-title">{title}</h2>
          </div>
          {switchOnChange && switchValues && switchValue && (
            <div className="col">
              <div className="table-card__asset-toggle">
                <RadioButtonGroupInput<T>
                  buttonClassName="px-5"
                  values={switchValues}
                  value={switchValue}
                  onChange={switchOnChange}
                />
              </div>
            </div>
          )}
        </div>
        {setSearchValue && (
          <div className="table-card__search row m-lg mb-0">
            <div className="col flex">
              <SearchInput value={searchValue} onInput={setSearchValue} />
            </div>
          </div>
        )}
        <div className="relative row flex mt-lg">
          <div className="table-card__table col flex absolute filled px-lg pb-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
