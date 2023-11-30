import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { dualitylabs } from '@duality-labs/dualityjs';
import { QueryAllUserDepositsResponse } from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/dex/query';

import { useWeb3 } from '../useWeb3';
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
