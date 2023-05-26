import { ReactNode } from 'react';

import './SmallCard.scss';

export default function SmallCard({
  header,
  children,
  body = children,
  footer,
  variant,
  footerVariant = variant,
}: {
  header?: ReactNode;
  body?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  variant?: string;
  footerVariant?: string;
}) {
  return (
    <div className="small-card flex col p-md py-3">
      <div className="small-card__header my-2">{header}</div>
      <div className="small-card__body">{body}</div>
      <div
        className={['small-card__footer', `text-${footerVariant}`].join(' ')}
      >
        {footer}
      </div>
    </div>
  );
}

// simple optional row layout container
export function SmallCardRow({ children }: { children: ReactNode }) {
  return <div className="flex row gap-md">{children}</div>;
}
