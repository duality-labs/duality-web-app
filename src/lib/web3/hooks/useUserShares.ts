import BigNumber from 'bignumber.js';
import Long from 'long';
import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { createRpcQueryHooks } from '@duality-labs/dualityjs';
import {
  QuerySupplyOfRequest,
  QuerySupplyOfResponseSDKType,
} from '@duality-labs/dualityjs/types/codegen/cosmos/bank/v1beta1/query';
import { DepositRecord } from '@duality-labs/dualityjs/types/codegen/duality/dex/deposit_record';
import {
  QueryGetPoolReservesRequest,
  QueryGetPoolReservesResponseSDKType,
  QueryGetUserPositionsResponseSDKType,
} from '@duality-labs/dualityjs/types/codegen/duality/dex/query';

import { useWeb3 } from '../useWeb3';
import { useRpc } from '../rpcQueryClient';
import { useLcdClientPromise } from '../lcdClient';
import { getPairID } from '../utils/pairs';
import {
  Token,
  TokenAddress,
  TokenAddressPair,
  TokenPair,
  getTokenAddressPair,
} from '../utils/tokens';
import useTokens from './useTokens';
import { useShares } from '../indexerProvider';

// default useUserPositionsTotalShares filter to all user's deposits
export type UserDepositFilter = (poolDeposit: DepositRecord) => boolean;
const defaultFilter: UserDepositFilter = () => true;

// todo: use this function when the endpoint is fixed
// select all (or optional token pair list of) user shares
export function useUserDepositsFromPositionsEndpoint(
  poolDepositFilter: UserDepositFilter = defaultFilter
): Required<DepositRecord>[] | undefined {
  const { address } = useWeb3();
  const rpc = useRpc();
  const queryHooks = createRpcQueryHooks({ rpc });

  const { useGetUserPositions } = queryHooks.dualitylabs.duality.dex;

  const { data: { UserPositions: userPositions } = {} } =
    useGetUserPositions<QueryGetUserPositionsResponseSDKType>({
      request: { address: address || '' },
    });

  // return filtered list of deposits
  const filteredDeposits =
    userPositions?.PoolDeposits?.filter(poolDepositFilter);
  // only accept deposits with pairID properties attached (should be always)
  return filteredDeposits?.filter(
    (deposit): deposit is Required<DepositRecord> => !!deposit.pairID
  );
}

// select all (or optional token pair list of) user shares
export function useUserDeposits(
  poolDepositFilter: UserDepositFilter = defaultFilter
): Required<DepositRecord>[] | undefined {
  const { data: shares } = useShares();
  return useMemo(() => {
    const deposits = shares?.map<DepositRecord>(
      ({ fee, pairId, sharesOwned, tickIndex }) => {
        const [token0Address, token1Address] = pairId.split('<>');
        return {
          pairID: { token0: token0Address, token1: token1Address },
          sharesOwned,
          centerTickIndex: Long.fromString(tickIndex),
          lowerTickIndex: Long.fromString(tickIndex).sub(fee),
          upperTickIndex: Long.fromString(tickIndex).add(fee),
          fee: Long.fromString(fee),
        };
      }
    );
    // return filtered list of deposits
    const filteredDeposits = deposits?.filter(poolDepositFilter);
    // only accept deposits with pairID properties attached (should be always)
    return filteredDeposits?.filter(
      (deposit): deposit is Required<DepositRecord> => !!deposit.pairID
    );
  }, [shares, poolDepositFilter]);
}

// a referentially stable empty array
const emptyArray: never[] = [];

// select all (or optional token pair list of) user shares
export function useUserPositionsTotalShares(
  poolDepositFilter: UserDepositFilter = defaultFilter
) {
  const lcdClientPromise = useLcdClientPromise();
  const selectedPoolDeposits = useUserDeposits(poolDepositFilter);

  const { data } = useQueries({
    queries: useMemo(() => {
      return (selectedPoolDeposits || []).flatMap(
        ({ pairID: { token0, token1 } = {}, centerTickIndex, fee }) => {
          if (token0 && token1) {
            const params: QuerySupplyOfRequest = {
              denom: `DualityPoolShares-${token0}-${token1}-t${centerTickIndex}-f${fee}`,
            };
            return {
              queryKey: ['cosmos.bank.v1beta1.supplyOf', params],
              queryFn: async () => {
                const lcdClient = await lcdClientPromise;
                return lcdClient
                  ? lcdClient.cosmos.bank.v1beta1.supplyOf(params)
                  : null;
              },
              staleTime: 10e3,
            };
          }
          return [];
        }
      );
    }, [lcdClientPromise, selectedPoolDeposits]),
    combine(results) {
      return {
        data:
          results.length > 0
            ? results
                .map((result) => result.data)
                .filter((data): data is QuerySupplyOfResponseSDKType => !!data)
            : emptyArray,
        pending: results.some((result) => result.isPending),
      };
    },
  });

  return data;
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
  poolDepositFilter?: UserDepositFilter
) {
  const lcdClientPromise = useLcdClientPromise();
  const selectedPoolDeposits = useUserDeposits(poolDepositFilter);

  const { data } = useQueries({
    queries: useMemo(() => {
      return (selectedPoolDeposits || []).flatMap(
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
                queryFn: async () => {
                  const lcdClient = await lcdClientPromise;
                  return lcdClient
                    ? lcdClient.dualitylabs.duality.dex.poolReserves(params)
                    : null;
                },
                // don't retry, a 404 means there is 0 liquidity there
                retry: false,
                // refetch not that often
                staleTime: 60 * 1e3,
              };
            });
          }
          return [];
        }
      );
    }, [lcdClientPromise, selectedPoolDeposits]),
    combine(results) {
      return {
        data:
          results.length > 0
            ? // the results may contain a lot of null data
              // because we request both sides of a tick for each deposit
              // without knowing which side the reserves lay upon
              results
                .map((result) => result.data)
                .filter(
                  (data): data is QueryGetPoolReservesResponseSDKType => !!data
                )
            : emptyArray,
        pending: results.some((result) => result.isPending),
      };
    },
  });

  return data;
}

