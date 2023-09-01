import { useEffect } from 'react';
import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { dualitylabs } from '@duality-labs/dualityjs';
import type {
  GaugeStatus,
  GetFutureRewardEstimateResponse,
  GetGaugesRequest,
  GetGaugesResponse,
} from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/incentives/query';
import { Gauge } from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/incentives/gauge';
import { Coin } from '@duality-labs/dualityjs/types/codegen/cosmos/base/v1beta1/coin';

import subscriber from '../subscriptionManager';
import { ValuedUserPositionDepositContext } from './useUserShareValues';
import { minutes } from '../../utils/time';

const {
  REACT_APP__REST_API = '',
  REACT_APP__WEBSOCKET_SUBSCRIPTION_LIMIT = '',
} = process.env;

export default function useIncentiveGauges({
  // convert string to enum due to not being able to import enum directly
  status = '1' as unknown as GaugeStatus.ACTIVE,
}: Pick<
  Partial<GetGaugesRequest>,
  'status'
> = {}): UseQueryResult<GetGaugesResponse> {
  const result = useQuery({
    queryKey: ['incentives', status],
    queryFn: async (): Promise<GetGaugesResponse> => {
      // get incentives LCD client
      const lcd = await dualitylabs.ClientFactory.createLCDClient({
        restEndpoint: REACT_APP__REST_API,
      });
      // get gauges
      // denom string is required but we will not use it in the app
      return lcd.dualitylabs.duality.incentives.getGauges({
        status,
        denom: '',
      });
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

    // don't always update in real-time due to max_subscriptions_per_client
    // concerns of websocket subscriptions
    if (Number(REACT_APP__WEBSOCKET_SUBSCRIPTION_LIMIT) > 5) {
      subscriber.subscribeMessage(updateGauges, createGaugeMsgMatch);
      subscriber.subscribeMessage(updateGauges, updatedGaugeMsgMatch);

      return () => {
        subscriber.unsubscribeMessage(updateGauges, createGaugeMsgMatch);
        subscriber.unsubscribeMessage(updateGauges, updatedGaugeMsgMatch);
      };
    }

    function updateGauges() {
      result.refetch();
    }
  }, [result]);

  return result;
}

function isIncentiveMatch(
  userPosition: ValuedUserPositionDepositContext,
  incentiveGauge: Gauge
): boolean {
  const { pairID, startTick, endTick } = incentiveGauge.distributeTo || {};
  if (pairID && startTick !== undefined && endTick !== undefined) {
    return (
      // is this the correct tick pair?
      pairID.token0 === userPosition.token0.address &&
      pairID.token1 === userPosition.token1.address &&
      // are ticks within bounds?
      userPosition.deposit.lowerTickIndex1To0.greaterThanOrEqual(startTick) &&
      userPosition.deposit.upperTickIndex1To0.lessThanOrEqual(endTick)
    );
  }
  return false;
}

export function useMatchIncentives(
  userPositionOrUserPositions:
    | ValuedUserPositionDepositContext
    | ValuedUserPositionDepositContext[]
): Gauge[] | undefined {
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

/**
 * Example usage:
  const { address } = useWeb3();
  const stakeIDs = useMemo(() => {
    const stakeIDs = currentStakes
      .map((stake) => stake.stakeContext?.ID)
      .map((stakeID) => Number(stakeID))
      .filter((stakeID): stakeID is number => stakeID > 0);
    return Array.from(new Set(stakeIDs));
  }, [currentStakes]);
  const futureRewards = useFutureRewardsEstimate(address, stakeIDs);
 */
export function useFutureRewardsEstimate(
  web3Address: string | null,
  stakeIDs: number[],
  endEpoch = 365
): Coin[] | undefined {
  const { data } = useQuery({
    queryKey: ['future-rewards-estimate', web3Address, stakeIDs, endEpoch],
    queryFn: async (): Promise<GetFutureRewardEstimateResponse | undefined> => {
      // get incentives LCD client
      const lcd = await dualitylabs.ClientFactory.createLCDClient({
        restEndpoint: REACT_APP__REST_API,
      });
      /*
       * note: you would expect the follow to work, but it mangles the query
       * parameters into a form that isn't accepted by the API:
       *
       *   lcd.duality.incentives.getFutureRewardEstimate({
       *    owner: web3Address,
       *    stakeIDs: stakeIDs.map((stakeID) => Long.fromNumber(stakeID)),
       *    endEpoch: Long.fromNumber(endEpoch),
       *  })
       *
       * instead we will create the query string ourself and add the return type
       */

      // create Query string (with all appropriate characters escaped)
      const queryParams = new URLSearchParams({
        endEpoch: endEpoch.toFixed(0),
      });

      stakeIDs.forEach((stakeID) => {
        queryParams.append('stakeIDs', stakeID.toFixed(0));
      });

      // get estimate
      return web3Address
        ? lcd.dualitylabs.duality.incentives.req.get(
            `dualitylabs/duality/incentives/v1beta1/future_rewards_estimate/${web3Address}?${queryParams}`
          )
        : undefined;
    },
    refetchInterval: 5 * minutes,
  });

  return data?.coins;
}
