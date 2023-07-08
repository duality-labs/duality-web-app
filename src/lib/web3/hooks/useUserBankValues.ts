import { CoinSDKType } from '@duality-labs/dualityjs/types/codegen/cosmos/base/v1beta1/coin';
import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import { Token, getAmountInDenom } from '../utils/tokens';
import { useBankBalances } from '../indexerProvider';
import useTokens, { matchTokenByDenom } from './useTokens';
import { useSimplePrice } from '../../tokenPrices';

type TokenCoin = CoinSDKType & {
  token: Token;
  value: BigNumber | undefined;
};

// get all the user's bank values (tokens that are not Duality Dex shares)
export function useUserBankValues(): TokenCoin[] {
  const { data: balances } = useBankBalances();

  const allTokens = useTokens();
  const selectedTokens = useMemo<Token[]>(() => {
    // note: this could be better: we are just finding the first match in the chain registry
    // with that denom, but really it needs to check for chain id too
    // ibc tokens will need to be checked here too
    // this should probably live in the indexerData as we'll always want the filtered balances
    return (balances || []).reduce<Token[]>((result, balance) => {
      const token = allTokens.find(matchTokenByDenom(balance.denom));
      if (token) {
        result.push(token);
      }
      return result;
    }, []);
  }, [balances, allTokens]);

  const { data: selectedTokensPrices } = useSimplePrice(selectedTokens);

  return useMemo<TokenCoin[]>(() => {
    return (balances || [])
      .map(({ amount, denom }) => {
        const tokenIndex = selectedTokens.findIndex(matchTokenByDenom(denom));
        const token = selectedTokens[tokenIndex] as Token | undefined;
        const price = selectedTokensPrices[tokenIndex];
        const value =
          token &&
          new BigNumber(
            getAmountInDenom(token, amount, denom, token.display) || 0
          ).multipliedBy(price || 0);
        return token ? { amount, denom, token, value } : null;
      })
      .filter((v): v is TokenCoin => !!v);
  }, [balances, selectedTokens, selectedTokensPrices]);
}

// calculate total
export function useUserBankValue(): BigNumber {
  const allUserBankAssets = useUserBankValues();

  return useMemo(
    () =>
      (allUserBankAssets || []).reduce((result, { value }) => {
        if (!value) return result;
        return result.plus(value);
      }, new BigNumber(0)),
    [allUserBankAssets]
  );
}
