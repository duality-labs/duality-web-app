import BigNumber from 'bignumber.js';
import useSWR from 'swr';
import { useCallback } from 'react';

import StatCard from '../cards/StatCard';

import { TimeSeriesPage, getLastDataChanges, getLastDataValues } from './utils';
import { Token, getAmountInDenom } from '../../lib/web3/utils/tokens';
import { useSimplePrice } from '../../lib/tokenPrices';
import { formatCurrency } from '../../lib/utils/number';

const { REACT_APP__INDEXER_API = '' } = process.env;

export default function StatCardTVL({
  tokenA,
  tokenB,
}: {
  tokenA: Token;
  tokenB: Token;
}) {
  const { data } = useSWR<TimeSeriesPage>(
    `${REACT_APP__INDEXER_API}/stats/tvl/${tokenA?.address}/${tokenB?.address}`,
    async (url) => {
      const response = await fetch(url);
      return response.json();
    }
  );

  const {
    data: [priceA, priceB],
  } = useSimplePrice([tokenA, tokenB]);

  const getValue = useCallback(function getValue(
    token: Token,
    amount?: BigNumber.Value,
    price?: number
  ): number | undefined {
    if (amount === undefined || price === undefined) {
      return undefined;
    }
    return new BigNumber(
      getAmountInDenom(token, amount, token.address, token.display) || 0
    )
      .multipliedBy(price || 0)
      .toNumber();
  },
  []);

  const [amountA, amountB] = getLastDataValues(data?.data);

  const valueA = getValue(tokenA, amountA, priceA);
  const valueB = getValue(tokenB, amountB, priceB);
  const valueTotal =
    valueA !== undefined && valueB !== undefined ? valueA + valueB : undefined;

  const [amountDiffA, amountDiffB] = getLastDataChanges(data?.data);

  const valueDiffA = getValue(tokenA, amountDiffA, priceA);
  const valueDiffB = getValue(tokenB, amountDiffB, priceB);
  const valueDiffTotal =
    valueDiffA !== undefined && valueDiffB !== undefined
      ? valueDiffA + valueDiffB
      : undefined;
  return (
    <StatCard loading={!data} header="TVL" change={valueDiffTotal}>
      {valueTotal !== undefined ? formatCurrency(valueTotal) : undefined}
    </StatCard>
  );
}
