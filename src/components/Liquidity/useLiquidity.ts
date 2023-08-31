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

import './LiquiditySelector.scss';
import {
  useChartIndexes,
  useLiquidityDataExtents,
  useUserRangeExtents,
  useUserTickExtents,
} from './useChartExtents';
import { useCurrentPriceIndex } from './useCurrentPriceIndex';
import usePlotFunctions from './usePlot';

const { REACT_APP__MAX_TICK_INDEXES = '' } = process.env;
const [
  priceMinIndex = Number.MIN_SAFE_INTEGER,
  priceMaxIndex = Number.MAX_SAFE_INTEGER,
] = REACT_APP__MAX_TICK_INDEXES.split(',').map(Number).filter(Boolean);

export interface LiquiditySelectorProps {
  tokenA?: Token;
  tokenB?: Token;
  fee: number | undefined;
  userTickSelected: number | undefined;
  setUserTickSelected: (index: number) => void;
  initialPrice?: string;
  rangeMin: string;
  rangeMax: string;
  setRange: React.Dispatch<React.SetStateAction<[string, string]>>;
  setSignificantDecimals?: React.Dispatch<React.SetStateAction<number>>;
  setViewableIndexes: React.Dispatch<
    React.SetStateAction<[number, number] | undefined>
  >;
  userTicksBase?: Array<Tick | undefined>;
  userTicks?: Array<Tick | undefined>;
  setUserTicks?: (callback: (userTicks: TickGroup) => TickGroup) => void;
  advanced?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  canMoveX?: boolean;
  oneSidedLiquidity?: boolean;
  ControlsComponent?: ComponentType<{
    zoomIn?: () => void;
    zoomOut?: () => void;
  }>;
}

export interface Tick {
  reserveA: BigNumber;
  reserveB: BigNumber;
  tickIndexBToA: number;
  priceBToA: BigNumber;
  fee: number;
  tokenA: Token;
  tokenB: Token;
}
export type TickGroup = Array<Tick>;

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

const bucketWidth = 8; // bucket width in pixels

const defaultMinIndex = priceToTickIndex(new BigNumber(1 / 1.1)).toNumber();
const defaultMaxIndex = priceToTickIndex(new BigNumber(1.1)).toNumber();

// set maximum zoom constants:
// zooming past the resolution of ticks does not help the end users.
const minZoomIndexSpread = 10; // approx minimum number of indexes to show on the graph at once
const zoomSpeedFactor = 2; // zoom in/out means divide/multiply the number of shown tick indexes by x
// zoom limits: the *2 allows us to see more of the axis labels when zoomed out
const zoomMinIndexLimit = priceMinIndex * 2;
const zoomMaxIndexLimit = priceMaxIndex * 2;

const leftPadding = 75;
const rightPadding = 75;
const topPadding = 33;
const bottomPadding = 26; // height of axis-ticks element

const poleWidth = 8;

