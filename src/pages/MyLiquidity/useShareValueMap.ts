import { useMemo } from 'react';
import BigNumber from 'bignumber.js';

import {
  useIndexerData,
  useShares,
  hasInvertedOrder,
} from '../../lib/web3/indexerProvider';
import { feeTypes } from '../../lib/web3/utils/fees';

import { Token, useDualityTokens } from '../../components/TokenPicker/hooks';

import { getAmountInDenom } from '../../lib/web3/utils/tokens';
import { calculateShares } from '../../lib/web3/utils/ticks';
import { IndexedShare } from '../../lib/web3/utils/shares';

export interface ShareValue {
  share: IndexedShare;
  token0: Token;
  token1: Token;
}
export interface TickShareValue extends ShareValue {
  userReserves0: BigNumber;
  userReserves1: BigNumber;
}
export interface TickShareValueMap {
  [pairID: string]: Array<TickShareValue>;
}

// this is a function that exists in the backend
// but is not easily queried from here
// perhaps the backend could return these values on each Share object
export function getVirtualTickIndexes(
  tickIndex: number | string | undefined,
  feeIndex: number | string | undefined
): [number, number] | [] {
  const feePoints = feeTypes[Number(feeIndex)].fee * 10000;
  const middleIndex = Number(tickIndex);
  return feePoints && !isNaN(middleIndex)
    ? [middleIndex + feePoints, middleIndex - feePoints]
    : [];
}

export default function useShareValueMap() {
  const { data: indexer } = useIndexerData();
  const { data: shares } = useShares();
  const dualityTokens = useDualityTokens();

  return useMemo(() => {
    if (shares && indexer) {
      return shares.reduce<TickShareValueMap>((result, share) => {
        const { pairId = '', tickIndex, feeIndex, sharesOwned } = share;
        // skip this share object if there are no shares owned
        if (feeIndex === undefined || !(Number(sharesOwned) > 0)) return result;
        const [tokenA, tokenB] = dualityTokens;
        const fee = feeTypes[Number(feeIndex)].fee;
        if (
          tokenA &&
          tokenA.address &&
          tokenB &&
          tokenB.address &&
          fee !== undefined
        ) {
          const inverted = hasInvertedOrder(
            pairId,
            tokenA.address,
            tokenB.address
          );
          const [token0, token1] = inverted
            ? [tokenB, tokenA]
            : [tokenA, tokenB];
          const shareValue: ShareValue = { share, token0, token1 };
          const [tickIndex1, tickIndex0] = getVirtualTickIndexes(
            tickIndex,
            feeIndex
          );
          if (tickIndex0 === undefined || tickIndex1 === undefined) {
            return result;
          }
          // the reason that we fetch the reserve0 and reserve1 context
          // from the indexed ticks is because these reserves indicated
          // which tokens the user's shares currently represent.
          // eg. user has 100 shares: is that currently in token0 or token1?
          //     if indexed data has 0/2000000 token0/token1 reserves
          //     then the user's share is best represented in token1 values
          // todo: this may be better optimized as an estimation using
          //       only the first page of results of each token in a pair
          //       when a token pair has many (constantly updating) tick pages
          const tick0 = (indexer[pairId]?.token0Ticks || []).find(
            (tick) =>
              tick.feeIndex.isEqualTo(feeIndex) &&
              tick.tickIndex.isEqualTo(tickIndex0)
          );
          const tick1 = (indexer[pairId]?.token1Ticks || []).find(
            (tick) =>
              tick.feeIndex.isEqualTo(feeIndex) &&
              tick.tickIndex.isEqualTo(tickIndex1)
          );
          const tick0Shares =
            tick0 &&
            calculateShares({
              price: tick0.price,
              reserve0: tick0.reserve0,
            });
          const tick1Shares =
            tick1 &&
            calculateShares({
              price: tick1.price,
              reserve1: tick1.reserve1,
            });
          // total shares if found
          const totalShares = new BigNumber(0)
            .plus(tick0Shares || 0)
            .plus(tick1Shares || 0);

          // add optional tick data from indexer
          if (totalShares.isGreaterThan(0)) {
            const shareFraction = new BigNumber(sharesOwned ?? 0).dividedBy(
              totalShares
            );
            const extendedShare: TickShareValue = {
              ...shareValue,
              userReserves0: tick0
                ? shareFraction.multipliedBy(
                    // convert to big tokens
                    getAmountInDenom(
                      tick0.token0,
                      tick0.reserve0,
                      tick0.token0.address,
                      tick0.token0.display
                    ) || '0'
                  )
                : new BigNumber(0),
              userReserves1: tick1
                ? shareFraction.multipliedBy(
                    // convert to big tokens
                    getAmountInDenom(
                      tick1.token1,
                      tick1.reserve1,
                      tick1.token1.address,
                      tick1.token1.display
                    ) || '0'
                  )
                : new BigNumber(0),
            };
            // add TickShareValue to TickShareValueMap
            result[pairId] = result[pairId] || [];
            result[pairId].push(extendedShare);
          }
        }
        return result;
      }, {});
    }
  }, [shares, indexer, dualityTokens]);
}
