import BigNumber from 'bignumber.js';

import './ValueBar.scss';

export default function ValueBar({
  className,
  variant,
  width = 50,
  value = 0,
  maxValue = 0,
}: {
  className?: string | false;
  width?: number;
  variant: 'green' | 'blue' | 'red';
  value: BigNumber.Value | undefined;
  maxValue: BigNumber.Value | undefined;
}) {
  const percent = new BigNumber(value).dividedBy(maxValue).toNumber();
  return (
    <div
      className={['value-bar', `value-bar--${variant}`, className]
        .filter(Boolean)
        .join(' ')}
      style={{
        width: percent * width || 0,
      }}
    ></div>
  );
}
