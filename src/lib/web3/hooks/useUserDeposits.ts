import { useMemo } from 'react';
import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { dualitylabs } from '@duality-labs/dualityjs';
import { DepositRecord } from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/dex/deposit_record';
import { useDeepCompareMemoize } from 'use-deep-compare-effect';

import { useWeb3 } from '../useWeb3';
import { TokenIdPair, TokenPair, resolveTokenIdPair } from '../utils/tokens';
import { minutes } from '../../utils/time';

const { REACT_APP__REST_API = '' } = process.env;

export function useUserDeposits(): UseQueryResult<DepositRecord[] | undefined> {
  const { address } = useWeb3();

  const result = useQuery({
    queryKey: ['user-deposits', address],
    enabled: !!address,
    queryFn: async (): Promise<DepositRecord[] | undefined> => {
      if (address) {
        // get LCD client
        const lcd = await dualitylabs.ClientFactory.createLCDClient({
          restEndpoint: REACT_APP__REST_API,
        });
        // get all user's deposits
        const response = await lcd.dualitylabs.duality.dex.userDepositsAll({
          address,
        });
        // return unwrapped result
        return response.Deposits;
      }
    },
    refetchInterval: 5 * minutes,
  });

  return result;
}

export function useUserDepositsOfTokenPair(
  tokenPair: TokenPair | TokenIdPair | undefined
): UseQueryResult<DepositRecord[] | undefined> {
  const tokenPairIDs = useDeepCompareMemoize(resolveTokenIdPair(tokenPair));

  const result = useUserDeposits();
  const userDeposits = useDeepCompareMemoize(result.data);
  const userDepositsOfTokenPair = useMemo(() => {
    // if a pair ID request was given then filter the response
    if (tokenPairIDs) {
      const [tokenIdA, tokenIdB] = tokenPairIDs || [];
      if (tokenIdA && tokenIdB) {
        const tokenIDs = [tokenIdA, tokenIdB];
        return userDeposits?.filter((deposit) => {
          return (
            tokenIDs.includes(deposit.pairID.token0) &&
            tokenIDs.includes(deposit.pairID.token1)
          );
        });
      }
      // return filtered deposits with no match
      return [];
    }
    // return unfiltered deposits with all matches
    return userDeposits;
  }, [tokenPairIDs, userDeposits]);

  return {
    ...result,
    data: userDepositsOfTokenPair,
  } as UseQueryResult<DepositRecord[] | undefined>;
}
