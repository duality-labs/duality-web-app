const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

const milliseconds = 1;
const seconds = 1000 * milliseconds;
const minutes = 60 * seconds;
const hours = 60 * minutes;
const days = 24 * hours;
const weeks = 7 * days;

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
