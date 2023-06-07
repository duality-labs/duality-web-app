import { ReactNode } from 'react';

import './SmallCard.scss';

export default function SmallCard({
  className,
  header,
  children,
  body = children,
  footer,
  footerClassName,
}: {
  className?: string;
  header?: ReactNode;
  body?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  footerClassName?: string;
}) {
  return (
    <div className={['small-card flex col p-md py-3', className].join(' ')}>
      <div className="small-card__header my-2">{header}</div>
      <div className="small-card__body">{body}</div>
      <div className={['small-card__footer', footerClassName].join(' ')}>
        {footer}
      </div>
    </div>
  );
}

// simple optional row layout container
export function SmallCardRow({ children }: { children: ReactNode }) {
  return <div className="flex row gap-md">{children}</div>;
}
