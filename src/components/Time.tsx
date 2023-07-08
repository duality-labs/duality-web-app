import { Ref, forwardRef, useMemo } from 'react';
import { days, hours, minutes, weeks } from '../lib/utils/time';
import PopOver from './PopOver/PopOver';

type RelativeTimeProps = JSX.IntrinsicElements['time'] & {
  timestamp?: string | number | Date;
  options?: Partial<Intl.RelativeTimeFormatOptions>;
  ref?: Ref<HTMLTimeElement>;
};

export const RelativeTime = forwardRef(function RelativeTimeComponent(
  {
    timestamp,
    options: { localeMatcher, numeric = 'auto', style = 'long' } = {},
    ...timeElementOptions
  }: RelativeTimeProps,
  ref: Ref<HTMLTimeElement>
) {
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
    <time
      ref={ref}
      dateTime={new Date(timestamp).toISOString()}
      {...timeElementOptions}
    >
      {relativeTimeFormatter.format(Math.round(displayValue), displayUnits)}
    </time>
  ) : null;
});

export function RelativeAndAbsoluteTime({
  timestamp,
  ...relativeTimeProps
}: RelativeTimeProps) {
  return timestamp !== undefined ? (
    <PopOver
      floating={
        <div className="popover page-card py-2 px-3">
          {timestamp
            ? new Date(timestamp).toLocaleString('en', {
                dateStyle: 'long',
                timeStyle: 'medium',
              })
            : ''}
        </div>
      }
    >
      <RelativeTime timestamp={timestamp} {...relativeTimeProps} />
    </PopOver>
  ) : null;
}
