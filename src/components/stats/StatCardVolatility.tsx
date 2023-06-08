import StatCard from '../cards/StatCard';

import { useStatVolatility } from './hooks';
import { Token } from '../../lib/web3/utils/tokens';
import { formatStatPercentageValue } from './utils';

export default function StatCardVolatility({
  tokenA,
  tokenB,
}: {
  tokenA: Token;
  tokenB: Token;
}) {
  const [volatility, volatilityDiff] = useStatVolatility(tokenA, tokenB);
  return (
    <StatCard
      loading={volatility === undefined}
      header="Volatility (10d)"
      change={volatilityDiff}
    >
      {formatStatPercentageValue(volatility)}
    </StatCard>
  );
}
