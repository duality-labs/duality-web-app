import BigNumber from 'bignumber.js';
import React, {
  useState,
  useMemo,
  useCallback,
  useLayoutEffect,
  MouseEvent,
  useRef,
  useEffect,
  ComponentType,
  ReactNode,
} from 'react';
import useResizeObserver from '@react-hook/resize-observer';

import {
  formatAmount,
  formatPrice,
  formatMaximumSignificantDecimals,
  roundToSignificantDigits,
} from '../../lib/utils/number';
import { Token } from '../../lib/web3/utils/tokens';
import { useOrderedTokenPair } from '../../lib/web3/hooks/useTokenPairs';
import { useTokenPairTickLiquidity } from '../../lib/web3/hooks/useTickLiquidity';
import {
  TickInfo,
  priceToTickIndex,
  tickIndexToPrice,
} from '../../lib/web3/utils/ticks';
import useCurrentPriceIndexFromTicks from './useCurrentPriceFromTicks';
import useOnDragMove from '../hooks/useOnDragMove';

interface TokenTick {
  reserve: BigNumber;
  tickIndexBToA: number;
  priceBToA: BigNumber;
  fee: number;
  token: Token;
}

type TokenTickGroup = Array<TokenTick>;

type TickGroupBucketsEmpty = Array<
  [lowerIndexBound: number, upperIndexBound: number]
>;
type TickGroupBucketsFilled = Array<
  [lowerIndexBound: number, upperIndexBound: number, reserveValue: BigNumber]
>;
type TickGroupMergedBucketsFilled = Array<
  [
    lowerIndexBound: number,
    upperIndexBound: number,
    reserveValueA: BigNumber,
    reserveValueB: BigNumber
  ]
>;

// calculate bucket extents
function getEmptyBuckets(
  // get bucket number
  containerWidth = 1,
  bucketWidth = 1,
  // get bounds
  graphMinIndex: number,
  graphMaxIndex: number,
  // adjust bucket number and bounds
  edgePriceIndex: number
): [TickGroupBucketsEmpty, TickGroupBucketsEmpty] {
  // get middle 'break' point which will separate bucket sections
  const indexNow = Math.round(edgePriceIndex);
  const indexMin = Math.floor(graphMinIndex);
  const indexMax = Math.ceil(graphMaxIndex);
  const currentPriceIsWithinView = indexMin <= indexNow && indexNow <= indexMax;

  // estimate number of buckets needed
  const bucketCount =
    Math.max(Math.ceil(containerWidth / bucketWidth), 1) + // default to 1 bucket if none
    (currentPriceIsWithinView ? 1 : 0); // add bucket to account for splitting bucket on current price within view

  // find number of indexes on each side to show
  const tokenAIndexCount =
    indexNow >= indexMin ? Math.min(indexNow, indexMax) - indexMin + 1 : 0;
  const tokenBIndexCount =
    indexNow <= indexMax ? indexMax - Math.max(indexNow, indexMin) + 1 : 0;

  // find number of buckets on each side to show
  const indexTotalCount = tokenAIndexCount + tokenBIndexCount;
  const indexesPerBucketCount = Math.ceil(indexTotalCount / bucketCount);
  const tokenABucketCount = Math.ceil(tokenAIndexCount / indexesPerBucketCount);
  const tokenBBucketCount = Math.ceil(tokenBIndexCount / indexesPerBucketCount);

  // compute the limits of tokenA buckets
  const tokenABuckets = Array.from({
    length: Math.max(0, tokenABucketCount),
  }).reduce<[min: number, max: number][]>((result) => {
    const newValue = result[0]?.[0] ?? Math.min(indexMax, indexNow);
    // prepend new bucket
    return [[newValue - indexesPerBucketCount, newValue], ...result];
  }, []);

  // compute the limits of tokenB buckets
  const tokenBBuckets = Array.from({
    length: Math.max(0, tokenBBucketCount),
  }).reduce<[min: number, max: number][]>((result) => {
    const newValue =
      result[result.length - 1]?.[1] ?? Math.max(indexMin, indexNow);
    // append new bucket
    return [...result, [newValue, newValue + indexesPerBucketCount]];
  }, []);

  // return concantenated buckets
  return [tokenABuckets, tokenBBuckets];
}

