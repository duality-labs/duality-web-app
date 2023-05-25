import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { createRpcQueryHooks } from '@duality-labs/dualityjs';
import { QuerySupplyOfRequest } from '@duality-labs/dualityjs/types/codegen/cosmos/bank/v1beta1/query';
import { DepositRecord } from '@duality-labs/dualityjs/types/codegen/duality/dex/deposit_record';
import { UserPositionsSDKType } from '@duality-labs/dualityjs/types/codegen/duality/dex/user_positions';
import {
  QueryGetPoolReservesRequest,
  QueryGetUserPositionsResponseSDKType,
} from '@duality-labs/dualityjs/types/codegen/duality/dex/query';

import { useWeb3 } from '../useWeb3';
import { useRpc } from '../rpcQueryClient';
import { useLcdClient } from '../lcdClient';
import { getPairID } from '../utils/pairs';
import {
  TokenAddress,
  TokenAddressPair,
  TokenPair,
  getTokenAddressPair,
} from '../utils/tokens';

// default useUserPositionsTotalShares filter to all user's deposits
const defaultFilter = () => true;

// select all (or optional token pair list of) user shares
export function useUserDeposits(
  poolDepositFilter: (poolDeposit: DepositRecord) => boolean = defaultFilter
) {
  const { address } = useWeb3();
  const rpc = useRpc();
  const queryHooks = createRpcQueryHooks({ rpc });

  const { useGetUserPositions } = queryHooks.dualitylabs.duality.dex;

  const { data: { UserPositions: userPositions } = {} } =
    useGetUserPositions<QueryGetUserPositionsResponseSDKType>({
      request: { address: address || '' },
    });

  // return filtered list of deposits
  return userPositions?.PoolDeposits?.filter(poolDepositFilter);
}

// select all (or optional token pair list of) user shares
export function useUserPositionsTotalShares(
  poolDepositFilter: (poolDeposit: DepositRecord) => boolean = defaultFilter
) {
  const lcdClient = useLcdClient();
  const selectedPoolDeposits = useUserDeposits(poolDepositFilter) || [];

  return useQueries({
    queries: [
      ...selectedPoolDeposits.flatMap(
        ({ pairID: { token0, token1 } = {}, centerTickIndex, fee }) => {
          if (token0 && token1) {
            const params: QuerySupplyOfRequest = {
              denom: `DualityPoolShares-${token0}-${token1}-t${centerTickIndex}-f${fee}`,
            };
            return {
              queryKey: ['cosmos.bank.v1beta1.supplyOf', params],
              queryFn: async () =>
                lcdClient?.cosmos.bank.v1beta1.supplyOf(params),
              staleTime: 10e3,
            };
          }
          return [];
        }
      ),
    ],
  });
}

// select a single token pair of user shares
export function useUserPositionsTotalSharesPair(
  tokenPair: TokenPair | TokenAddressPair
) {
  const [token0Address, token1Address] = getTokenAddressPair(tokenPair);
  const userShares = useUserPositionsTotalShares(
    (poolDeposit: DepositRecord) => {
      return (
        !!token0Address &&
        !!token1Address &&
        poolDeposit.pairID?.token0 === token0Address &&
        poolDeposit.pairID?.token1 === token1Address
      );
    }
  );
  return userShares[0];
}

// select all (or optional token pair list of) user reserves
export function useUserPositionsTotalReserves(
  poolDepositFilter: (poolDeposit: DepositRecord) => boolean = defaultFilter
) {
  const lcdClient = useLcdClient();
  const selectedPoolDeposits = useUserDeposits(poolDepositFilter) || [];

  return useQueries({
    queries: [
      ...selectedPoolDeposits.flatMap(
        ({
          pairID: { token0, token1 } = {},
          lowerTickIndex,
          upperTickIndex,
          fee,
        }) => {
          const pairID = getPairID(token0, token1);
          if (token0 && token1 && pairID && fee !== undefined) {
            // return both upper and lower tick pools
            return [
              { tokenIn: token0, tickIndex: lowerTickIndex },
              { tokenIn: token1, tickIndex: upperTickIndex },
            ].map(({ tokenIn, tickIndex }) => {
              const params: QueryGetPoolReservesRequest = {
                pairID,
                tokenIn,
                tickIndex,
                fee,
              };
              return {
                queryKey: ['dualitylabs.duality.dex.poolReserves', params],
                queryFn: async () =>
                  lcdClient?.dualitylabs.duality.dex.poolReserves(params),
                // don't retry, a 404 means there is 0 liquidity there
                retry: false,
                // refetch not that often
                staleTime: 60 * 1e3,
              };
            });
          }
          return [];
        }
      ),
    ],
  });
}

