import { useMemo } from 'react';
import useTokens, { matchTokens, useTokensWithIbcInfo } from './useTokens';
import { useBankBalances } from '../indexerProvider';

export default function useUserTokens() {
  const tokenList = useTokensWithIbcInfo(useTokens());

  const { data: balances } = useBankBalances();
  return useMemo(() => {
    return balances
      ? tokenList.filter((token) => {
          return balances.find((balance) => {
            return matchTokens(balance.token, token);
          });
        })
      : [];
  }, [tokenList, balances]);
}
