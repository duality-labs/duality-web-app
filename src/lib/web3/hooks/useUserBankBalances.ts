import { useMemo } from 'react';
import { Token, getDenomAmount } from '../utils/tokens';
import { useBankBalances } from '../indexerProvider';

// note: if dealing with IBC tokens, ensure Token has IBC context
//       (by fetching it with useTokensWithIbcInfo)
function useBankBalance(token: Token | undefined) {
  const { data: balances, ...rest } = useBankBalances();
  const balance = useMemo(() => {
    // find the balance that matches the token
    return token && balances?.find((balance) => balance.token === token);
  }, [balances, token]);
  return { data: balance, ...rest };
}

// the bank balances may be in denoms that are neither base or display units
// convert them to base or display units with the following handler functions
export function useBankBalanceBaseAmount(token: Token | undefined) {
  const { data: balance, ...rest } = useBankBalance(token);
  const balanceAmount = useMemo(() => {
    return (
      balance &&
      getDenomAmount(
        balance.token,
        balance.amount,
        balance.denom,
        balance.token.base
      )
    );
  }, [balance]);
  return { data: balanceAmount, ...rest };
}
export function useBankBalanceDisplayAmount(token: Token | undefined) {
  const { data: balance, ...rest } = useBankBalance(token);
  const balanceAmount = useMemo(() => {
    return (
      balance &&
      getDenomAmount(
        balance.token,
        balance.amount,
        balance.denom,
        balance.token.display
      )
    );
  }, [balance]);
  return { data: balanceAmount, ...rest };
}