export interface ShareValueContext {
  userShares: BigNumber;
  dexTotalShares: BigNumber;
  token: TokenAddress;
  tickIndex: BigNumber;
  dexTotalReserves: BigNumber;
  userReserves: BigNumber;
}
export interface UserPositionDepositContext {
  deposit: Required<DepositRecord>;
  token0: Token;
  token0Context?: ShareValueContext;
  token1: Token;
  token1Context?: ShareValueContext;
}

// collect all the context about the user's positions together
export function useUserPositionsContext(
  poolDepositFilter?: UserDepositFilter
): UserPositionDepositContext[] {
  const selectedPoolDeposits = useUserDeposits(poolDepositFilter);
  const userPositionsTotalShares =
    useUserPositionsTotalShares(poolDepositFilter);
  const userPositionsTotalReserves =
    useUserPositionsTotalReserves(poolDepositFilter);

  const allTokens = useTokens();

  return useMemo<UserPositionDepositContext[]>(() => {
    return (selectedPoolDeposits || []).flatMap<UserPositionDepositContext>(
      (deposit) => {
        const totalSharesResponse =
          userPositionsTotalShares?.find(
            // todo: FIX
            (data) => {
              return !!data;
            }
          ) ?? undefined;

        // find the upper and lower reserves that match this position
        const lowerReserveResponse =
          userPositionsTotalReserves?.find((data) => {
            return (
              data?.poolReserves?.tokenIn === deposit.pairID?.token0 &&
              data?.poolReserves?.pairID?.token0 === deposit.pairID?.token0 &&
              data?.poolReserves?.pairID?.token1 === deposit.pairID?.token1 &&
              data?.poolReserves?.tickIndex.toString() ===
                deposit.lowerTickIndex.toString() &&
              data?.poolReserves?.fee.toString() === deposit.fee.toString()
            );
          }) ?? undefined;
        const upperReserveResponse =
          userPositionsTotalReserves?.find((data) => {
            return (
              data?.poolReserves?.tokenIn === deposit.pairID?.token1 &&
              data?.poolReserves?.pairID?.token0 === deposit.pairID?.token0 &&
              data?.poolReserves?.pairID?.token1 === deposit.pairID?.token1 &&
              data?.poolReserves?.tickIndex.toString() ===
                deposit.upperTickIndex.toString() &&
              data?.poolReserves?.fee.toString() === deposit.fee.toString()
            );
          }) ?? undefined;
        const token0 = allTokens.find(
          (token) => token.address === deposit.pairID.token0
        );
        const token1 = allTokens.find(
          (token) => token.address === deposit.pairID.token1
        );

        if (token0 && token1) {
          // collect context of both side of the liquidity
          const token0Context: ShareValueContext | undefined = deposit &&
            totalSharesResponse &&
            lowerReserveResponse && {
              token: lowerReserveResponse.poolReserves?.tokenIn ?? '',
              tickIndex: new BigNumber(
                lowerReserveResponse.poolReserves?.tickIndex.toString() ?? 0
              ),
              userShares: new BigNumber(deposit.sharesOwned),
              dexTotalShares: new BigNumber(
                totalSharesResponse.amount?.amount ?? 0
              ),
              // start with empty value, will be filled in next step
              userReserves: new BigNumber(0),
              dexTotalReserves: new BigNumber(
                lowerReserveResponse.poolReserves?.reserves ?? 0
              ),
            };

          const token1Context: ShareValueContext | undefined = deposit &&
            totalSharesResponse &&
            upperReserveResponse && {
              token: upperReserveResponse.poolReserves?.tokenIn ?? '',
              tickIndex: new BigNumber(
                upperReserveResponse.poolReserves?.tickIndex.toString() ?? 0
              ),
              userShares: new BigNumber(deposit.sharesOwned),
              dexTotalShares: new BigNumber(
                totalSharesResponse?.amount?.amount ?? 0
              ),
              // start with empty value, will be filled in next step
              userReserves: new BigNumber(0),
              dexTotalReserves: new BigNumber(
                upperReserveResponse.poolReserves?.reserves ?? 0
              ),
            };
          return [
            {
              deposit,
              token0,
              token1,
              // calculate the user's reserves
              token0Context: token0Context && {
                ...token0Context,
                userReserves: getReservesFromShareValueContext(token0Context),
              },
              token1Context: token1Context && {
                ...token1Context,
                userReserves: getReservesFromShareValueContext(token1Context),
              },
            },
          ];
        }
        // skip
        return [];
      }
    );

    // calculate the user's reserves
    function getReservesFromShareValueContext({
      userShares,
      dexTotalShares,
      dexTotalReserves,
    }: ShareValueContext): BigNumber {
      return dexTotalReserves
        .multipliedBy(userShares)
        .dividedBy(dexTotalShares);
    }
  }, [
    allTokens,
    selectedPoolDeposits,
    userPositionsTotalShares,
    userPositionsTotalReserves,
  ]);
}
