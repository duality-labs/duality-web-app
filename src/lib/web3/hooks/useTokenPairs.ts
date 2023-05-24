import { useMemo } from 'react';
import { SWRConfiguration, SWRResponse } from 'swr';
import useSWRInfinite from 'swr/infinite';

import { useLcdClientPromise } from '../lcdClient';

import { defaultPaginationParams, getNextPaginationKey } from './utils';

import {
  QueryTotalSupplyRequest,
  QueryTotalSupplyRequestSDKType,
  QueryTotalSupplyResponseSDKType,
} from '@duality-labs/dualityjs/types/codegen/cosmos/bank/v1beta1/query';
import { getShareInfo } from '../utils/shares';
import { getPairID } from '../utils/pairs';
import { TokenAddress } from '../utils/tokens';

type QueryAllTokenMapState = {
  data: [TokenAddress, TokenAddress][] | undefined;
  isValidating: SWRResponse['isValidating'];
  error: SWRResponse['error'];
};

export default function useTokenPairs({
  swr: swrConfig,
  query: queryConfig,
  queryClient: queryClientConfig,
}: {
  swr?: SWRConfiguration;
  query?: QueryTotalSupplyRequestSDKType;
  queryClient?: string;
} = {}): QueryAllTokenMapState {
  const params: QueryTotalSupplyRequest = {
    ...queryConfig,
    pagination: {
      ...defaultPaginationParams,
      ...queryConfig?.pagination,
    },
  };

  const lcdClientPromise = useLcdClientPromise(queryClientConfig);

  const {
    data: pages,
    isValidating,
    error,
  } = useSWRInfinite<QueryTotalSupplyResponseSDKType>(
    getNextPaginationKey<QueryTotalSupplyRequest>(
      'cosmos.bank.v1beta1.totalSupply',
      params
    ),
    async (_: string, params: QueryTotalSupplyRequest) => {
      const client = await lcdClientPromise;
      return await client.cosmos.bank.v1beta1.totalSupply(params);
    },
    {
      // fetch all pages by default
      initialSize: Number.MAX_SAFE_INTEGER,
      persistSize: true,
      ...swrConfig,
    }
  );
  // place pages of data into the same list
  const data = useMemo(() => {
    const tradingPairMap = pages?.reduce<Map<string, [TokenAddress, TokenAddress]>>(
      (acc, page) => {
        page.supply.forEach((coin) => {
          const match = getShareInfo(coin);
          if (match) {
            const { token0Address, token1Address } = match;
            acc.set(getPairID(token0Address, token1Address), [
              token0Address,
              token1Address,
            ]);
          }
        });

        return acc;
      },
      new Map<string, [TokenAddress, TokenAddress]>()
    );
    return tradingPairMap && Array.from(tradingPairMap.values());
  }, [pages]);

  // return state
  return { data, isValidating, error };
}

// add convenience method to fetch ticks in a pair
export function useOrderedTokenPair([tokenA, tokenB]: [
  TokenAddress?,
  TokenAddress?
]): [token0: TokenAddress, token1: TokenAddress] | undefined {
  const { data: tokenPairs } = useTokenPairs();
  // search for ordered token pair in our token pair list
  return tokenA && tokenB
    ? tokenPairs?.find((tokenPair) => {
        return tokenPair.includes(tokenA) && tokenPair.includes(tokenB);
      })
    : undefined;
}
