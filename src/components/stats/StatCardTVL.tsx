import StatCard from '../cards/StatCard';

import { useStatTVL } from './hooks';
import { Token } from '../../lib/web3/utils/tokens';
import { formatStatTokenValue } from './utils';

export default function StatCardTVL({
  tokenA,
  tokenB,
}: {
  tokenA: Token;
  tokenB: Token;
}) {
  const [, valueTotal, valueDiffTotal] = useStatTVL(tokenA, tokenB);
  return (
    <StatCard
      loading={valueTotal === undefined}
      header="TVL"
      change={valueDiffTotal}
    >
      {formatStatTokenValue(valueTotal)}
    </StatCard>
  );
}
