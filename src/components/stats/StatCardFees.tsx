import useSWR from 'swr';

import StatCard from '../cards/StatCard';

import { TimeSeriesPage, getLastDataChanges, getLastDataValues } from './utils';
import { useTokenValueTotal } from '../../lib/web3/hooks/useTokens';
import { Token } from '../../lib/web3/utils/tokens';
import { formatCurrency } from '../../lib/utils/number';

const { REACT_APP__INDEXER_API = '' } = process.env;

export default function StatCardFees({
  tokenA,
  tokenB,
}: {
  tokenA: Token;
  tokenB: Token;
}) {
  const { data } = useSWR<TimeSeriesPage>(
    `${REACT_APP__INDEXER_API}/stats/volume/${tokenA?.address}/${tokenB?.address}`,
    async (url) => {
      const response = await fetch(url);
      return response.json();
    }
  );

  const [, , amountA, amountB] = getLastDataValues(data?.data);
  const [, , amountDiffA, amountDiffB] = getLastDataChanges(data?.data);

  const valueTotal = useTokenValueTotal([tokenA, amountA], [tokenB, amountB]);
  const valueDiffTotal = useTokenValueTotal(
    [tokenA, amountDiffA],
    [tokenB, amountDiffB]
  );

  return (
    <StatCard loading={!data} header="Fees (24H)" change={valueDiffTotal}>
      {typeof valueTotal === 'number' ? formatCurrency(valueTotal) : undefined}
    </StatCard>
  );
}