export default function useLiquidity({
  tokenA,
  tokenB,
  fee,
  userTickSelected = -1,
  setUserTickSelected,
  initialPrice = '',
  rangeMin,
  rangeMax,
  setRange,
  setSignificantDecimals,
  setViewableIndexes,
  userTicks = [],
  userTicksBase = userTicks,
  setUserTicks,
  advanced = false,
  canMoveUp,
  canMoveDown,
  canMoveX,
  oneSidedLiquidity = false,
  ControlsComponent,
}: LiquiditySelectorProps) {
  const [dataMinIndex, dataMaxIndex] = useLiquidityDataExtents(tokenA, tokenB);
  const edgePriceIndex = useCurrentPriceIndex(tokenA, tokenB, initialPrice);

  const [rangeMinIndex, rangeMaxIndex] = useUserRangeExtents(
    rangeMin,
    rangeMax,
    edgePriceIndex
  );
  const [userTicksMinIndex, userTicksMaxIndex] = useUserTickExtents(userTicks);

  // set some somewhat reasonable starting zoom points
  // these really only affect the view when no data is present
  // and we want the dragging of limits to feel reasonably sensible\
  const [
    [
      zoomMinIndex = zoomMinIndexLimit / 10,
      zoomMaxIndex = zoomMaxIndexLimit / 10,
    ] = [],
    setZoomRangeUnprotected,
  ] = useState<[number, number]>();

  const setZoomRange = useCallback(([zoomMinIndex, zoomMaxIndex]: number[]) => {
    // set zoom limits
    setZoomRangeUnprotected([
      Math.max(zoomMinIndex, zoomMinIndexLimit),
      Math.min(zoomMaxIndex, zoomMaxIndexLimit),
    ]);
  }, []);

  const [graphMinIndex, graphMaxIndex] = useChartIndexes({
    // total tick liquidity range
    dataMinIndex,
    dataMaxIndex,

    // user set tick liquidity range
    userTicksMinIndex,
    userTicksMaxIndex,

    // user set range
    rangeMinIndex,
    rangeMaxIndex,

    // user set zoom range
    zoomMinIndex,
    zoomMaxIndex,

    // current estimated price
    edgePriceIndex,
  });

  const setRangeMinIndex: React.Dispatch<React.SetStateAction<number>> =
    useCallback(
      (valueOrCallback) => {
        setRange(([min, max]) => {
          // get new min index value value
          const newMinIndex =
            typeof valueOrCallback === 'function'
              ? valueOrCallback(priceToTickIndex(new BigNumber(min)).toNumber())
              : valueOrCallback;
          // convert index to price
          return [tickIndexToPrice(new BigNumber(newMinIndex)).toFixed(), max];
        });
      },
      [setRange]
    );
  const setRangeMaxIndex: React.Dispatch<React.SetStateAction<number>> =
    useCallback(
      (valueOrCallback) => {
        setRange(([min, max]) => {
          // get new max index value value
          const newMaxIndex =
            typeof valueOrCallback === 'function'
              ? valueOrCallback(priceToTickIndex(new BigNumber(max)).toNumber())
              : valueOrCallback;
          // convert index to price
          return [min, tickIndexToPrice(new BigNumber(newMaxIndex)).toFixed()];
        });
      },
      [setRange]
    );

  const isUserTicksAZero =
    oneSidedLiquidity &&
    userTicks.every((tick) => tick?.reserveA.isZero() ?? true);
  const isUserTicksBZero =
    oneSidedLiquidity &&
    userTicks.every((tick) => tick?.reserveB.isZero() ?? true);

  // // note warning price, the price at which warning states should be shown
  // const [tokenAWarningPriceIndex, tokenBWarningPriceIndex] = useMemo(() => {
  //   const [tokenAEdgeTick]: (TokenTick | undefined)[] = tokenATicks;
  //   const [tokenBEdgeTick]: (TokenTick | undefined)[] = tokenBTicks;
  //   return oneSidedLiquidity
  //     ? // for one-sided liquidity this is the behind enemy lines check
  //       [
  //         !isUserTicksAZero ? tokenBEdgeTick?.tickIndexBToA : undefined,
  //         !isUserTicksBZero ? tokenAEdgeTick?.tickIndexBToA : undefined,
  //       ]
  //     : // for double-sided liquidity we switch on the current price
  //       [edgePriceIndex, edgePriceIndex];
  // }, [
  //   oneSidedLiquidity,
  //   edgePriceIndex,
  //   isUserTicksAZero,
  //   isUserTicksBZero,
  //   tokenATicks,
  //   tokenBTicks,
  // ]);

  const [zoomedRangeMinIndex, zoomedRangeMaxIndex] = useMemo<number[]>(() => {
    if (
      zoomMinIndex !== undefined &&
      zoomMaxIndex !== undefined &&
      !isNaN(Number(zoomMinIndex)) &&
      !isNaN(Number(zoomMaxIndex))
    ) {
      if (
        rangeMinIndex &&
        rangeMaxIndex &&
        isNaN(rangeMinIndex) === false &&
        isNaN(rangeMaxIndex) === false
      ) {
        return [
          Math.min(rangeMinIndex, zoomMinIndex),
          Math.max(rangeMaxIndex, zoomMaxIndex),
        ];
      } else {
        return [zoomMinIndex, zoomMaxIndex];
      }
    }
    return [rangeMinIndex, rangeMaxIndex];
  }, [zoomMinIndex, zoomMaxIndex, rangeMinIndex, rangeMaxIndex]);

  // find container size that buckets should fit
  const svgContainer = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    setContainerSize({
      width: svgContainer.current?.clientWidth ?? 0,
      height: svgContainer.current?.clientHeight ?? 0,
    });
  }, [svgContainer]);

  useResizeObserver(svgContainer, (container) =>
    setContainerSize({
      width: container.contentRect.width,
      height: container.contentRect.height,
    })
  );

  // find significant digits for display on the chart that makes sense
  // eg. when viewing from 1-100 just 3 significant digits is fine
  //     when viewing from 100-100.01 then 6 significant digits is needed
  const dynamicSignificantDigits = useMemo(() => {
    const diff = Math.min(
      graphMaxIndex - graphMinIndex,
      rangeMaxIndex - rangeMinIndex
    );
    switch (true) {
      case diff <= 25:
        return 6;
      case diff <= 250:
        return 5;
      case diff <= 2500:
        return 4;
      default:
        return 3;
    }
  }, [graphMinIndex, graphMaxIndex, rangeMinIndex, rangeMaxIndex]);

  useEffect(() => {
    setSignificantDecimals?.(dynamicSignificantDigits);
  }, [setSignificantDecimals, dynamicSignificantDigits]);

  const [plotX, plotY, percentY] = usePlotFunctions({
    tokenA,
    tokenB,
    initialPriceFormValue: initialPrice,
    containerWidth: containerSize.width,
    containerHeight: containerSize.height,
    graphMinIndex,
    graphMaxIndex,
  });

  const plotYBigNumber = useCallback(
    (y: BigNumber) => plotY(y.toNumber()),
    [plotY]
  );
  const percentYBigNumber = useCallback(
    (y: BigNumber) => percentY(y.toNumber()),
    [percentY]
  );

  const [zoomIn, zoomOut] = useMemo(() => {
    // define common zoom behavior
    function zoom(direction: 'in' | 'out') {
      if (
        [rangeMinIndex, rangeMaxIndex, graphMinIndex, graphMaxIndex].every(
          (v) => !isNaN(v)
        )
      ) {
        const midpointIndex = (rangeMinIndex + rangeMaxIndex) / 2;
        const indexSpread = Math.max(
          minZoomIndexSpread,
          direction === 'in'
            ? // zoom in by defining less indexes on graph
              (graphMaxIndex - graphMinIndex) / zoomSpeedFactor
            : // zoom out by defining more indexes on graph
              (graphMaxIndex - graphMinIndex) * zoomSpeedFactor
        );
        const newZoomMinIndex = Math.round(midpointIndex - indexSpread / 2);
        const newZoomMaxIndex = Math.round(midpointIndex + indexSpread / 2);
        // calculate better positioning of new range as it could end up far to the side
        const offset =
          0 +
          // bump from left edge of data
          Math.max(graphMinIndex - newZoomMinIndex, 0) +
          // bump from right edge of data
          Math.min(graphMaxIndex - newZoomMaxIndex, 0);
        // set these new values
        return [newZoomMinIndex + offset, newZoomMaxIndex + offset];
      } else {
        return [graphMinIndex, graphMaxIndex];
      }
    }

    function zoomIn() {
      const [newZoomMinIndex, newZoomMaxIndex] = zoom('in');
      setZoomRange([newZoomMinIndex, newZoomMaxIndex]);
      setRangeMinIndex((rangeMinIndex: number) =>
        Math.max(rangeMinIndex, newZoomMinIndex)
      );
      setRangeMaxIndex((rangeMaxIndex: number) =>
        Math.min(rangeMaxIndex, newZoomMaxIndex)
      );
    }
    function zoomOut() {
      const [newZoomMinIndex, newZoomMaxIndex] = zoom('out');
      setZoomRange([newZoomMinIndex, newZoomMaxIndex]);
    }
    return [zoomIn, zoomOut];
  }, [
    rangeMinIndex,
    rangeMaxIndex,
    graphMinIndex,
    graphMaxIndex,
    setRangeMinIndex,
    setRangeMaxIndex,
    setZoomRange,
  ]);

  return;
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

