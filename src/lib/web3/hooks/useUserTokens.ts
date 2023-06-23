import { useMemo } from 'react';
import useTokens from './useTokens';
import { useUserBankValues } from './useUserBankValues';

export default function useUserTokens() {
  const tokenList = useTokens();

  const allUserBankAssets = useUserBankValues();
  return useMemo(() => {
    return tokenList.filter((token) => {
      return allUserBankAssets.find((userToken) => {
        return userToken.token === token;
      });
    });
  }, [tokenList, allUserBankAssets]);
}
