import SmallCard from '../cards/SmallCard';
import { formatPercentage } from '../../lib/utils/number';

import './StatCard.scss';

type SmallCardProps = Parameters<typeof SmallCard>[0];

export default function StatCard({
  change,
  className,
  ...props
}: {
  change: number | string | undefined;
} & Omit<SmallCardProps, 'footer'>) {
  return (
    <SmallCard
      {...props}
      className={['stat-card', className].filter(Boolean).join(' ')}
      footer={change !== undefined ? formatPercentage(change) : '...'}
      footerClassName={getFooterClassName(change)}
    />
  );
}

function getFooterClassName(change: string | number = 0): string | undefined {
  const changeValue = Number(change);
  if (changeValue > 0) {
    return 'text-success';
  }
  if (changeValue < 0) {
    return 'text-danger';
  }
  return 'text-muted';
}
