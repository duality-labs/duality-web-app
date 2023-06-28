import { useMemo } from 'react';
import BigNumber from 'bignumber.js';

import { useShares } from '../../lib/web3/indexerProvider';

import { useDualityTokens } from '../../lib/web3/hooks/useTokens';

import { Token, getAmountInDenom } from '../../lib/web3/utils/tokens';
import { calculateShares } from '../../lib/web3/utils/ticks';
import { hasInvertedOrder } from '../../lib/web3/utils/pairs';
import { IndexedShare } from '../../lib/web3/utils/shares';
import { useTokenPairTickLiquidity } from '../../lib/web3/hooks/useTickLiquidity';

export interface ShareValue {
  share: IndexedShare;
  token0: Token;
  token1: Token;
}
export interface TickShareValue extends ShareValue {
  userReserves0: BigNumber;
  userReserves1: BigNumber;
}
export interface ShareValueMap {
  [pairID: string]: Array<ShareValue>;
}

// this is a function that exists in the backend
// but is not easily queried from here
// perhaps the backend could return these values on each Share object
export function getVirtualTickIndexes(
  tickIndex: number | string | undefined,
  fee: number | string | undefined
): [number, number] | [] {
  const feePoints = Number(fee);
  const middleIndex = Number(tickIndex);
  return feePoints && !isNaN(feePoints) && !isNaN(middleIndex)
    ? [middleIndex + feePoints, middleIndex - feePoints]
    : [];
}

// get share values of all shares or just one shares pair
export default function useShareValueMap(givenTokenPair?: [Token, Token]) {
  const { data: shares } = useShares();
  const dualityTokens = useDualityTokens();

  return useMemo(() => {
    if (shares) {
      return shares.reduce<ShareValueMap>((result, share) => {
        const { pairId = '', fee, sharesOwned } = share;
        const [shareToken0, shareToken1] = pairId.split('<>');
        // skip this share object if there are no shares owned
        if (fee === undefined || !(Number(sharesOwned) > 0)) return result;
        const [tokenA, tokenB] = givenTokenPair
          ? [
              givenTokenPair.find((token) => token.address === shareToken0),
              givenTokenPair.find((token) => token.address === shareToken1),
            ]
          : [
              shareToken0
                ? dualityTokens.find((token) => token.address === shareToken0)
                : undefined,
              shareToken1
                ? dualityTokens.find((token) => token.address === shareToken1)
                : undefined,
            ];
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
          // add TickShareValue to TickShareValueMap
          result[pairId] = result[pairId] || [];
          result[pairId].push(shareValue);
        }
        return result;
      }, {});
    }
  }, [shares, givenTokenPair, dualityTokens]);
}

export function useTickShareValue(
  shareValue: ShareValue
): TickShareValue | undefined {
  const [tickShareValue] = useTickShareValues([shareValue]) || [];
  return tickShareValue;
}

// get tick shave values from an array of shareValues that share the same tokens
export function useTickShareValues(
  shareValues: ShareValue[]
): TickShareValue[] | undefined {
  // assuming that all tokens in the array are the same
  const {
    data: [token0Ticks, token1Ticks],
  } = useTokenPairTickLiquidity([
    shareValues[0]?.token0?.address,
    shareValues[0]?.token1?.address,
  ]);

  return (
    shareValues
      .map<TickShareValue | undefined>((shareValue: ShareValue) => {
        const { tickIndex, fee, sharesOwned } = shareValue.share;
        const [tickIndex1, tickIndex0] = getVirtualTickIndexes(tickIndex, fee);

        // the reason that we fetch the reserve0 and reserve1 context
        // from the indexed ticks is because these reserves indicated
        // which tokens the user's shares currently represent.
        // eg. user has 100 shares: is that currently in token0 or token1?
        //     if indexed data has 0/2000000 token0/token1 reserves
        //     then the user's share is best represented in token1 values
        // todo: this may be better optimized as an estimation using
        //       only the first page of results of each token in a pair
        //       when a token pair has many (constantly updating) tick pages
        const tick0 =
          tickIndex0 &&
          token0Ticks?.find(
            (tick) =>
              tick.fee.isEqualTo(fee) && tick.tickIndex.isEqualTo(tickIndex0)
          );
        const tick1 =
          tickIndex1 &&
          token1Ticks?.find(
            (tick) =>
              tick.fee.isEqualTo(fee) && tick.tickIndex.isEqualTo(tickIndex1)
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
        if (
          tickIndex0 !== undefined &&
          tickIndex1 !== undefined &&
          totalShares.isGreaterThan(0)
        ) {
          const shareFraction = new BigNumber(sharesOwned ?? 0).dividedBy(
            totalShares
          );
          return {
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
        }
        return undefined;
      })
      // filter to valid found tick share values
      .filter((tickShareValue): tickShareValue is TickShareValue =>
        Boolean(tickShareValue)
      )
  );
}
