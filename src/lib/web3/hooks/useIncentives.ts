import { useEffect } from 'react';
import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { duality } from '@duality-labs/dualityjs';
import type {
  GaugeStatus,
  GetGaugesRequest,
  GetGaugesResponseSDKType,
} from '@duality-labs/dualityjs/types/codegen/duality/incentives/query';
import { GaugeSDKType } from '@duality-labs/dualityjs/types/codegen/duality/incentives/gauge';

import subscriber from '../subscriptionManager';
import { ValuedUserPositionDepositContext } from './useUserShareValues';
import { minutes } from '../../utils/time';

const { REACT_APP__REST_API = '' } = process.env;

export default function useIncentiveGauges({
  // convert string to enum due to not being able to import enum directly
  status = '1' as unknown as GaugeStatus.ACTIVE,
}: Pick<
  Partial<GetGaugesRequest>,
  'status'
> = {}): UseQueryResult<GetGaugesResponseSDKType> {
  const result = useQuery({
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
    refetchInterval: 5 * minutes,
  });

  useEffect(() => {
    const createGaugeMsgMatch = {
      message: { action: '/duality.incentives.MsgCreateGauge' },
    };
    const updatedGaugeMsgMatch = {
      message: { action: '/duality.incentives.MsgAddToGauge' },
    };
    subscriber.subscribeMessage(updateGauges, createGaugeMsgMatch);
    subscriber.subscribeMessage(updateGauges, updatedGaugeMsgMatch);

    return () => {
      subscriber.unsubscribeMessage(updateGauges, createGaugeMsgMatch);
      subscriber.unsubscribeMessage(updateGauges, updatedGaugeMsgMatch);
    };

    function updateGauges() {
      result.refetch();
    }
  }, [result]);

  return result;
}

function isIncentiveMatch(
  userPosition: ValuedUserPositionDepositContext,
  incentiveGauge: GaugeSDKType
): boolean {
  const { pairID, startTick, endTick } = incentiveGauge.distribute_to || {};
  if (pairID && startTick !== undefined && endTick !== undefined) {
    return (
      // is this the correct tick pair?
      pairID.token0 === userPosition.token0.address &&
      pairID.token1 === userPosition.token1.address &&
      // are ticks within bounds?
      userPosition.deposit.lowerTickIndex.greaterThanOrEqual(startTick) &&
      userPosition.deposit.upperTickIndex.lessThanOrEqual(endTick)
    );
  }
  return false;
}

export function useMatchIncentives(
  userPositionOrUserPositions:
    | ValuedUserPositionDepositContext
    | ValuedUserPositionDepositContext[]
): GaugeSDKType[] | undefined {
  const userPositions = Array.isArray(userPositionOrUserPositions)
    ? userPositionOrUserPositions
    : [userPositionOrUserPositions];
  const { data: incentives } = useIncentiveGauges();

  if (incentives !== undefined) {
    return incentives.gauges.filter((gauge) => {
      return userPositions.some((userPosition) => {
        return isIncentiveMatch(userPosition, gauge);
      });
    });
  }

  return undefined;
}
