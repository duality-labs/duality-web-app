import { useMemo } from 'react';
import { useTokenByDenom } from './useDenomClients';
import { UserReserves, UserValuedReserves } from './useUserReserves';
import { Token } from '../utils/tokens';
import { getPairID } from '../utils/pairs';
import { SWRCommon, useSwrResponse } from './useSWR';

export interface UserPair<T extends UserReserves | UserValuedReserves> {
  pairId: string;
  token0: Token;
  token1: Token;
  userReserves: T[];
}

export function useUserPairs<T extends UserReserves | UserValuedReserves>(
  userReserves: T[] | undefined
): SWRCommon<UserPair<T>[]> {
  const { data: tokenByDenom, ...swr } = useTokenByDenom(
    userReserves?.flatMap(({ deposit }) => [
      deposit.pair_id.token0,
      deposit.pair_id.token1,
    ])
  );

  const userPairs = useMemo<UserPair<T>[] | undefined>(() => {
    // collect positions into token pair groups
    const userValuedReservesMap = (userReserves || []).reduce<{
      [pairId: string]: UserPair<T>;
    }>((map, userPosition) => {
      const { token0: token0Address, token1: token1Address } =
        userPosition.deposit.pair_id;
      const pairId = getPairID(token0Address, token1Address);
      const token0 = tokenByDenom?.get(token0Address);
      const token1 = tokenByDenom?.get(token1Address);
      if (pairId && token0 && token1) {
        map[pairId] = map[pairId] || {
          pairId,
          token0,
          token1,
          userReserves: [],
        };
        map[pairId].userReserves.push(userPosition);
      }
      return map;
    }, {});

    return userValuedReservesMap
      ? Object.entries(userValuedReservesMap).map<UserPair<T>>(
          ([pairId, { token0, token1, userReserves }]) => {
            return { pairId, token0, token1, userReserves };
          }
        )
      : [];
  }, [userReserves, tokenByDenom]);

  return useSwrResponse(userPairs, swr);
}
