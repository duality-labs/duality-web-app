import React, { useState } from 'react';
import './ScrollableArea.scss';

interface ScrollableAreaProps {
  className: string;
  children: React.ReactNode | React.ReactNode[];
}

export default function ScrollableArea({
  className,
  children,
}: ScrollableAreaProps) {
  // track state of scroll position inside scrolled area
  const [isScrolled, setScrolled] = useState(false);

  // apply additional class if position is scrolled
  const classNames = [
    'scrollable-area',
    isScrolled && 'scrollable-area--scrolled',
    className,
  ].filter(Boolean);

  // determine state of scroll position
  const onScroll = (e: React.UIEvent) => {
    const scrollTarget = e.target as HTMLDivElement;
    setScrolled(scrollTarget.scrollTop > 0);
  };

  return (
    <div className={classNames.join(' ')} onScroll={onScroll}>
      {children}
    </div>
  );
}
