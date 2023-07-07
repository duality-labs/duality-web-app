import { useEffect, useMemo } from 'react';
import { SWRConfiguration, SWRResponse } from 'swr';
import useSWRInfinite from 'swr/infinite';

import {
  QueryAllTickLiquidityRequest,
  QueryAllTickLiquidityResponseSDKType,
} from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/dex/query';
import { useLcdClientPromise } from '../lcdClient';
import { TickLiquiditySDKType } from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/dex/tick_liquidity';

import { defaultPaginationParams, getNextPaginationKey } from './utils';

import { addressableTokenMap as tokenMap } from '../../../lib/web3/hooks/useTokens';
import BigNumber from 'bignumber.js';
import { TickInfo, tickIndexToPrice } from '../utils/ticks';
import { useOrderedTokenPair } from './useTokenPairs';
import { TokenAddress } from '../utils/tokens';
import { getPairID } from '../utils/pairs';

type QueryAllTickLiquidityState = {
  data: Array<TickInfo> | undefined;
  isValidating: SWRResponse['isValidating'];
  error: SWRResponse['error'];
};

export default function useTickLiquidity({
  swr: swrConfig,
  query: queryConfig,
  queryClient: queryClientConfig,
}: {
  swr?: SWRConfiguration;
  query: QueryAllTickLiquidityRequest | null;
  queryClient?: string;
}): QueryAllTickLiquidityState {
  if (queryConfig && !queryConfig?.pairID) {
    throw new Error('Cannot fetch liquidity: no pair ID given');
  }
  if (queryConfig && !queryConfig?.tokenIn) {
    throw new Error('Cannot fetch liquidity: no token ID given');
  }

  const params: QueryAllTickLiquidityRequest | null = !queryConfig
    ? null
    : {
        ...queryConfig,
        pagination: {
          ...defaultPaginationParams,
          ...queryConfig?.pagination,
        },
      };

  const lcdClientPromise = useLcdClientPromise(queryClientConfig);

  // todo: add a subscription listener here or above here to invalidate the
  // following request cache keys a refetch new data (recommend passing block ID
  // into the cache key to only refetch at most once per block)

  const {
    data: pages,
    isValidating,
    error,
    setSize,
  } = useSWRInfinite<QueryAllTickLiquidityResponseSDKType>(
    !params
      ? () => ''
      : getNextPaginationKey<QueryAllTickLiquidityRequest>(
          // set unique cache key for this client method
          'dualitylabs.duality.dex.tickLiquidityAll',
          params
        ),
    !params
      ? null
      : async ([, params]: [
          _: string,
          params: QueryAllTickLiquidityRequest
        ]) => {
          const client = await lcdClientPromise;
          return await client.dualitylabs.duality.dex.tickLiquidityAll(params);
        },
    { persistSize: true, ...swrConfig }
  );
  // set number of pages to latest total
  useEffect(() => {
    const pageItemCount = Number(pages?.[0]?.tickLiquidity?.length);
    const totalItemCount = Number(pages?.[0]?.pagination?.total);
    if (pageItemCount > 0 && totalItemCount > pageItemCount) {
      const pageCount = Math.ceil(totalItemCount / pageItemCount);
      setSize(pageCount);
    }
  }, [pages, setSize]);

  // place pages of data into the same list
  const tradingPairs = useMemo(() => {
    const liquidity = pages?.flatMap((page) => page.tickLiquidity);
    return liquidity && transformData(liquidity);
  }, [pages]);
  return { data: tradingPairs, isValidating, error };
}

function transformData(ticks: Array<TickLiquiditySDKType>): Array<TickInfo> {
  return ticks.map<TickInfo>(function ({
    poolReserves: {
      pairID: { token0 = '', token1 = '' } = {},
      tokenIn,
      tickIndex: tickIndexString,
      fee: feeString,
      reserves: reservesString,
    } = {},
  }) {
    const tickIndex = Number(tickIndexString);
    const fee = feeString && Number(feeString);
    if (
      !isNaN(tickIndex) &&
      tokenIn &&
      token0 &&
      token1 &&
      tokenMap[tokenIn] &&
      tokenMap[token0] &&
      tokenMap[token1] &&
      !isNaN(Number(reservesString)) &&
      !isNaN(Number(fee)) &&
      fee !== undefined
    ) {
      // calculate price from tickIndex, try to keep price values consistent:
      //   JS rounding may be inconsistent with API's rounding
      const bigTickIndex = new BigNumber(tickIndex || 0);
      const bigPrice = tickIndexToPrice(bigTickIndex);

      if (tokenIn === token0) {
        return {
          token0: tokenMap[token0],
          token1: tokenMap[token1],
          tickIndex: bigTickIndex,
          price: bigPrice,
          fee: new BigNumber(fee),
          reserve0: new BigNumber(reservesString || 0),
          reserve1: new BigNumber(0),
        };
      } else if (tokenIn === token1) {
        return {
          token0: tokenMap[token0],
          token1: tokenMap[token1],
          tickIndex: bigTickIndex,
          price: bigPrice,
          fee: new BigNumber(fee),
          reserve0: new BigNumber(0),
          reserve1: new BigNumber(reservesString || 0),
        };
      }
    }
    throw new Error('Unexpected tickLiquidity shape');
  });
}

// add convenience method to fetch ticks in a pair
export function useTokenPairTickLiquidity([tokenA, tokenB]: [
  TokenAddress?,
  TokenAddress?
]): {
  data: [TickInfo[] | undefined, TickInfo[] | undefined];
  isValidating: boolean;
  error: unknown;
} {
  const [token0, token1] = useOrderedTokenPair([tokenA, tokenB]) || [];
  const pairID = token0 && token1 ? getPairID(token0, token1) : null;
  const token0TicksState = useTickLiquidity({
    query: pairID && token0 ? { pairID, tokenIn: token0 } : null,
  });
  const token1TicksState = useTickLiquidity({
    query: pairID && token1 ? { pairID, tokenIn: token1 } : null,
  });
  return {
    data: [token0TicksState.data, token1TicksState.data],
    isValidating:
      token0TicksState.isValidating && token1TicksState.isValidating,
    error: token0TicksState.error || token1TicksState.error,
  };
}
