import { useQueries } from '@tanstack/react-query';
import { createRpcQueryHooks } from '@duality-labs/dualityjs';
import { QuerySupplyOfRequest } from '@duality-labs/dualityjs/types/codegen/cosmos/bank/v1beta1/query';
import { DepositRecord } from '@duality-labs/dualityjs/types/codegen/duality/dex/deposit_record';
import {
  QueryGetPoolReservesRequest,
  QueryGetUserPositionsResponseSDKType,
} from '@duality-labs/dualityjs/types/codegen/duality/dex/query';

import { useWeb3 } from '../useWeb3';
import { useRpc } from '../rpcQueryClient';
import { useLcdClient } from '../lcdClient';
import { getPairID } from '../utils/pairs';
import {
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
