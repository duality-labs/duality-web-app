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
    size,
    setSize,
  } = useSWRInfinite<QueryTotalSupplyResponseSDKType>(
    getNextPaginationKey<QueryTotalSupplyRequest>(
      'cosmos.bank.v1beta1.totalSupply',
      params
    ),
    async ([, params]: [paths: string, params: QueryTotalSupplyRequest]) => {
      const client = await lcdClientPromise;
      return await client.cosmos.bank.v1beta1.totalSupply(params);
    },
    { persistSize: true, ...swrConfig }
  );
  // set number of pages to latest total
  const pageItemCount = Number(pages?.[0]?.supply?.length);
  const totalItemCount = Number(pages?.[0]?.pagination?.total);
  if (pageItemCount > 0 && totalItemCount > pageItemCount) {
    const pageCount = Math.ceil(totalItemCount / pageItemCount);
    if (size !== pageCount) {
      setSize(pageCount);
    }
  }
  // place pages of data into the same list
  const tradingPairs = pages?.reduce<Map<string, [TokenAddress, TokenAddress]>>(
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
  return {
    data: tradingPairs && Array.from(tradingPairs.values()),
    isValidating,
    error,
  };
}
