import BigNumber from 'bignumber.js';
import { useCallback, useMemo, useRef } from 'react';
import { useQueries } from '@tanstack/react-query';
import {
  QuerySupplyOfRequest,
  QuerySupplyOfResponse,
} from '@duality-labs/dualityjs/types/codegen/cosmos/bank/v1beta1/query';
import { DepositRecord } from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/dex/deposit_record';
import {
  QueryGetPoolReservesRequest,
  QueryGetPoolReservesResponse,
} from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/dex/query';
import { dualitylabs } from '@duality-labs/dualityjs';

import { useLcdClientPromise } from '../lcdClient';
import { useRpcPromise } from '../rpcQueryClient';
import { getPairID } from '../utils/pairs';
import {
  Token,
  TokenID,
  TokenIdPair,
  TokenPair,
  resolveTokenIdPair,
} from '../utils/tokens';
import useTokens, {
  matchTokenByDenom,
  useTokensWithIbcInfo,
} from './useTokens';
import { useUserDeposits } from './useUserDeposits';
import { getShareInfo } from '../utils/shares';

// default useUserPositionsTotalShares filter to all user's deposits
export type UserDepositFilter = (poolDeposit: DepositRecord) => boolean;
const defaultFilter: UserDepositFilter = () => true;

export function usePoolDepositFilterForPair(
  tokenPair: TokenPair | TokenIdPair | undefined
): (poolDeposit: DepositRecord) => boolean {
  const [tokenIdA, tokenIdB] = resolveTokenIdPair(tokenPair) || [];
  const poolDepositFilter = useCallback(
    (poolDeposit: DepositRecord) => {
      return (
        !!tokenIdA &&
        !!tokenIdB &&
        !!poolDeposit.pairID &&
        [tokenIdA, tokenIdB].includes(poolDeposit.pairID.token0) &&
        [tokenIdA, tokenIdB].includes(poolDeposit.pairID.token1)
      );
    },
    [tokenIdA, tokenIdB]
  );
  return poolDepositFilter;
}

// select all (or optional token pair list of) user shares
export function useFilteredUserDeposits(
  poolDepositFilter: UserDepositFilter = defaultFilter
): Required<DepositRecord>[] | undefined {
  const { data: deposits } = useUserDeposits();
  return useMemo(() => {
    // return filtered list of deposits
    const filteredDeposits = deposits?.filter(poolDepositFilter);
    // only accept deposits with pairID properties attached (should be always)
    return filteredDeposits?.filter(
      (deposit): deposit is Required<DepositRecord> => !!deposit.pairID
    );
  }, [deposits, poolDepositFilter]);
}

// select all (or optional token pair list of) user shares
export function useUserPositionsTotalShares(
  poolDepositFilter: UserDepositFilter = defaultFilter
) {
  const lcdClientPromise = useLcdClientPromise();
  const selectedPoolDeposits = useFilteredUserDeposits(poolDepositFilter);

  const memoizedData = useRef<QuerySupplyOfResponse[]>([]);
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
        .filter((data): data is QuerySupplyOfResponse => !!data);

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
  const rpcPromise = useRpcPromise();
  const selectedPoolDeposits = useFilteredUserDeposits(poolDepositFilter);

  const memoizedData = useRef<QueryGetPoolReservesResponse[]>([]);
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
              { tokenIn: token0, tickIndex1To0: lowerTickIndex },
              { tokenIn: token1, tickIndex1To0: upperTickIndex },
            ].map(({ tokenIn, tickIndex1To0 }) => {
              const params: QueryGetPoolReservesRequest = {
                pairID,
                tokenIn,
                tickIndex: tickIndex1To0,
                fee,
              };
              return {
                queryKey: ['dualitylabs.duality.dex.poolReserves', params],
                queryFn: async () => {
                  const rpc = await rpcPromise;
                  const client = new dualitylabs.duality.dex.QueryClientImpl(
                    rpc
                  );
                  // todo: when switching to RPC pool reserves with pagination
                  //       remember that all pagination fields are required
                  const result = await client.poolReserves(params);
                  return result ?? null;
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
    }, [rpcPromise, selectedPoolDeposits]),
    combine(results) {
      // only process data from successfully resolved queries
      const data = results
        .map((result) => result.data)
        .filter((data): data is QueryGetPoolReservesResponse => !!data);

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
  token: TokenID;
  tickIndex1To0: BigNumber;
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
  const selectedPoolDeposits = useFilteredUserDeposits(poolDepositFilter);
  const userPositionsTotalShares =
    useUserPositionsTotalShares(poolDepositFilter);
  const userPositionsTotalReserves =
    useUserPositionsTotalReserves(poolDepositFilter);

  const allTokens = useTokensWithIbcInfo(useTokens());

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
                shareInfo.tickIndex1To0String ===
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
        const token0 = allTokens.find(matchTokenByDenom(deposit.pairID.token0));
        const token1 = allTokens.find(matchTokenByDenom(deposit.pairID.token1));

        if (token0 && token1) {
          // collect context of both side of the liquidity
          const token0Context: ShareValueContext | undefined = deposit &&
            totalSharesResponse &&
            lowerReserveResponse && {
              token: lowerReserveResponse.poolReserves?.tokenIn ?? '',
              tickIndex1To0: new BigNumber(
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
              tickIndex1To0: new BigNumber(
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
