import React from 'react';
import './ScrollableArea.scss';

interface ScrollableAreaProps {
  className: string;
  children: React.ReactNode | React.ReactNode[];
}

export default function ScrollableArea({
  className,
  children,
}: ScrollableAreaProps) {
  return (
    <div className={['scrollable-area', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}
