import SmallCard from '../cards/SmallCard';
import { formatPercentage } from '../../lib/utils/number';

import './StatCard.scss';

type SmallCardProps = Parameters<typeof SmallCard>[0];

export default function StatCard({
  change,
  className,
  loading = false,
  header,
  children,
  body = children,
}: {
  loading?: boolean;
  change: number | string | null | undefined;
} & Omit<SmallCardProps, 'footer'>) {
  const customClassName = ['stat-card', className].filter(Boolean).join(' ');
  if (loading) {
    return (
      <SmallCard className={customClassName} header={header} footer="&nbsp;">
        ...
      </SmallCard>
    );
  }
  return (
    <SmallCard
      className={customClassName}
      header={header}
      // handling `undefined` (loading state) and `null` (error state)
      body={body !== undefined ? (body !== null ? body : 'N/A') : '...'}
      footer={
        change !== undefined
          ? change !== null
            ? formatPercentage(change, { minimumSignificantDigits: 3 })
            : 'N/A'
          : '...'
      }
      footerClassName={getFooterClassName(change)}
    />
  );
}

function getFooterClassName(
  change: string | number | null = 0
): string | undefined {
  const changeValue = Number(change);
  if (changeValue > 0) {
    return 'text-success';
  }
  if (changeValue < 0) {
    return 'text-danger';
  }
  return 'text-muted';
}