function getRangePositions(
  currentPriceIndex: number | undefined,
  fractionalRangeMinIndex: number,
  fractionalRangeMaxIndex: number
): [number, number] {
  const roundedCurrentPriceIndex =
    currentPriceIndex && Math.round(currentPriceIndex);
  const [rangeMinIndex, rangeMaxIndex] = getRangeIndexes(
    currentPriceIndex,
    fractionalRangeMinIndex,
    fractionalRangeMaxIndex
  );
  // move one away from the tick index in question
  // ie. make the range flag be "around" the desired range (not "on" it)
  if (roundedCurrentPriceIndex === undefined) {
    return [rangeMinIndex, rangeMaxIndex];
  }
  return [
    rangeMinIndex + (rangeMinIndex <= roundedCurrentPriceIndex ? -1 : 0),
    rangeMaxIndex + (rangeMaxIndex >= roundedCurrentPriceIndex ? +1 : 0),
  ];
}

export function getRangeIndexes(
  currentPriceIndex: number | undefined,
  fractionalRangeMinIndex: number,
  fractionalRangeMaxIndex: number
) {
  const roundedCurrentPriceIndex =
    currentPriceIndex && Math.round(currentPriceIndex);
  const rangeMinIndex = roundToSignificantDigits(fractionalRangeMinIndex);
  const rangeMaxIndex = roundToSignificantDigits(fractionalRangeMaxIndex);
  // align fractional index positions to whole tick index positions
  // for the min and max cases
  if (roundedCurrentPriceIndex === undefined) {
    return [rangeMinIndex - 0.5, rangeMaxIndex + 0.5];
  }
  return [
    Math.ceil(rangeMinIndex) +
      (rangeMinIndex >= roundedCurrentPriceIndex ? -1 : 0),
    Math.floor(rangeMaxIndex) +
      (rangeMaxIndex <= roundedCurrentPriceIndex ? +1 : 0),
  ];
}

function getMinYHeight(tickCount: number): number {
  return 1 / ((tickCount - 2) / 6 + 2) + 0.4;
}
