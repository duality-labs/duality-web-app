import BigNumber from 'bignumber.js';
import { useMemo } from 'react';

import { useRealtimeDisplayPrice } from '../../components/stats/hooks';
import {
  ReserveDataRow,
  useTokenPairMapLiquidity,
} from '../../lib/web3/hooks/useTickLiquidity';

import { tickIndexToDisplayPrice } from '../../lib/web3/utils/ticks';
import {
  Token,
  getDisplayDenomAmount,
  getTokenId,
} from '../../lib/web3/utils/tokens';
import { getOrderOfMagnitude } from '../../lib/utils/number';

export type Bucket = [
  innerBound: number,
  outerBound: number,
  displayReserves: number
];
export type Buckets = [bucketsA: Bucket[], bucketsB: Bucket[], height: number];

export default function useBucketsByPriceResolution(
  tokenA?: Token,
  tokenB?: Token,
  bucketResolution?: number
): Buckets | undefined {
  const [tokenIdA, tokenIdB] = [getTokenId(tokenA), getTokenId(tokenB)];
  const [, currentPrice] = useRealtimeDisplayPrice(tokenA, tokenB);
  const { data: [tokenAReserves, tokenBReserves] = [], meta: { height } = {} } =
    useTokenPairMapLiquidity([tokenIdA, tokenIdB]);

  // return bucketReserves
  return useMemo((): Buckets | undefined => {
    // return no buckets if the current price is not yet defined
    if (!tokenA || !tokenB || !currentPrice || !bucketResolution || !height) {
      return undefined;
    }
    // continue
    const resolutionMagnitude = getOrderOfMagnitude(bucketResolution);
    const zero = new BigNumber(0);
    const reduceReservesToBuckets = (inverseDirection: boolean) => {
      const getDisplayPrice = !inverseDirection
        ? // get token A prices
          (tickIndex: number): BigNumber =>
            tickIndexToDisplayPrice(new BigNumber(tickIndex), tokenA, tokenB) ||
            zero
        : //   get token B prices
          (tickIndex: number): BigNumber =>
            tickIndexToDisplayPrice(
              new BigNumber(tickIndex).negated(),
              tokenA,
              tokenB
            ) || zero;
      // define reducer to accumulate buckets
      return (
        acc: Bucket[],
        [tickIndex, reserves]: ReserveDataRow
      ): Bucket[] => {
        const lastValue = acc.at(-1);
        const outerBound = lastValue?.[1];
        const displayPrice = getDisplayPrice(tickIndex);
        // does value belong in the last bucket?
        if (
          lastValue &&
          outerBound !== undefined &&
          (inverseDirection
            ? displayPrice.isLessThanOrEqualTo(outerBound)
            : displayPrice.isGreaterThanOrEqualTo(outerBound))
        ) {
          lastValue[2] += reserves;
          return acc;
        }
        // does value belong in a new bucket?
        else if (
          lastValue ||
          (inverseDirection
            ? displayPrice.isGreaterThanOrEqualTo(currentPrice)
            : displayPrice.isLessThanOrEqualTo(currentPrice))
        ) {
          // find the bucket limits from current value and bucket resolution
          const priceMagnitude = getOrderOfMagnitude(displayPrice.toNumber());
          const precision = priceMagnitude - resolutionMagnitude + 1;
          // get outer bound from the precision (or fallback to lowest value)
          const outerBound =
            precision > 0
              ? inverseDirection
                ? displayPrice
                    .precision(precision, BigNumber.ROUND_UP)
                    .toNumber()
                : displayPrice
                    .precision(precision, BigNumber.ROUND_DOWN)
                    .toNumber()
              : 0;
          // get inner bound based on outer bound, but limit to current price
          const innerBound = inverseDirection
            ? Math.max(
                // use BigNumber to avoid float imprecision (eg: 0.2+0.1)
                new BigNumber(outerBound).minus(bucketResolution).toNumber(),
                currentPrice
              )
            : Math.min(
                // use BigNumber to avoid float imprecision (eg: 0.2+0.1)
                new BigNumber(outerBound).plus(bucketResolution).toNumber(),
                currentPrice
              );
          // add the new bucket
          if (inverseDirection) {
            acc.push([innerBound, outerBound, reserves]);
          } else {
            acc.push([innerBound, outerBound, reserves]);
          }
        }
        return acc;
      };
    };
    // use the correct reducer to reduce reserves into buckets
    // in order from closest-to-current-price to furthest-from-current-price
    return [
      Array.from((tokenAReserves || []).entries())
        // ensure order from nearly-ordered map
        .sort(([a], [b]) => b - a)
        // group reserves into buckets
        .reduce<Array<Bucket>>(reduceReservesToBuckets(false), [])
        // translate reserves into displayReserves
        .map(([innerBound, outerBound, reserves]) => [
          innerBound,
          outerBound,
          Number(getDisplayDenomAmount(tokenA, reserves)),
        ]),
      Array.from((tokenBReserves || []).entries())
        // ensure order from nearly-ordered map
        .sort(([a], [b]) => b - a)
        // group reserves into buckets
        .reduce<Array<Bucket>>(reduceReservesToBuckets(true), [])
        // translate reserves into displayReserves
        .map(([innerBound, outerBound, reserves]) => [
          innerBound,
          outerBound,
          Number(getDisplayDenomAmount(tokenB, reserves)),
        ]),
      height,
    ];
  }, [
    tokenA,
    tokenB,
    currentPrice,
    bucketResolution,
    tokenAReserves,
    tokenBReserves,
    height,
  ]);
}
