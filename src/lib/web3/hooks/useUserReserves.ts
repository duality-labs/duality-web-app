import BigNumber from 'bignumber.js';
import Long from 'long';
import { useMemo, useRef } from 'react';
import { UseQueryResult, useQueries } from '@tanstack/react-query';
import { Coin } from '@cosmjs/proto-signing';
import { PoolMetadata } from '@duality-labs/dualityjs/types/codegen/duality/dex/pool_metadata';
import { DepositRecord } from '@duality-labs/dualityjs/types/codegen/duality/dex/deposit_record';
import { QuerySupplyOfRequest } from '@duality-labs/dualityjs/types/codegen/cosmos/bank/v1beta1/query';
import { QueryGetPoolMetadataRequest } from '@duality-labs/dualityjs/types/codegen/duality/dex/query';
import { useDeepCompareMemoize } from 'use-deep-compare-effect';

import { useLcdClientPromise } from '../lcdClient';
import { useUserDeposits } from './useUserDeposits';
import { useSimplePrice } from '../../tokenPrices';

import { priceToTickIndex, tickIndexToPrice } from '../utils/ticks';
import {
  Token,
  TokenIdPair,
  TokenPair,
  getBaseDenomAmount,
  resolveTokenIdPair,
} from '../utils/tokens';
import { useTokenPairMapLiquidity } from '../../web3/hooks/useTickLiquidity';
import { useOrderedTokenPair } from './useTokenPairs';
import {
  useUserBankBalances,
  useUserDexDenomBalances,
} from './useUserBankBalances';
import { getDexSharePoolID } from '../utils/shares';

interface PairReserves {
  reserves0: string;
  reserves1: string;
}

interface PoolTotalShares {
  balance: Coin;
  totalShares: string;
}

interface UserReservesTotalShares {
  deposit: DepositRecord;
  totalShares: string;
}
interface UserReservesTotalReserves {
  deposit: DepositRecord;
  totalReserves: PairReserves;
}
interface IndicativeUserReserves {
  deposit: DepositRecord;
  indicativeReserves: PairReserves;
}
export interface UserReserves {
  deposit: DepositRecord;
  reserves: PairReserves;
}
export interface UserValuedReserves extends UserReserves {
  value: number;
}

interface CombinedUseQueries<T> {
  data: T | undefined;
  isFetching: boolean;
  error: Error | null;
}