function fillBuckets(
  emptyBuckets: TickGroupBucketsEmpty,
  originalTicks: TokenTick[],
  matchSide: 'upper' | 'lower',
  edgePriceIndex: number,
  getReserveValue: (reserve: BigNumber) => BigNumber
): TickGroupBucketsFilled {
  const ticks = originalTicks.filter(({ reserve }) => !reserve.isZero());
  return emptyBuckets.reduceRight<TickGroupBucketsFilled>(
    (result, [lowerIndexBound, upperIndexBound]) => {
      const reserve = ticks.reduceRight(
        (result, { tickIndexBToA, reserve }, index, ticks) => {
          // match buckets differently above and below the current pair price
          // the bucket matching starts from the current price and extends
          // outward in both directions so left buckets match for < bucket edge
          // and right buckets match for > bucket edge
          const sideLower =
            tickIndexBToA === edgePriceIndex
              ? // for ticks exactly on current price side with the direction of given token
                matchSide === 'lower'
              : tickIndexBToA > edgePriceIndex;
          const matchToken = sideLower
            ? // match from lower bound
              tickIndexBToA >= lowerIndexBound &&
              tickIndexBToA < upperIndexBound
            : // match from upper bound
              tickIndexBToA > lowerIndexBound &&
              tickIndexBToA <= upperIndexBound;
          // remove tick so it doesn't need to be iterated on again in next bucket
          if (matchToken) {
            ticks.splice(index, 1);
            return result.plus(reserve);
          } else {
            return result;
          }
        },
        new BigNumber(0)
      );
      // place tokenA buckets to the left of the current price
      if (reserve.isGreaterThan(0)) {
        result.push([
          lowerIndexBound,
          upperIndexBound,
          getReserveValue(reserve),
        ]);
      }
      return result;
    },
    []
  );
}

// merge buckets takes buckets of form TickGroupBucketsFilled
//  - Array<[lowerIndexBound: number, upperIndexBound: number, reserve: BigNumber]>
// and merges them into one list of form TickGroupMergedBucketsFilled
//  - Array<[lowerIndexBound: number, upperIndexBound: number, reserveA: BigNumber, reserveB: BigNumber]>
function mergeBuckets(
  tokenABuckets: TickGroupBucketsFilled,
  tokenBBuckets: TickGroupBucketsFilled
): TickGroupMergedBucketsFilled {
  const mergedTokenABuckets: TickGroupMergedBucketsFilled = tokenABuckets.map(
    ([lowerBoundIndex, upperBoundIndex, valueA]) => {
      return [lowerBoundIndex, upperBoundIndex, valueA, new BigNumber(0)];
    }
  );
  const mergedTokenBBuckets: TickGroupMergedBucketsFilled = tokenBBuckets.map(
    ([lowerBoundIndex, upperBoundIndex, valueB]) => {
      return [lowerBoundIndex, upperBoundIndex, new BigNumber(0), valueB];
    }
  );

  // merge all buckets by their bounds
  const mergedTokenBucketsByKey = ([] as TickGroupMergedBucketsFilled)
    .concat(mergedTokenABuckets, mergedTokenBBuckets)
    .reduce<{
      [bucketKey: string]: TickGroupMergedBucketsFilled[number];
    }>((acc, [lowerBoundIndex, upperBoundIndex, valueA, valueB]) => {
      const key = [lowerBoundIndex, upperBoundIndex].join('-');
      // merge bucket
      if (acc[key]) {
        // add reserve values together
        acc[key][2] = acc[key][2].plus(valueA);
        acc[key][3] = acc[key][3].plus(valueB);
      }
      // add bucket
      else {
        acc[key] = [lowerBoundIndex, upperBoundIndex, valueA, valueB];
      }
      return acc;
    }, {});
  // return the merged buckets as a single array
  return Object.values(mergedTokenBucketsByKey);
}

