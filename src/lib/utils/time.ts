const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
// use user's local settings to format Date string
const dateTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'short',
  timeStyle: 'medium',
});

export const milliseconds = 1;
export const microseconds = milliseconds / 1000;
export const nanoseconds = microseconds / 1000;

export const seconds = 1000 * milliseconds;
export const minutes = 60 * seconds;
export const hours = 60 * minutes;
export const days = 24 * hours;
export const weeks = 7 * days;

export const timeUnits = {
  nanoseconds,
  microseconds,
  milliseconds,
  seconds,
  minutes,
  hours,
  days,
  weeks,
};

export function formatDateTime(timestamp: string) {
  const time = new Date(timestamp);
  return dateTime.format(time);
}

export function formatRelativeTime(timestamp: string) {
  const now = new Date();
  const time = new Date(timestamp);
  const diff = time.valueOf() - now.valueOf();
  const diffAbs = Math.abs(diff);

  switch (true) {
    case diffAbs > weeks:
      return rtf.format(Math.floor(diff / weeks), 'weeks');
    case diffAbs > days:
      return rtf.format(Math.floor(diff / days), 'days');
    case diffAbs > hours:
      return rtf.format(Math.floor(diff / hours), 'hours');
    case diffAbs > minutes:
      return rtf.format(Math.floor(diff / minutes), 'minutes');
    default:
      return rtf.format(Math.floor(diff / seconds), 'seconds');
  }
}