function useUserPoolMetadata(
  tokenPair?: TokenPair | TokenIdPair
): CombinedUseQueries<PoolMetadata[]> {
  const lcdClientPromise = useLcdClientPromise();
  const { data: userDexDenomBalances } = useUserDexDenomBalances();

  // for each specific amount of userShares, fetch the totalShares that match
  const memoizedData = useRef<PoolMetadata[]>();
  const result = useQueries({
    queries: useMemo(() => {
      return (userDexDenomBalances || []).flatMap((balance) => {
        const id = getDexSharePoolID(balance);
        if (id !== undefined) {
          const params: QueryGetPoolMetadataRequest = {
            id: Long.fromNumber(id),
          };
          return {
            queryKey: ['neutron.dex.poolMetadata', id],
            queryFn: async (): Promise<PoolMetadata | null> => {
              const lcdClient = await lcdClientPromise;
              if (lcdClient) {
                return lcdClient.duality.dex
                  .poolMetadata(params)
                  .then((response) => response.PoolMetadata);
              }
              return null;
            },
            // never refetch these values, they will never change
            staleTime: Infinity,
            refetchInterval: Infinity,
            refetchOnMount: false,
            refetchOnReconnect: false,
            refetchOnWindowFocus: false,
          };
        }
        return [];
      });
    }, [lcdClientPromise, userDexDenomBalances]),
    combine(results) {
      // only process data from successfully resolved queries
      const data = results
        .map((result) => result.data)
        .filter((data): data is PoolMetadata => !!data);

      // if array length or any item of the array has changed, then update data
      if (data.length === memoizedData.current?.length) {
        for (let i = 0; i < data.length; i++) {
          const a = memoizedData.current[i];
          const b = data[i];
          if (!a.ID.equals(b.ID)) {
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
        isFetching: results.some((result) => result.isFetching),
        error: results.find((result) => result.error)?.error ?? null,
      };
    },
  });

  const tokenPairIDs = useDeepCompareMemoize(resolveTokenIdPair(tokenPair));

  // filter to tokenPair now that we have metadata about the pool
  const userTokenPairPoolMetadata = useMemo(() => {
    // filter to token pair if specified
    if (tokenPairIDs) {
      const [tokenA, tokenB] = tokenPairIDs;
      return result.data?.filter((metadata) => {
        return (
          (metadata.pairID.token0 === tokenA &&
            metadata.pairID.token1 === tokenB) ||
          (metadata.pairID.token0 === tokenB &&
            metadata.pairID.token1 === tokenA)
        );
      });
    }
    // don't filter if no token pair is specified
    return result.data;
  }, [result.data, tokenPairIDs]);

  return {
    ...result,
    data: userTokenPairPoolMetadata,
  };
}

function useUserPoolTotalShares(): CombinedUseQueries<PoolTotalShares[]> {
  const lcdClientPromise = useLcdClientPromise();
  const { data: userDexDenomBalances } = useUserDexDenomBalances();

  // for each specific amount of userShares, fetch the totalShares that match
  const memoizedData = useRef<PoolTotalShares[]>();
  const result = useQueries({
    queries: useMemo(() => {
      return (userDexDenomBalances || []).flatMap((balance) => {
        const { amount: sharesOwned, denom } = balance;
        if (getDexSharePoolID(balance) !== undefined) {
          const params: QuerySupplyOfRequest = { denom };
          return {
            // include sharesOwned in query key so that share updates trigger data update
            queryKey: ['cosmos.bank.v1beta1.supplyOf', params, sharesOwned],
            queryFn: async (): Promise<PoolTotalShares | null> => {
              const lcdClient = await lcdClientPromise;
              if (lcdClient) {
                return lcdClient.cosmos.bank.v1beta1
                  .supplyOf(params)
                  .then((response) => {
                    // userPairDeposits
                    return {
                      balance,
                      totalShares: response.amount.amount,
                    };
                  });
              }
              return null;
            },
          };
        }
        return [];
      });
    }, [lcdClientPromise, userDexDenomBalances]),
    combine(results) {
      // only process data from successfully resolved queries
      const data = results
        .map((result) => result.data)
        .filter((data): data is PoolTotalShares => !!data);

      // if array length or any item of the array has changed, then update data
      if (data.length === memoizedData.current?.length) {
        for (let i = 0; i < data.length; i++) {
          const a = memoizedData.current[i];
          const b = data[i];
          if (
            a.totalShares !== b.totalShares ||
            a.balance.denom !== b.balance.denom ||
            a.balance.amount !== b.balance.amount
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
        isFetching: results.some((result) => result.isFetching),
        error: results.find((result) => result.error)?.error ?? null,
      };
    },
  });

  return result;
}

function useUserDepositsTotalShares(
  tokenPair?: TokenPair | TokenIdPair
): UseQueryResult<UserReservesTotalShares[]> {
  const { data: userPoolMetadata } = useUserPoolMetadata(tokenPair);
  const { data: userPoolTotalShares, ...rest } = useUserPoolTotalShares();

  const totalSharesByPoolID = useMemo<Map<number, PoolTotalShares>>(() => {
    const totalSharesByPoolID = new Map<number, PoolTotalShares>();
    for (const userPoolTotalShare of userPoolTotalShares || []) {
      // make map here
      const poolID = getDexSharePoolID(userPoolTotalShare.balance);
      if (poolID !== undefined) {
        totalSharesByPoolID.set(poolID, userPoolTotalShare);
      }
    }
    return totalSharesByPoolID;
  }, [userPoolTotalShares]);

  const { data: userPairDeposits } = useUserDeposits(tokenPair);

  const userDepositsWithPoolID = useMemo(() => {
    const userPoolMetadataSet = new Set(userPoolMetadata);
    return userPairDeposits?.map(
      (deposit): { deposit: DepositRecord; metadata?: PoolMetadata } => {
        const remainingUserPoolMetadataSet = Array.from(userPoolMetadataSet);
        for (const metadata of remainingUserPoolMetadataSet) {
          if (
            metadata.pairID.token0 === deposit.pairID.token0 &&
            metadata.pairID.token1 === deposit.pairID.token1 &&
            metadata.tick.equals(deposit.centerTickIndex) &&
            metadata.fee.equals(deposit.fee)
          ) {
            // remove this value from the search set
            userPoolMetadataSet.delete(metadata);
            return { deposit, metadata };
          }
        }
        return { deposit };
      }
    );
  }, [userPairDeposits, userPoolMetadata]);

  const userDepositsTotalShares = useMemo(() => {
    return userDepositsWithPoolID?.map(({ deposit, metadata }) => {
      const poolID = metadata?.ID.toNumber();
      const totalShares =
        poolID !== undefined
          ? totalSharesByPoolID.get(poolID)?.totalShares ?? '0'
          : '0';
      return {
        deposit,
        totalShares,
      };
    });
  }, [userDepositsWithPoolID, totalSharesByPoolID]);

  return { ...rest, data: userDepositsTotalShares } as UseQueryResult<
    UserReservesTotalShares[]
  >;
}

function useUserDepositsTotalReserves(
  tokenPair?: TokenPair | TokenIdPair
): CombinedUseQueries<UserReservesTotalReserves[]> {
  const lcdClientPromise = useLcdClientPromise();
  const { data: userPairDeposits } = useUserDeposits(tokenPair);
  const { data: userPoolMetadata } = useUserPoolMetadata();

  // for each specific amount of userDeposits, fetch the totalShares that match
  const memoizedData = useRef<UserReservesTotalReserves[]>();
  const result = useQueries({
    queries: useMemo(() => {
      return (userPairDeposits || []).flatMap((deposit) => {
        if (Number(deposit.sharesOwned) > 0) {
          // query pool reserves
          const poolId = userPoolMetadata?.find((metadata) => {
            return (
              metadata.pairID.token0 === deposit.pairID.token0 &&
              metadata.pairID.token1 === deposit.pairID.token1 &&
              metadata.tick.equals(deposit.centerTickIndex) &&
              metadata.fee.equals(deposit.fee)
            );
          })?.ID;
          if (!poolId) {
            return [];
          }

          return {
            queryKey: ['neutron.dex.pool', poolId, deposit.sharesOwned],
            queryFn: async () => {
              // we use an RPC call here because the LCD endpoint always 404s
              const client = await lcdClientPromise;
              return client.duality.dex
                .poolByID({ poolID: poolId })
                .then(({ pool }): UserReservesTotalReserves => {
                  return {
                    deposit,
                    totalReserves: {
                      reserves0: pool?.lower_tick0.reservesMakerDenom || '0',
                      reserves1: pool?.upper_tick1.reservesMakerDenom || '0',
                    },
                  };
                })
                .catch(() => {
                  // assume the result was a 404: there is 0 liquidity
                  return {
                    deposit,
                    poolId,
                    totalReserves: { reserves0: '0', reserves1: '0' },
                  };
                });
            },
            retry: false,
          };
        }
        return [];
      });
    }, [lcdClientPromise, userPairDeposits, userPoolMetadata]),
    combine(results) {
      // only process data from successfully resolved queries
      const data = results.flatMap((result) => result.data ?? []);

      // if array length or any item of the array has changed, then update data
      if (data.length === memoizedData.current?.length) {
        for (let i = 0; i < data.length; i++) {
          const a = memoizedData.current[i];
          const b = data[i];
          if (
            a.totalReserves !== b.totalReserves ||
            !isEqualDeposit(a.deposit, b.deposit)
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
        isFetching: results.some((result) => result.isFetching),
        error: results.find((result) => result.error)?.error ?? null,
      };
    },
  });

  return result;
}

function useUserIndicativeReserves(
  tokenPair?: TokenPair | TokenIdPair
): CombinedUseQueries<IndicativeUserReserves[]> {
  const userDepositsResults = useUserDeposits(tokenPair);
  const userTotalSharesResults = useUserDepositsTotalShares(tokenPair);
  const userTotalReservesResults = useUserDepositsTotalReserves(tokenPair);

  const data = useMemo((): IndicativeUserReserves[] | undefined => {
    return userDepositsResults.data?.flatMap<IndicativeUserReserves>(
      (deposit) => {
        const foundTotalShares = userTotalSharesResults.data?.find((data) =>
          isEqualDeposit(data.deposit, deposit)
        );
        const foundTotalReserves = userTotalReservesResults.data?.find((data) =>
          isEqualDeposit(data.deposit, deposit)
        );
        if (foundTotalShares && foundTotalReserves) {
          const sharesOwned = new BigNumber(deposit.sharesOwned);
          const totalShares = new BigNumber(foundTotalShares.totalShares);
          const totalReserves = foundTotalReserves.totalReserves;
          const reserves0 = new BigNumber(totalReserves.reserves0);
          const reserves1 = new BigNumber(totalReserves.reserves1);
          const userPercentageOfShares = totalShares.isZero()
            ? totalShares
            : sharesOwned.dividedBy(totalShares);
          const lowerTickIndex = new BigNumber(deposit.lowerTickIndex.toInt());
          const upperTickIndex = new BigNumber(deposit.upperTickIndex.toInt());
          const allReservesAsToken0 = reserves0.plus(
            reserves1.multipliedBy(tickIndexToPrice(lowerTickIndex))
          );
          const allReservesAsToken1 = reserves1.plus(
            reserves0.dividedBy(tickIndexToPrice(upperTickIndex))
          );
          return {
            deposit,
            indicativeReserves: {
              reserves0: userPercentageOfShares
                .multipliedBy(allReservesAsToken0)
                .toFixed(0),
              reserves1: userPercentageOfShares
                .multipliedBy(allReservesAsToken1)
                .toFixed(0),
            },
          };
        }
        return [];
      }
    );
  }, [
    userDepositsResults.data,
    userTotalSharesResults.data,
    userTotalReservesResults.data,
  ]);

  return {
    data,
    isFetching:
      userDepositsResults.isFetching ||
      userTotalSharesResults.isFetching ||
      userTotalReservesResults.isFetching,
    error:
      userDepositsResults.error ||
      userTotalSharesResults.error ||
      userTotalReservesResults.error,
  };
}

export function useEstimatedUserReserves(
  tokenPair?: TokenPair | TokenIdPair
): CombinedUseQueries<UserValuedReserves[]> {
  const {
    data: userIndicatveReserves,
    isFetching,
    error,
  } = useUserIndicativeReserves(tokenPair);

  const { data: balances } = useUserBankBalances();
  const userTokensByDenom = useMemo<Map<string, Token>>(() => {
    const map = new Map<string, Token>();
    const restrictToTokens = new Set(
      userIndicatveReserves?.flatMap((reserve) => [
        reserve.deposit.pairID.token0,
        reserve.deposit.pairID.token1,
      ])
    );
    for (const balance of balances || []) {
      // if not yet set and should be set, then set
      if (restrictToTokens.has(balance.denom) && !map.has(balance.denom)) {
        map.set(balance.denom, balance.token);
      }
    }
    return map;
  }, [balances, userIndicatveReserves]);

  const tokenList = useMemo(
    () => Array.from(userTokensByDenom.values()),
    [userTokensByDenom]
  );

  const { data: tokenPrices } = useSimplePrice(tokenList);

  const tokenPriceByDenomMap = useMemo(() => {
    return tokenList.reduce<Map<string, number | undefined>>(
      (acc, token, index) => {
        acc.set(token.base, tokenPrices[index]);
        return acc;
      },
      new Map()
    );
  }, [tokenList, tokenPrices]);

  // using the current price, make assumptions about the current reserves
  return useMemo(() => {
    if (Object.values(tokenPriceByDenomMap).every((price = 0) => price > 0)) {
      const userReserves = userIndicatveReserves?.flatMap<UserValuedReserves>(
        ({ deposit, indicativeReserves: { reserves0, reserves1 } }) => {
          const token0 = userTokensByDenom.get(deposit.pairID.token0);
          const token1 = userTokensByDenom.get(deposit.pairID.token1);
          const tokenPrice0 = tokenPriceByDenomMap.get(deposit.pairID.token0);
          const tokenPrice1 = tokenPriceByDenomMap.get(deposit.pairID.token1);
          if (token0 && token1 && tokenPrice0 && tokenPrice1) {
            const display0 = getBaseDenomAmount(token0, 1) || 1;
            const display1 = getBaseDenomAmount(token1, 1) || 1;
            const basePrice0 = new BigNumber(tokenPrice0).dividedBy(display0);
            const basePrice1 = new BigNumber(tokenPrice1).dividedBy(display1);
            const centerTickIndex = priceToTickIndex(
              basePrice1.div(basePrice0)
            );
            // decide if the reserves are of token0 or token1
            const depositIsLeftOfPrice = centerTickIndex.isLessThan(
              deposit.centerTickIndex.toInt()
            );
            return depositIsLeftOfPrice
              ? {
                  deposit,
                  reserves: {
                    reserves0,
                    reserves1: '0',
                  },
                  value: basePrice0.multipliedBy(reserves0).toNumber(),
                }
              : {
                  deposit,
                  reserves: {
                    reserves0: '0',
                    reserves1,
                  },
                  value: basePrice1.multipliedBy(reserves1).toNumber(),
                };
          }
          return [];
        }
      );
      return {
        data: userReserves,
        isFetching,
        error,
      };
    }
    return {
      data: undefined,
      isFetching,
      error,
    };
  }, [
    userTokensByDenom,
    tokenPriceByDenomMap,
    userIndicatveReserves,
    isFetching,
    error,
  ]);
}

// calculate total
export function useEstimatedUserReservesValue(
  tokenPair?: TokenPair | TokenIdPair
): BigNumber {
  const { data: estimatedUserReserves } = useEstimatedUserReserves(tokenPair);
  return useMemo(() => {
    return (estimatedUserReserves || []).reduce<BigNumber>(
      (acc, estimatedUserReserve) => acc.plus(estimatedUserReserve.value),
      new BigNumber(0)
    );
  }, [estimatedUserReserves]);
}

function isEqualDeposit(a: DepositRecord, b: DepositRecord) {
  // compare by reference or compare by properties
  return (
    a === b ||
    (a.sharesOwned === b.sharesOwned &&
      a.pairID.token0 === b.pairID.token0 &&
      a.pairID.token1 === b.pairID.token1 &&
      a.centerTickIndex.equals(b.centerTickIndex) &&
      a.fee.equals(b.fee))
  );
}

const emptyDataSet: never[] = [];
export function useAccurateUserReserves(
  tokenPair?: TokenPair | TokenIdPair
): CombinedUseQueries<UserReserves[]> {
  const tokenIdPair = resolveTokenIdPair(tokenPair) || [];
  const [tokenId0, tokenId1] = useOrderedTokenPair(tokenIdPair) || [];
  const [tokenIdA, tokenIdB] = tokenIdPair;
  const forward = tokenId0 === tokenIdA && tokenId1 === tokenIdB;
  const reverse = tokenId0 === tokenIdB && tokenId1 === tokenIdA;

  // combine data from user reserves and tick liquidity
  const {
    data: userIndicativeReserves,
    isFetching,
    error,
  } = useUserIndicativeReserves(tokenPair);
  const { data: [liquidityMapA, liquidityMapB] = [] } =
    useTokenPairMapLiquidity(tokenIdPair);

  const liquidityMap0 = forward ? liquidityMapA : liquidityMapB;
  const liquidityMap1 = reverse ? liquidityMapA : liquidityMapB;

  // note: memoize this middle state as an optimization
  //       - liquidity maps update frequently
  //       - user indicative reserves update infrequently
  //       - the relevant liquidity pools to the user don't update that often
  const userSpecificLiquidityKeyValues = useDeepCompareMemoize(
    useMemo(() => {
      return userIndicativeReserves?.map<[number, [number, number]]>(
        ({ deposit }) => {
          // find state from tick liquidity
          // note: reserve of token is in tickIndexTakerToMaker and needs to be
          //       converted into tickIndex1to0 to align with token0/token1 math
          const reserves0 =
            liquidityMap0?.get(deposit.lowerTickIndex.toNumber()) || 0;
          const reserves1 =
            liquidityMap1?.get(deposit.upperTickIndex.negate().toNumber()) || 0;
          // return in key, value format ready to create an array or map
          // use this format because it is easy to memoize and deep-compare
          return [deposit.centerTickIndex.toNumber(), [reserves0, reserves1]];
        }
      );
    }, [liquidityMap0, liquidityMap1, userIndicativeReserves])
  );

  const userReserves = useMemo<UserReserves[]>(() => {
    if (
      userIndicativeReserves?.length &&
      userSpecificLiquidityKeyValues?.length
    ) {
      const liquidityMap = new Map(userSpecificLiquidityKeyValues);
      return (userIndicativeReserves || []).map(
        ({ deposit, indicativeReserves }) => {
          // find state from tick liquidity
          const [reserves0, reserves1] = liquidityMap?.get(
            deposit.centerTickIndex.toNumber()
          ) || [0, 0];
          // compute user reserves from state to
          const reserves1As0 =
            reserves1 *
            tickIndexToPrice(
              new BigNumber(deposit.centerTickIndex.toNumber())
            ).toNumber();
          const totalAs0 = reserves0 + reserves1As0;
          const percentage0 = totalAs0 > 0 ? reserves0 / totalAs0 : 0;
          const percentage1 = totalAs0 > 0 ? reserves1As0 / totalAs0 : 0;
          return {
            deposit,
            reserves: {
              reserves0: new BigNumber(indicativeReserves.reserves0)
                .multipliedBy(percentage0)
                .toFixed(0),
              reserves1: new BigNumber(indicativeReserves.reserves1)
                .multipliedBy(percentage1)
                .toFixed(0),
            },
          };
        }
      );
    }
    return emptyDataSet;
  }, [userIndicativeReserves, userSpecificLiquidityKeyValues]);

  return { data: userReserves, isFetching, error };
}
