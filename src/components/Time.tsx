import { useMemo } from 'react';
import { days, hours, minutes, weeks } from '../lib/utils/time';

export function RelativeTime({
  timestamp,
  options: { localeMatcher, numeric = 'auto', style = 'long' } = {},
}: {
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
    <time dateTime={new Date(timestamp).toISOString()}>
      {relativeTimeFormatter.format(Math.round(displayValue), displayUnits)}
    </time>
  ) : null;
}
