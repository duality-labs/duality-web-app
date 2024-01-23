import BigNumber from 'bignumber.js';
import { useMemo } from 'react';

import { Token, getDenomAmount } from '../utils/tokens';
import { TokenCoin, useUserBankBalances } from './useUserBankBalances';
import { useSimplePrice } from '../../tokenPrices';

export type TokenCoinWithValue = TokenCoin & {
  value: BigNumber | undefined;
};

// get all the user's bank values (tokens that are not native Dex shares)
export function useUserBankValues(): TokenCoinWithValue[] {
  const { data: balances } = useUserBankBalances();

  // get matched tokens found in the user's balances
  const selectedTokens = useMemo<Token[]>(() => {
    return (balances || []).map<Token>((balance) => balance.token);
  }, [balances]);

  const { data: selectedTokensPrices } = useSimplePrice(selectedTokens);

  return useMemo<TokenCoinWithValue[]>(() => {
    return (balances || []).map((balance) => {
      const { amount, denom, token } = balance;
      const tokenIndex = selectedTokens.indexOf(token);
      const price = selectedTokensPrices[tokenIndex];
      const displayAmount = getDenomAmount(token, amount, denom, token.display);
      const value =
        price !== undefined && !isNaN(price)
          ? new BigNumber(displayAmount || 0).multipliedBy(price)
          : undefined;
      // append value to balance
      return { amount, denom, token, value };
    });
  }, [balances, selectedTokens, selectedTokensPrices]);
}

// calculate total
export function useUserBankValue(): BigNumber {
  const allUserBankValues = useUserBankValues();

  return useMemo(() => {
    return (allUserBankValues || []).reduce((result, { value }) => {
      if (!value) return result;
      return result.plus(value);
    }, new BigNumber(0));
  }, [allUserBankValues]);
}
