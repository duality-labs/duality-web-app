import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { duality } from '@duality-labs/dualityjs';
import type {
  GaugeStatus,
  GetGaugesRequest,
  GetGaugesResponseSDKType,
} from '@duality-labs/dualityjs/types/codegen/duality/incentives/query';

const { REACT_APP__REST_API = '' } = process.env;

export default function useIncentiveGauges({
  // convert string to enum due to not being able to import enum directly
  status = '1' as unknown as GaugeStatus.ACTIVE,
}: Pick<
  Partial<GetGaugesRequest>,
  'status'
> = {}): UseQueryResult<GetGaugesResponseSDKType> {
  return useQuery({
    queryKey: ['incentives', status],
    queryFn: async (): Promise<GetGaugesResponseSDKType> => {
      // get incentives LCD client
      const lcd = await duality.ClientFactory.createLCDClient({
        restEndpoint: REACT_APP__REST_API,
      });
      // get gauges
      // denom string is required but we will not use it in the app
      return lcd.duality.incentives.getGauges({ status, denom: '' });
    },
  });
}