interface ShareValueContext {
  sharesOwned: BigNumber;
  totalShares: BigNumber;
  token: TokenAddress;
  tickIndex: BigNumber;
  reserves: BigNumber;
}
export interface UserPositionDepositContext {
  deposit: UserPositionsSDKType['PoolDeposits'][0];
  context: ShareValueContext;
}

// collect all the context about the user's positions together
export function useUserPositionsContext(
  poolDepositFilter: (poolDeposit: DepositRecord) => boolean = defaultFilter
): UserPositionDepositContext[] {
  const selectedPoolDeposits = useUserDeposits(poolDepositFilter);
  const userPositionsTotalShares =
    useUserPositionsTotalShares(poolDepositFilter);
  const userPositionsTotalReserves =
    useUserPositionsTotalReserves(poolDepositFilter);

  return useMemo<UserPositionDepositContext[]>(() => {
    return (selectedPoolDeposits || []).flatMap<UserPositionDepositContext>(
      (deposit) => {
        const totalSharesResponse = userPositionsTotalShares.find(
          ({ data }) => {
            return !!data;
          }
        );

        // find the upper and lower reserves that match this position
        const lowerReserveResponse = userPositionsTotalReserves.find(
          ({ data }) => {
            return (
              data?.poolReserves?.tokenIn === deposit.pairID?.token0 &&
              data?.poolReserves?.pairID?.token0 === deposit.pairID?.token0 &&
              data?.poolReserves?.pairID?.token1 === deposit.pairID?.token1 &&
              data?.poolReserves?.tickIndex.toString() ===
                deposit.lowerTickIndex.toString() &&
              data?.poolReserves?.fee.toString() === deposit.fee.toString()
            );
          }
        );
        const upperReserveResponse = userPositionsTotalReserves.find(
          ({ data }) => {
            return (
              data?.poolReserves?.tokenIn === deposit.pairID?.token1 &&
              data?.poolReserves?.pairID?.token0 === deposit.pairID?.token0 &&
              data?.poolReserves?.pairID?.token1 === deposit.pairID?.token1 &&
              data?.poolReserves?.tickIndex.toString() ===
                deposit.upperTickIndex.toString() &&
              data?.poolReserves?.fee.toString() === deposit.fee.toString()
            );
          }
        );
        // collect context of both side of the liquidity
        return [
          ...(totalSharesResponse && lowerReserveResponse
            ? [
                {
                  deposit,
                  context: {
                    sharesOwned: new BigNumber(deposit.sharesOwned),
                    totalShares: new BigNumber(
                      totalSharesResponse?.data?.amount?.amount ?? 0
                    ),
                    token:
                      lowerReserveResponse.data?.poolReserves?.tokenIn ?? '',
                    tickIndex: new BigNumber(
                      lowerReserveResponse.data?.poolReserves?.tickIndex.toString() ??
                        0
                    ),
                    reserves: new BigNumber(
                      lowerReserveResponse.data?.poolReserves?.reserves ?? 0
                    ),
                  },
                },
              ]
            : []),
          ...(totalSharesResponse && upperReserveResponse
            ? [
                {
                  deposit,
                  context: {
                    sharesOwned: new BigNumber(deposit.sharesOwned),
                    totalShares: new BigNumber(
                      totalSharesResponse?.data?.amount?.amount ?? 0
                    ),
                    token:
                      upperReserveResponse.data?.poolReserves?.tokenIn ?? '',
                    tickIndex: new BigNumber(
                      upperReserveResponse.data?.poolReserves?.tickIndex.toString() ??
                        0
                    ),
                    reserves: new BigNumber(
                      upperReserveResponse.data?.poolReserves?.reserves ?? 0
                    ),
                  },
                },
              ]
            : []),
        ];
      }
    );
  }, [
    selectedPoolDeposits,
    userPositionsTotalShares,
    userPositionsTotalReserves,
  ]);
}
