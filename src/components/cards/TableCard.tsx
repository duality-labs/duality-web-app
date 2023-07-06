import { FormEventHandler, ReactNode } from 'react';

import RadioButtonGroupInput from '../RadioButtonGroupInput/RadioButtonGroupInput';
import SearchInput from '../inputs/SearchInput/SearchInput';

import './TableCard.scss';

export interface TableCardProps<T extends string | number> {
  as?: 'div' | 'form';
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  searchDisabled?: boolean;
  scrolling?: boolean;
  headerActions?: ReactNode;
  switchValues?: { [value in T]: ReactNode } | Map<T, ReactNode> | T[];
  switchValue?: T;
  switchOnChange?: React.Dispatch<React.SetStateAction<T>>;
  searchValue?: string;
  setSearchValue?: React.Dispatch<React.SetStateAction<string>>;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  children: ReactNode;
}
export default function TableCard<T extends string | number>({
  as: RootComponent = 'div',
  className,
  title,
  subtitle,
  searchDisabled = false,
  scrolling = true,
  headerActions,
  switchValues,
  switchValue,
  switchOnChange,
  searchValue = '',
  setSearchValue,
  onSubmit,
  children,
}: TableCardProps<T>) {
  // show loken list cards
  const content = (
    <>
      <div className="col flex">
        {title && (
          <div className="table-card__header row flex-centered gap-3">
            <div className="col flex">
              <div className="table-card__hero-title h4">{title}</div>
            </div>
            {switchOnChange && switchValues && switchValue && (
              <div className="col">
                <div className="table-card__asset-toggle">
                  <RadioButtonGroupInput<T>
                    values={switchValues}
                    value={switchValue}
                    onChange={switchOnChange}
                  />
                </div>
              </div>
            )}
            {headerActions}
          </div>
        )}
        {subtitle && <div className="table-card__subtitle">{subtitle}</div>}
        {setSearchValue && (
          <div className="table-card__search row mt-lg mb-4">
            <div className="col flex">
              <SearchInput
                placeholder="Search token name or paste address"
                value={searchValue}
                disabled={searchDisabled}
                onInput={setSearchValue}
              />
            </div>
          </div>
        )}
        <div className="table-card__table_container page-card__footer relative row flex mt-3">
          <div
            className={
              scrolling
                ? 'table-card__table col flex absolute filled pb-4 page-card__padding-width'
                : 'table-card__table col flex pb-4 page-card__padding-width'
            }
          >
            {children}
          </div>
        </div>
      </div>
    </>
  );

  const classNames = [
    'table-card',
    'page-card',
    className,
    scrolling && 'scrollable',
  ].filter(Boolean);
  // add onSubmit handler to only forms
  return RootComponent === 'form' ? (
    <RootComponent className={classNames.join(' ')} onSubmit={onSubmit}>
      {content}
    </RootComponent>
  ) : (
    <RootComponent className={classNames.join(' ')}>{content}</RootComponent>
  );
}
