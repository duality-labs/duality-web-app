import StatCard from '../cards/StatCard';

import { useStatVolume } from './hooks';
import { Token } from '../../lib/web3/utils/tokens';
import { formatStatTokenValue } from './utils';

export default function StatCardVolume({
  tokenA,
  tokenB,
}: {
  tokenA: Token;
  tokenB: Token;
}) {
  const [valueTotal, valueDiffTotal] = useStatVolume(tokenA, tokenB);
  return (
    <StatCard
      loading={valueTotal === undefined}
      header="Volume (24H)"
      change={valueDiffTotal}
    >
      {formatStatTokenValue(valueTotal)}
    </StatCard>
  );
}
