import BigNumber from 'bignumber.js';
import { useMemo, useRef } from 'react';
import { useQueries } from '@tanstack/react-query';
import { DepositRecord } from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/dex/deposit_record';
import { QuerySupplyOfRequest } from '@duality-labs/dualityjs/types/codegen/cosmos/bank/v1beta1/query';
import { QueryGetPoolReservesRequest } from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/dex/query';

import { useLcdClientPromise } from '../lcdClient';
import { useUserDepositsOfTokenPair } from './useUserDeposits';
import { useSimplePrice } from '../../tokenPrices';

import { getPairID } from '../utils/pairs';
import { priceToTickIndex, tickIndexToPrice } from '../utils/ticks';
import {
  Token,
  TokenIdPair,
  TokenPair,
  getBaseDenomAmount,
  getTokenId,
} from '../utils/tokens';
import { useRpcPromise } from '../rpcQueryClient';
import { dualitylabs } from '@duality-labs/dualityjs';
import useTokens, { useTokensWithIbcInfo } from './useTokens';

interface PairReserves {
  reserves0: string;
  reserves1: string;
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

function useUserDepositsTotalShares(
  tokenPair?: TokenPair | TokenIdPair
): CombinedUseQueries<UserReservesTotalShares[]> {
  const lcdClientPromise = useLcdClientPromise();
  const { data: userPairDeposits } = useUserDepositsOfTokenPair(tokenPair);

  // for each specific amount of userDeposits, fetch the totalShares that match
  const memoizedData = useRef<UserReservesTotalShares[]>();
  const result = useQueries({
    queries: useMemo(() => {
      return (userPairDeposits || []).flatMap((deposit) => {
        const { pairID, centerTickIndex, fee, sharesOwned } = deposit;
        if (Number(sharesOwned) > 0) {
          const params: QuerySupplyOfRequest = {
            denom: `DualityPoolShares-${pairID.token0}-${pairID.token1}-t${centerTickIndex}-f${fee}`,
          };
          return {
            // include sharesOwned in query key so that share updates trigger data update
            queryKey: ['cosmos.bank.v1beta1.supplyOf', params, sharesOwned],
            queryFn: async (): Promise<UserReservesTotalShares | null> => {
              const lcdClient = await lcdClientPromise;
              if (lcdClient) {
                return lcdClient.cosmos.bank.v1beta1
                  .supplyOf(params)
                  .then((response) => {
                    return {
                      deposit,
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
    }, [lcdClientPromise, userPairDeposits]),
    combine(results) {
      // only process data from successfully resolved queries
      const data = results
        .map((result) => result.data)
        .filter((data): data is UserReservesTotalShares => !!data);

      // if array length or any item of the array has changed, then update data
      if (data.length === memoizedData.current?.length) {
        for (let i = 0; i < data.length; i++) {
          const a = memoizedData.current[i];
          const b = data[i];
          if (
            a.totalShares !== b.totalShares ||
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

function useUserDepositsTotalReserves(
  tokenPair?: TokenPair | TokenIdPair
): CombinedUseQueries<UserReservesTotalReserves[]> {
  const rpcPromise = useRpcPromise();
  const { data: userPairDeposits } = useUserDepositsOfTokenPair(tokenPair);

  // for each specific amount of userDeposits, fetch the totalShares that match
  const memoizedData = useRef<UserReservesTotalReserves[]>();
  const result = useQueries({
    queries: useMemo(() => {
      return (userPairDeposits || []).flatMap((deposit) => {
        const { pairID, fee, sharesOwned } = deposit;
        const { token0, token1 } = pairID;
        if (Number(sharesOwned) > 0) {
          // return both upper and lower tick pools
          return [
            { tokenIn: token0, tickIndex: deposit.lowerTickIndex },
            { tokenIn: token1, tickIndex: deposit.upperTickIndex },
          ].map(({ tokenIn, tickIndex }) => {
            const params: QueryGetPoolReservesRequest = {
              pairID: getPairID(pairID.token0, pairID.token1),
              tokenIn,
              tickIndex,
              fee,
            };
            return {
              queryKey: [
                'dualitylabs.duality.dex.poolReserves',
                params,
                sharesOwned,
              ],
              queryFn: async () => {
                // we use an RPC call here because the LCD endpoint always 404s
                const rpc = await rpcPromise;
                const client = new dualitylabs.duality.dex.QueryClientImpl(rpc);
                return client
                  .poolReserves(params)
                  .then((response) => {
                    return {
                      deposit,
                      params,
                      totalReserves: response.poolReserves.reserves,
                    };
                  })
                  .catch(() => {
                    // assume the result was a 404: there is 0 liquidity
                    return {
                      deposit,
                      params,
                      totalReserves: '0',
                    };
                  });
              },
              retry: false,
            };
          });
        }
        return [];
      });
    }, [rpcPromise, userPairDeposits]),
    combine(results) {
      // only process data from successfully resolved queries
      const data = results
        .map((result) => result.data)
        // combine reserves for unique deposits
        .reduce<UserReservesTotalReserves[]>((acc, data) => {
          if (data) {
            const foundReserves = acc.find(({ deposit }) =>
              isEqualDeposit(deposit, data.deposit)
            );
            const reserves: UserReservesTotalReserves = foundReserves || {
              deposit: data.deposit,
              totalReserves: { reserves0: '', reserves1: '' },
            };
            if (data.params.tokenIn === data.deposit.pairID.token0) {
              reserves.totalReserves.reserves0 = data.totalReserves;
            } else if (data.params.tokenIn === data.deposit.pairID.token1) {
              reserves.totalReserves.reserves1 = data.totalReserves;
            }
            return foundReserves ? acc : acc.concat(reserves);
          }
          return acc;
        }, [])
        // ensure these aren't empty strings
        .filter(
          (data) => data.totalReserves.reserves0 && data.totalReserves.reserves1
        );

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

export function useUserIndicativeReserves(
  tokenPair?: TokenPair | TokenIdPair
): CombinedUseQueries<IndicativeUserReserves[]> {
  const userDepositsResults = useUserDepositsOfTokenPair(tokenPair);
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
          const userPercentageOfShares = sharesOwned.dividedBy(totalShares);
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

  const allTokens = useTokensWithIbcInfo(useTokens());
  const allTokensByIdMap = useMemo<Map<string, Token>>(() => {
    return allTokens.reduce<Map<string, Token>>((acc, token) => {
      const id = getTokenId(token);
      if (id && !acc.has(id)) {
        acc.set(id, token);
      }
      return acc;
    }, new Map());
  }, [allTokens]);

  const tokenByIdMap = useMemo<Map<string, Token>>(() => {
    const searchedTokenStrings: string[] = [];
    return (userIndicatveReserves || []).reduce<Map<string, Token>>(
      (acc, indicateReserves) => {
        for (const tokenId of Object.values(indicateReserves.deposit.pairID)) {
          if (!searchedTokenStrings.includes(tokenId)) {
            const foundToken = allTokensByIdMap.get(tokenId);
            if (foundToken) {
              acc.set(tokenId, foundToken);
            }
            searchedTokenStrings.push(tokenId);
          }
        }
        return acc;
      },
      new Map()
    );
  }, [userIndicatveReserves, allTokensByIdMap]);

  const tokenList = useMemo(
    () => Array.from(tokenByIdMap.values()),
    [tokenByIdMap]
  );

  const { data: tokenPrices } = useSimplePrice(tokenList);

  const tokenPriceByIdMap = useMemo(() => {
    return tokenList.reduce<Map<string, number | undefined>>(
      (acc, token, index) => {
        const tokenId = getTokenId(token);
        if (tokenId) {
          acc.set(tokenId, tokenPrices[index]);
        }
        return acc;
      },
      new Map()
    );
  }, [tokenList, tokenPrices]);

  // using the current price, make assumptions about the current reserves
  return useMemo(() => {
    if (Object.values(tokenPriceByIdMap).every((price = 0) => price > 0)) {
      const userReserves = userIndicatveReserves?.flatMap<UserValuedReserves>(
        ({ deposit, indicativeReserves: { reserves0, reserves1 } }) => {
          const token0 = tokenByIdMap.get(deposit.pairID.token0);
          const token1 = tokenByIdMap.get(deposit.pairID.token1);
          const tokenPrice0 = tokenPriceByIdMap.get(deposit.pairID.token0);
          const tokenPrice1 = tokenPriceByIdMap.get(deposit.pairID.token1);
          if (token0 && token1 && tokenPrice0 && tokenPrice1) {
            const display0 = getBaseDenomAmount(token0, 1) || 1;
            const display1 = getBaseDenomAmount(token1, 1) || 1;
            const basePrice0 = new BigNumber(tokenPrice0).dividedBy(display0);
            const basePrice1 = new BigNumber(tokenPrice1).dividedBy(display1);
            const centerTickIndex = priceToTickIndex(
              basePrice1.div(basePrice0)
            );
            // decide if the reserves are of token0 or token1
            const toTheLeft = centerTickIndex.isGreaterThanOrEqualTo(
              deposit.centerTickIndex.toInt()
            );
            return toTheLeft
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
    tokenByIdMap,
    tokenPriceByIdMap,
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
    (a.pairID.token0 === b.pairID.token0 &&
      a.pairID.token1 === b.pairID.token1 &&
      a.centerTickIndex.equals(b.centerTickIndex) &&
      a.fee.equals(b.fee))
  );
}
