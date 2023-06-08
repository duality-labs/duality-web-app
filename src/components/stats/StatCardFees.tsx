import StatCard from '../cards/StatCard';

import { useStatFee } from './hooks';
import { Token } from '../../lib/web3/utils/tokens';
import { formatStatTokenValue } from './utils';

export default function StatCardFees({
  tokenA,
  tokenB,
}: {
  tokenA: Token;
  tokenB: Token;
}) {
  const [valueTotal, valueDiffTotal] = useStatFee(tokenA, tokenB);
  return (
    <StatCard
      loading={valueTotal === undefined}
      header="Fees (24H)"
      change={valueDiffTotal}
    >
      {formatStatTokenValue(valueTotal)}
    </StatCard>
  );
}
