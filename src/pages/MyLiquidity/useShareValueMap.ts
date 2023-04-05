import { useMemo } from 'react';
import BigNumber from 'bignumber.js';

import {
  useIndexerData,
  useShares,
  TickInfo,
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
  userReserves0?: BigNumber;
  userReserves1?: BigNumber;
}
export interface TickShareValue extends ShareValue {
  // todo: take from useShareValueMap??
  feeIndex: number;
  tick0: TickInfo;
  tick1: TickInfo;
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
          const extendedShare: ShareValue = { share, token0, token1 };
          const [tickIndex1, tickIndex0] = getVirtualTickIndexes(
            tickIndex,
            feeIndex
          );
          if (tickIndex0 === undefined || tickIndex1 === undefined) {
            return result;
          }
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
          const totalShares =
            tick0 && tick1
              ? calculateShares({
                  price: tick0.price,
                  reserve0: tick0.reserve0,
                }).plus(
                  calculateShares({
                    price: tick1.price,
                    reserve1: tick1.reserve1,
                  })
                )
              : new BigNumber(0);
          // add optional tick data from indexer
          if (tick0 && tick1 && totalShares) {
            const shareFraction = new BigNumber(sharesOwned ?? 0).dividedBy(
              totalShares
            );
            extendedShare.userReserves0 = shareFraction.multipliedBy(
              // convert to big tokens
              getAmountInDenom(
                tick0.token0,
                tick0.reserve0,
                tick0.token0.address,
                tick0.token0.display
              ) || '0'
            );
            extendedShare.userReserves1 = shareFraction.multipliedBy(
              // convert to big tokens
              getAmountInDenom(
                tick1.token1,
                tick1.reserve1,
                tick1.token1.address,
                tick1.token1.display
              ) || '0'
            );
            // add TickShareValue to TickShareValueMap
            result[pairId] = result[pairId] || [];
            result[pairId].push({
              ...extendedShare,
              tick0,
              tick1,
              feeIndex: Number(feeIndex),
            });
          }
        }
        return result;
      }, {});
    }
  }, [shares, indexer, dualityTokens]);
}
