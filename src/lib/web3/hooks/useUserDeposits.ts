import { useMemo } from 'react';
import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { dualitylabs } from '@duality-labs/dualityjs';
import { QueryAllUserDepositsResponse } from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/dex/query';
import { useDeepCompareMemoize } from 'use-deep-compare-effect';

import { useWeb3 } from '../useWeb3';
import { TokenIdPair, TokenPair, resolveTokenIdPair } from '../utils/tokens';
import { minutes } from '../../utils/time';

const { REACT_APP__REST_API = '' } = process.env;

export function useUserDeposits(): UseQueryResult<
  QueryAllUserDepositsResponse | undefined
> {
  const { address } = useWeb3();

  const result = useQuery({
    queryKey: ['user-deposits', address],
    enabled: !!address,
    queryFn: async (): Promise<QueryAllUserDepositsResponse | undefined> => {
      if (address) {
        // get LCD client
        const lcd = await dualitylabs.ClientFactory.createLCDClient({
          restEndpoint: REACT_APP__REST_API,
        });
        // get all user's deposits
        return lcd.dualitylabs.duality.dex.userDepositsAll({
          address,
        });
      }
    },
    refetchInterval: 5 * minutes,
  });

  return result;
}

export function useUserDepositsOfTokenPair(
  tokenPair: TokenPair | TokenIdPair | undefined
): UseQueryResult<QueryAllUserDepositsResponse | undefined> {
  const [tokenIdA, tokenIdB] = resolveTokenIdPair(tokenPair);

  const result = useUserDeposits();
  const userDeposits = useDeepCompareMemoize(result.data?.Deposits);
  const userDepositsOfTokenPair = useMemo(() => {
    if (tokenIdA && tokenIdB) {
      const tokenIDs = [tokenIdA, tokenIdB];
      return userDeposits?.filter((deposit) => {
        return (
          tokenIDs.includes(deposit.pairID.token0) &&
          tokenIDs.includes(deposit.pairID.token1)
        );
      });
    }
  }, [tokenIdA, tokenIdB, userDeposits]);

  return {
    ...result,
    data: userDepositsOfTokenPair
      ? { Deposits: userDepositsOfTokenPair }
      : undefined,
  } as UseQueryResult<QueryAllUserDepositsResponse | undefined>;
}
