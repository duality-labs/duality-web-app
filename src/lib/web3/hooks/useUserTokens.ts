import { useMemo } from 'react';
import { useUserBankBalances } from './useUserBankBalances';

export default function useUserTokens() {
  const { data: balances } = useUserBankBalances();
  return useMemo(() => {
    return balances?.map((balance) => balance.token) ?? [];
  }, [balances]);
}
