import BigNumber from 'bignumber.js';
import { useEffect, useMemo } from 'react';

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
    console.log('useUserBankValue: useUserBankBalances', balances);
    return (balances || []).map<Token>((balance) => balance.token);
  }, [balances]);

  const { data: selectedTokensPrices } = useSimplePrice(selectedTokens);

  useMemo(() => console.log('useUserBankValue: selectedTokens', selectedTokens), [selectedTokens])
  useMemo(() => console.log('useUserBankValue: selectedTokensPrices', selectedTokensPrices), [selectedTokensPrices])

  const allUserBankValues = useMemo<TokenCoinWithValue[]>(() => {
    console.log('useUserBankValue: balances', {balances, selectedTokens, selectedTokensPrices });
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

  useMemo(() => console.log('useUserBankValue: allUserBankAssets', allUserBankValues.map(a => a.value?.toNumber())), [allUserBankValues])

  return allUserBankValues;
}

// calculate total
export function useUserBankValue(): BigNumber {
  const allUserBankValues = useUserBankValues();
  // return (allUserBankValues || []).reduce((result, { value }) => {
  //   if (!value) return result;
  //   return result.plus(value);
  // }, new BigNumber(0));
  useMemo(() => console.log('useUserBankValue: allUserBankAssets2', allUserBankValues.map(a => a.value?.toNumber())), [allUserBankValues])

  return useMemo(() => {
    console.log('useUserBankValue: allUserBankAssets3', allUserBankValues.map(a => a.value?.toNumber()), allUserBankValues);
    return (allUserBankValues || []).reduce((result, { value }) => {
      if (!value) return result;
      return result.plus(value);
    }, new BigNumber(0));
  }, [allUserBankValues]);
}
