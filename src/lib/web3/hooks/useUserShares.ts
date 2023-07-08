import BigNumber from 'bignumber.js';
import Long from 'long';
import { useCallback, useMemo, useRef } from 'react';
import { useQueries } from '@tanstack/react-query';
import {
  QuerySupplyOfRequest,
  QuerySupplyOfResponseSDKType,
} from '@duality-labs/dualityjs/types/codegen/cosmos/bank/v1beta1/query';
import { DepositRecord } from '@duality-labs/dualityjs/types/codegen/duality/dex/deposit_record';
import {
  QueryGetPoolReservesRequest,
  QueryGetPoolReservesResponseSDKType,
} from '@duality-labs/dualityjs/types/codegen/duality/dex/query';

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
import { getShareInfo } from '../utils/shares';

// default useUserPositionsTotalShares filter to all user's deposits
export type UserDepositFilter = (poolDeposit: DepositRecord) => boolean;
const defaultFilter: UserDepositFilter = () => true;

export function usePoolDepositFilterForPair(
  tokenPair: TokenPair | TokenAddressPair
): (poolDeposit: DepositRecord) => boolean {
  const [tokenAddressA, tokenAddressB] = getTokenAddressPair(tokenPair);
  const poolDepositFilter = useCallback(
    (poolDeposit: DepositRecord) => {
      const addresses = [tokenAddressA, tokenAddressB];
      return (
        !!tokenAddressA &&
        !!tokenAddressB &&
        !!poolDeposit.pairID &&
        addresses.includes(poolDeposit.pairID.token0) &&
        addresses.includes(poolDeposit.pairID.token1)
      );
    },
    [tokenAddressA, tokenAddressB]
  );
  return poolDepositFilter;
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

// select all (or optional token pair list of) user shares
export function useUserPositionsTotalShares(
  poolDepositFilter: UserDepositFilter = defaultFilter
) {
  const lcdClientPromise = useLcdClientPromise();
  const selectedPoolDeposits = useUserDeposits(poolDepositFilter);

  const memoizedData = useRef<QuerySupplyOfResponseSDKType[]>([]);
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
      // only process data from successfully resolved queries
      const data = results
        .map((result) => result.data)
        .filter((data): data is QuerySupplyOfResponseSDKType => !!data);

      if (data.length === memoizedData.current.length) {
        // let isSame: boolean = true;
        for (let i = 0; i < data.length; i++) {
          const supply1 = data[i];
          const supply2 = memoizedData.current[i];
          if (!(supply1.amount === supply2.amount)) {
            // an item has changed, update data
            memoizedData.current = data;
            break;
          }
        }
      } else {
        // the data array has changed, update data
        memoizedData.current = data;
      }
      return {
        data: memoizedData.current,
        pending: results.some((result) => result.isPending),
      };
    },
  });

  return data;
}

// select all (or optional token pair list of) user reserves
export function useUserPositionsTotalReserves(
  poolDepositFilter?: UserDepositFilter
) {
  const lcdClientPromise = useLcdClientPromise();
  const selectedPoolDeposits = useUserDeposits(poolDepositFilter);

  const memoizedData = useRef<QueryGetPoolReservesResponseSDKType[]>([]);
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
      // only process data from successfully resolved queries
      const data = results
        .map((result) => result.data)
        .filter((data): data is QueryGetPoolReservesResponseSDKType => !!data);

      if (data.length === memoizedData.current.length) {
        // let isSame: boolean = true;
        for (let i = 0; i < data.length; i++) {
          const poolReserves1 = data[i].poolReserves;
          const poolReserves2 = memoizedData.current[i].poolReserves;
          if (
            !(
              poolReserves1?.tickIndex === poolReserves2?.tickIndex &&
              poolReserves1?.fee === poolReserves2?.fee &&
              poolReserves1?.reserves === poolReserves2?.reserves &&
              poolReserves1?.pairID?.token0 === poolReserves2?.pairID?.token0 &&
              poolReserves1?.pairID?.token1 === poolReserves2?.pairID?.token1 &&
              poolReserves1?.tokenIn === poolReserves2?.tokenIn
            )
          ) {
            // an item has changed, update data
            memoizedData.current = data;
            break;
          }
        }
      } else {
        // the data array has changed, update data
        memoizedData.current = data;
      }
      return {
        data: memoizedData.current,
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
          userPositionsTotalShares?.find((data) => {
            const shareInfo = data?.amount && getShareInfo(data.amount);
            if (shareInfo) {
              return (
                shareInfo.token0Address === deposit.pairID?.token0 &&
                shareInfo.token1Address === deposit.pairID?.token1 &&
                shareInfo.tickIndexString ===
                  deposit.centerTickIndex.toString() &&
                shareInfo.feeString === deposit.fee.toString()
              );
            }
            return false;
          }) ?? undefined;

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