export function useTickLiquidityBuckets({
  tokenA,
  tokenB,
  containerWidth,
  bucketWidth,
  viewableMinIndex,
  viewableMaxIndex,
  edgePriceIndex,
}: {
  tokenA: Token | undefined;
  tokenB: Token | undefined;
  containerWidth: number;
  bucketWidth: number;
  viewableMinIndex: number;
  viewableMaxIndex: number;
  edgePriceIndex: number | undefined;
}) {
  const [tokenATicks, tokenBTicks] = useTokenTicks(tokenA, tokenB);

  // calculate histogram values
  const tickBuckets = useMemo<TickGroupMergedBucketsFilled>(() => {
    // if no buckets will be filled, then return no buckets
    if (
      edgePriceIndex === undefined ||
      tokenATicks.length + tokenBTicks.length <= 0
    ) {
      return [];
    }
    const emptyBuckets = getEmptyBuckets(
      containerWidth,
      bucketWidth,
      viewableMinIndex,
      viewableMaxIndex,
      edgePriceIndex
    );
    const edgePrice = tickIndexToPrice(new BigNumber(edgePriceIndex));
    return mergeBuckets(
      fillBuckets(
        emptyBuckets.flat(),
        tokenATicks,
        'upper',
        edgePriceIndex,
        getReserveAValue
      ),
      fillBuckets(
        emptyBuckets.flat(),
        tokenBTicks,
        'lower',
        edgePriceIndex,
        getReserveBValue
      )
    );
    function getReserveAValue(reserve: BigNumber): BigNumber {
      return reserve;
    }
    function getReserveBValue(reserve: BigNumber): BigNumber {
      return reserve.multipliedBy(edgePrice);
    }
  }, [
    tokenATicks,
    tokenBTicks,
    containerWidth,
    bucketWidth,
    viewableMinIndex,
    viewableMaxIndex,
    edgePriceIndex,
  ]);

  return tickBuckets;
}

function useTokenTicks(tokenA: Token | undefined, tokenB: Token | undefined) {
  const [token0Address, token1Address] =
    useOrderedTokenPair([tokenA?.address, tokenB?.address]) || [];
  const {
    data: [token0Ticks = [], token1Ticks = []],
  } = useTokenPairTickLiquidity([token0Address, token1Address]);

  const [forward, reverse] = [
    token0Address === tokenA?.address && token1Address === tokenB?.address,
    token1Address === tokenA?.address && token0Address === tokenB?.address,
  ];

  // translate ticks from token0/1 to tokenA/B
  const [tokenATicks, tokenBTicks]: [TokenTickGroup, TokenTickGroup] =
    useMemo(() => {
      function mapWith(isToken1: boolean | 0 | 1) {
        return ({
          token0,
          token1,
          reserve0,
          reserve1,
          tickIndex1To0,
          price1To0,
          fee,
        }: TickInfo): TokenTick => {
          return {
            token: isToken1 ? token1 : token0,
            reserve: isToken1 ? reserve1 : reserve0,
            tickIndexBToA: tickIndex1To0
              .multipliedBy(forward ? 1 : -1)
              .toNumber(),
            priceBToA: forward
              ? price1To0
              : new BigNumber(1).dividedBy(price1To0),
            fee: fee.toNumber(),
          };
        };
      }

      return forward || reverse
        ? [
            forward ? token0Ticks.map(mapWith(0)) : token1Ticks.map(mapWith(1)),
            forward ? token1Ticks.map(mapWith(1)) : token0Ticks.map(mapWith(0)),
          ]
        : [[], []];
    }, [token0Ticks, token1Ticks, forward, reverse]);

  return [tokenATicks, tokenBTicks];
}
