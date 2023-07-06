import { useMemo, useState } from 'react';
import { days, hours, minutes, weeks } from '../lib/utils/time';
import {
  useClick,
  useFloating,
  useHover,
  useInteractions,
} from '@floating-ui/react';

import './Tooltip/Tooltip.scss';

function TimeWithTooltip({
  dateTime,
  ...timeElementOptions
}: JSX.IntrinsicElements['time']) {
  const [isOpen, setIsOpen] = useState(false);
  const { context, refs, floatingStyles } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: 'top',
  });
  const hover = useHover(context, { mouseOnly: true });
  const click = useClick(context, { ignoreMouse: true, toggle: true });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    click,
  ]);
  return (
    <>
      <time
        dateTime={dateTime}
        {...timeElementOptions}
        ref={refs.setReference}
        {...getReferenceProps()}
      />
      {isOpen && (
        <div
          className="popover page-card py-2 px-3"
          ref={refs.setFloating}
          style={{ ...floatingStyles, borderRadius: '0.25rem' }}
          {...getFloatingProps()}
        >
          {dateTime
            ? new Date(dateTime).toLocaleString('en', {
                dateStyle: 'long',
                timeStyle: 'medium',
              })
            : ''}
        </div>
      )}
    </>
  );
}

export function RelativeTime({
  timestamp,
  options: { localeMatcher, numeric = 'auto', style = 'long' } = {},
  ...timeElementOptions
}: JSX.IntrinsicElements['time'] & {
  timestamp?: string | number | Date;
  options?: Partial<Intl.RelativeTimeFormatOptions>;
}) {
  const relativeTimeFormatter = useMemo(() => {
    return new Intl.RelativeTimeFormat('en', {
      localeMatcher,
      numeric,
      style,
    });
  }, [localeMatcher, numeric, style]);

  const [displayValue, displayUnits] = useMemo<
    [number, Intl.RelativeTimeFormatUnit]
  >(() => {
    if (!timestamp) {
      return [0, 'minutes'];
    }
    const msSinceNow = new Date(timestamp).valueOf() - Date.now();
    const diff = Math.abs(msSinceNow);
    switch (true) {
      case diff < 60 * minutes:
        return [msSinceNow / minutes, 'minutes'];
      case diff < 24 * hours:
        return [msSinceNow / hours, 'hours'];
      case diff < 365 * days:
        return [msSinceNow / days, 'days'];
      default:
        return [msSinceNow / weeks, 'weeks'];
    }
  }, [timestamp]);

  return timestamp !== undefined ? (
    <TimeWithTooltip
      dateTime={new Date(timestamp).toISOString()}
      {...timeElementOptions}
    >
      {relativeTimeFormatter.format(Math.round(displayValue), displayUnits)}
    </TimeWithTooltip>
  ) : null;
}
