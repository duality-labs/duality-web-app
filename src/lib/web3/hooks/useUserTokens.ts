import { useMemo } from 'react';
import { useBankBalances } from '../indexerProvider';

export default function useUserTokens() {
  const { data: balances } = useBankBalances();
  return useMemo(() => {
    return balances?.map((balance) => balance.token) ?? [];
  }, [balances]);
}
