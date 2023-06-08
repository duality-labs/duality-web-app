import useSWR from 'swr';

import StatCard from '../cards/StatCard';

import { TimeSeriesPage, getLastDataChanges, getLastDataValues } from './utils';
import { Token } from '../../lib/web3/utils/tokens';
import { formatPercentage } from '../../lib/utils/number';

const { NODE_ENV, REACT_APP__INDEXER_API = '' } = process.env;

export default function StatCardVolatility({
  tokenA,
  tokenB,
}: {
  tokenA: Token;
  tokenB: Token;
}) {
  const { data } = useSWR<TimeSeriesPage>(
    `${REACT_APP__INDEXER_API}/stats/volatility/${tokenA?.address}/${
      tokenB?.address
    }${NODE_ENV === 'development' ? '?strict=false' : ''}`,
    async (url) => {
      const response = await fetch(url);
      return response.json();
    }
  );

  const [volatility] = getLastDataValues(data?.data);
  const [volatilityDiff] = getLastDataChanges(data?.data);

  return (
    <StatCard loading={!data} header="Volatility (10d)" change={volatilityDiff}>
      {volatility !== undefined ? formatPercentage(volatility) : undefined}
    </StatCard>
  );
}
