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
} from 'react';
import useResizeObserver from '@react-hook/resize-observer';

import {
  formatAmount,
  formatPrice,
  formatMaximumSignificantDecimals,
} from '../../lib/utils/number';
import { feeTypes } from '../../lib/web3/utils/fees';
import { priceToTickIndex, tickIndexToPrice } from '../../lib/web3/utils/ticks';
import useCurrentPriceIndexFromTicks from './useCurrentPriceFromTicks';
import useOnDragMove from '../hooks/useOnDragMove';

import { Token } from '../TokenPicker/hooks';
import { TickInfo, useIndexerPairData } from '../../lib/web3/indexerProvider';

import './LiquiditySelector.scss';

const { REACT_APP__MAX_TICK_INDEXES = '' } = process.env;
const [
  priceMinIndex = Number.MIN_SAFE_INTEGER,
  priceMaxIndex = Number.MAX_SAFE_INTEGER,
] = REACT_APP__MAX_TICK_INDEXES.split(',').map(Number).filter(Boolean);

export interface LiquiditySelectorProps {
  tokenA: Token;
  tokenB: Token;
  feeTier: number | undefined;
  userTickSelected: number | undefined;
  setUserTickSelected: (index: number) => void;
  rangeMin: string;
  rangeMax: string;
  setRangeMin: React.Dispatch<React.SetStateAction<string>>;
  setRangeMax: React.Dispatch<React.SetStateAction<string>>;
  setSignificantDecimals?: React.Dispatch<React.SetStateAction<number>>;
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
  tickIndex: number;
  price: BigNumber;
  fee: BigNumber;
  feeIndex: number;
  tokenA: Token;
  tokenB: Token;
}
export type TickGroup = Array<Tick>;

interface TokenTick {
  reserve: BigNumber;
  tickIndex: number;
  price: BigNumber;
  fee: BigNumber;
  feeIndex: number;
  token: Token;
}
type TokenTickGroup = Array<TokenTick>;

type TickGroupBucketsEmpty = Array<
  [lowerIndexBound: number, upperIndexBound: number]
>;
type TickGroupBucketsFilled = Array<
  [lowerIndexBound: number, upperIndexBound: number, reserve: BigNumber]
>;
type TickGroupMergedBucketsFilled = Array<
  [
    lowerIndexBound: number,
    upperIndexBound: number,
    reserveA: BigNumber,
    reserveB: BigNumber
  ]
>;

const bucketWidth = 8; // bucket width in pixels

const defaultMinIndex = priceToTickIndex(new BigNumber(1 / 1.1)).toNumber();
const defaultMaxIndex = priceToTickIndex(new BigNumber(1.1)).toNumber();

// set maximum zoom constants:
// zooming past the resolution of ticks does not help the end users.
const minZoomIndexSpread = 10; // approx minimum number of indexes to show on the graph at once
const zoomSpeedFactor = 2; // zoom in/out means divide/multiply the number of shown tick indexes by x

const leftPadding = 75;
const rightPadding = 75;
const topPadding = 33;
const bottomPadding = 26; // height of axis-ticks element

const poleWidth = 8;

export default function LiquiditySelector({
  tokenA,
  tokenB,
  feeTier,
  userTickSelected = -1,
  setUserTickSelected,
  rangeMin,
  rangeMax,
  setRangeMin,
  setRangeMax,
  setSignificantDecimals,
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
  // convert range price state controls into range index state controls
  const fractionalRangeMinIndex = useMemo(() => {
    const index = priceToTickIndex(new BigNumber(rangeMin)).toNumber();
    // guard against incorrect numbers
    return !isNaN(index)
      ? Math.max(priceMinIndex, Math.min(priceMaxIndex, index))
      : defaultMinIndex;
  }, [rangeMin]);
  const fractionalRangeMaxIndex = useMemo(() => {
    const index = priceToTickIndex(new BigNumber(rangeMax)).toNumber();
    // guard against incorrect numbers
    return !isNaN(index)
      ? Math.max(priceMinIndex, Math.min(priceMaxIndex, index))
      : defaultMaxIndex;
  }, [rangeMax]);
  const setRangeMinIndex: React.Dispatch<React.SetStateAction<number>> =
    useCallback(
      (valueOrCallback) => {
        // process as a callback
        if (typeof valueOrCallback === 'function') {
          const callback = valueOrCallback;
          setRangeMin((rangeMin) => {
            // convert price to index
            const fractionalRangeMinIndex = priceToTickIndex(
              new BigNumber(rangeMin)
            ).toNumber();
            // process as index
            const value = callback(fractionalRangeMinIndex);
            // convert index back to price
            return tickIndexToPrice(new BigNumber(value)).toFixed();
          });
        }
        // process as a value
        else {
          const value = valueOrCallback;
          // convert index to price
          setRangeMin(tickIndexToPrice(new BigNumber(value)).toFixed());
        }
      },
      [setRangeMin]
    );
  const setRangeMaxIndex: React.Dispatch<React.SetStateAction<number>> =
    useCallback(
      (valueOrCallback) => {
        // process as a callback
        if (typeof valueOrCallback === 'function') {
          const callback = valueOrCallback;
          setRangeMax((rangeMax) => {
            // convert price to index
            const fractionalRangeMaxIndex = priceToTickIndex(
              new BigNumber(rangeMax)
            ).toNumber();
            // process as index
            const value = callback(fractionalRangeMaxIndex);
            // convert index back to price
            return tickIndexToPrice(new BigNumber(value)).toFixed();
          });
        }
        // process as a value
        else {
          const value = valueOrCallback;
          // convert index to price
          setRangeMax(tickIndexToPrice(new BigNumber(value)).toFixed());
        }
      },
      [setRangeMax]
    );

  const [rangeMinIndex, rangeMaxIndex] = getRangePositions(
    fractionalRangeMinIndex,
    fractionalRangeMaxIndex
  );

  const {
    data: {
      token0Ticks = [],
      token1Ticks = [],
      token0: token0Address,
      token1: token1Address,
    } = {},
  } = useIndexerPairData(tokenA?.address, tokenB?.address);

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
          tickIndex,
          price,
          fee,
          feeIndex,
        }: TickInfo): TokenTick => {
          return {
            token: isToken1 ? token1 : token0,
            reserve: isToken1 ? reserve1 : reserve0,
            tickIndex: (forward ? tickIndex : tickIndex.negated()).toNumber(),
            price: forward ? price : new BigNumber(1).dividedBy(price),
            fee,
            feeIndex: feeIndex.toNumber(),
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

  // collect tick information in a more useable form
  const feeTicks: [TokenTickGroup, TokenTickGroup] = useMemo(() => {
    const feeTierFilter = (tick: TokenTick) =>
      feeTypes[tick.feeIndex]?.fee === feeTier;
    return !feeTier
      ? [tokenATicks, tokenBTicks]
      : // filter to only fee tier ticks
        [tokenATicks.filter(feeTierFilter), tokenBTicks.filter(feeTierFilter)];
  }, [tokenATicks, tokenBTicks, feeTier]);

  // todo: base graph start and end on existing ticks and current price
  //       (if no existing ticks exist only cuurent price can indicate start and end)

  const currentPriceIndexFromTicks = useCurrentPriceIndexFromTicks(
    tokenA.address,
    tokenB.address
  );

  const isUserTicksAZero =
    oneSidedLiquidity &&
    userTicks.every((tick) => tick?.reserveA.isZero() ?? true);
  const isUserTicksBZero =
    oneSidedLiquidity &&
    userTicks.every((tick) => tick?.reserveB.isZero() ?? true);

  // note edge price, the price of the edge of one-sided liquidity
  const edgePriceIndex = currentPriceIndexFromTicks;

  // note warning price, the price at which warning states should be shown
  const [tokenAWarningPriceIndex, tokenBWarningPriceIndex] = useMemo(() => {
    const [tokenAEdgeTick]: (TokenTick | undefined)[] = tokenATicks;
    const [tokenBEdgeTick]: (TokenTick | undefined)[] = tokenBTicks;
    return oneSidedLiquidity
      ? // for one-sided liquidity this is the behind enemy lines check
        [
          !isUserTicksAZero ? tokenBEdgeTick?.tickIndex : undefined,
          !isUserTicksBZero ? tokenAEdgeTick?.tickIndex : undefined,
        ]
      : // for double-sided liquidity we switch on the current price
        [edgePriceIndex, edgePriceIndex];
  }, [
    oneSidedLiquidity,
    edgePriceIndex,
    isUserTicksAZero,
    isUserTicksBZero,
    tokenATicks,
    tokenBTicks,
  ]);

  const [initialGraphMinIndex, initialGraphMaxIndex] = useMemo<
    [number, number]
  >(() => {
    // get factor for 1/4 and 4x of price
    const spread = Math.log(4) / Math.log(1.0001);
    return [
      edgePriceIndex ? edgePriceIndex - spread : defaultMinIndex,
      edgePriceIndex ? edgePriceIndex + spread : defaultMaxIndex,
    ];
  }, [edgePriceIndex]);

  // set and allow ephemeral setting of graph extents
  // allow user ticks to reset the boundary of the graph
  const [dataMinIndex, dataMaxIndex] = useMemo<(number | undefined)[]>(() => {
    return [
      (tokenATicks[tokenATicks.length - 1] || tokenBTicks[0])?.tickIndex,
      (tokenBTicks[tokenBTicks.length - 1] || tokenATicks[0])?.tickIndex,
    ];
  }, [tokenATicks, tokenBTicks]);

  const [[zoomMinIndex, zoomMaxIndex] = [], setZoomRange] =
    useState<[number, number]>();

  const [zoomedDataMinIndex, zoomedDataMaxIndex] = useMemo<
    (number | undefined)[]
  >(() => {
    if (
      zoomMinIndex !== undefined &&
      zoomMaxIndex !== undefined &&
      !isNaN(Number(zoomMinIndex)) &&
      !isNaN(Number(zoomMaxIndex))
    ) {
      if (
        dataMinIndex &&
        dataMaxIndex &&
        isNaN(dataMinIndex) === false &&
        isNaN(dataMaxIndex) === false
      ) {
        return [
          Math.max(dataMinIndex, zoomMinIndex),
          Math.min(dataMaxIndex, zoomMaxIndex),
        ];
      } else {
        return [zoomMinIndex, zoomMaxIndex];
      }
    }
    return [dataMinIndex, dataMaxIndex];
  }, [zoomMinIndex, zoomMaxIndex, dataMinIndex, dataMaxIndex]);

  // set and allow ephemeral setting of graph extents
  // allow user ticks to reset the boundary of the graph
  const [graphMinIndex, graphMaxIndex] = useMemo<[number, number]>(() => {
    const allValues = [
      ...userTicks.map<number | undefined>((tick) => tick?.tickIndex),
      rangeMinIndex,
      rangeMaxIndex,
      zoomedDataMinIndex,
      zoomedDataMaxIndex,
    ].filter((v): v is number => v !== undefined && !isNaN(v));
    // find the edges of the plot area in terms of x-axis values
    const [min, max] =
      allValues.length > 0
        ? [Math.min(...allValues), Math.max(...allValues)]
        : [initialGraphMinIndex, initialGraphMaxIndex];

    if (min === max) {
      // get factor for 1/10 and 10x of price
      const spread = Math.round(Math.log(10) / Math.log(1.0001));
      return [min - spread, max + spread];
    }
    return [min, max];
  }, [
    rangeMinIndex,
    rangeMaxIndex,
    userTicks,
    zoomedDataMinIndex,
    zoomedDataMaxIndex,
    initialGraphMinIndex,
    initialGraphMaxIndex,
  ]);

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

  const [viewableMinIndex, viewableMaxIndex] = useMemo<[number, number]>(() => {
    // get bounds
    const spread = graphMaxIndex - graphMinIndex;
    const width = Math.max(1, containerSize.width - leftPadding - rightPadding);
    return [
      graphMinIndex - (spread * leftPadding) / width,
      graphMaxIndex + (spread * rightPadding) / width,
    ];
  }, [graphMinIndex, graphMaxIndex, containerSize.width]);

  // calculate bucket extents
  const getEmptyBuckets = useCallback<
    (
      // get bounds
      graphMinIndex: number,
      graphMaxIndex: number
    ) => [TickGroupBucketsEmpty, TickGroupBucketsEmpty]
  >(
    (graphMinIndex, graphMaxIndex) => {
      // skip if there is no breakpoint
      if (edgePriceIndex === undefined) {
        return [[], []];
      }

      // get middle 'break' point which will separate bucket sections
      const indexNow = Math.round(edgePriceIndex);
      const indexMin = Math.floor(graphMinIndex);
      const indexMax = Math.ceil(graphMaxIndex);
      const currentPriceIsWithinView =
        indexMin <= indexNow && indexNow <= indexMax;

      // estimate number of buckets needed
      const bucketCount =
        (Math.ceil(containerSize.width / bucketWidth) ?? 1) + // default to 1 bucket if none
        (currentPriceIsWithinView ? 1 : 0); // add bucket to account for splitting bucket on current price within view

      // find number of indexes on each side to show
      const tokenAIndexCount =
        indexNow >= indexMin ? Math.min(indexNow, indexMax) - indexMin + 1 : 0;
      const tokenBIndexCount =
        indexNow <= indexMax ? indexMax - Math.max(indexNow, indexMin) + 1 : 0;

      // find number of buckets on each side to show
      const indexTotalCount = tokenAIndexCount + tokenBIndexCount;
      const indexesPerBucketCount = Math.ceil(indexTotalCount / bucketCount);
      const tokenABucketCount = Math.ceil(
        tokenAIndexCount / indexesPerBucketCount
      );
      const tokenBBucketCount = Math.ceil(
        tokenBIndexCount / indexesPerBucketCount
      );

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
    },
    [edgePriceIndex, containerSize.width]
  );

  const emptyBuckets = useMemo(() => {
    return getEmptyBuckets(viewableMinIndex, viewableMaxIndex);
  }, [getEmptyBuckets, viewableMinIndex, viewableMaxIndex]);

  // calculate histogram values
  const feeTickBuckets = useMemo<TickGroupMergedBucketsFilled>(() => {
    return mergeBuckets(
      fillBuckets(emptyBuckets[0], feeTicks[0], 'upper'),
      fillBuckets(emptyBuckets[1], feeTicks[1], 'lower')
    );
  }, [emptyBuckets, feeTicks]);

  // calculate highest value to plot on the chart
  const yMaxValue = useMemo(() => {
    const allFeesTickBuckets = [
      fillBuckets(emptyBuckets[0], tokenATicks, 'upper'),
      fillBuckets(emptyBuckets[1], tokenBTicks, 'lower'),
    ];
    return mergeBuckets(allFeesTickBuckets[0], allFeesTickBuckets[1]).reduce(
      (
        result,
        [lowerBoundIndex, upperBoundIndex, tokenAValue, tokenBValue]
      ) => {
        return Math.max(result, tokenAValue.toNumber(), tokenBValue.toNumber());
      },
      0
    );
  }, [emptyBuckets, tokenATicks, tokenBTicks]);

  // get plotting functions
  const [plotWidth, plotHeight] = useMemo(() => {
    return [
      // width
      Math.max(0, containerSize.width - leftPadding - rightPadding),
      // height
      Math.max(0, containerSize.height - topPadding - bottomPadding),
    ];
  }, [containerSize]);

  const plotX = useCallback(
    (x: number): number => {
      const width = plotWidth;
      return graphMinIndex === graphMaxIndex
        ? // choose midpoint
          leftPadding + width / 2
        : // interpolate coordinate to graph
          leftPadding +
            (width * (x - graphMinIndex)) / (graphMaxIndex - graphMinIndex);
    },
    [graphMinIndex, graphMaxIndex, plotWidth]
  );
  const plotY = useCallback(
    (y: number): number => {
      const height = plotHeight;
      return yMaxValue === 0
        ? -bottomPadding // pin to bottom
        : -bottomPadding - (height * y) / yMaxValue;
    },
    [yMaxValue, plotHeight]
  );
  const percentY = useCallback(
    (y: number): number => {
      const height = plotHeight;
      return -bottomPadding - height * y;
    },
    [plotHeight]
  );
  const plotYBigNumber = useCallback(
    (y: BigNumber) => plotY(y.toNumber()),
    [plotY]
  );
  const percentYBigNumber = useCallback(
    (y: BigNumber) => percentY(y.toNumber()),
    [percentY]
  );

  function TextRoundedBackgroundFilter({
    id,
    floodColor,
  }: {
    id: string;
    floodColor: string;
  }) {
    return (
      <filter x="0" y="-0.4" width="1" height="1.8" id={id}>
        <feFlood floodColor={floodColor} />
        <feGaussianBlur stdDeviation="3.5" />
        <feComponentTransfer>
          <feFuncA type="table" tableValues="0 0 0 1" />
        </feComponentTransfer>
        <feComponentTransfer>
          <feFuncA type="table" tableValues="0 1 1 1 1 1 1 1" />
        </feComponentTransfer>
        <feComposite operator="over" in="SourceGraphic" />
      </filter>
    );
  }

  const svg = (
    <svg
      className={['chart-liquidity', advanced && 'chart-type--advanced']
        .filter(Boolean)
        .join(' ')}
      viewBox={`0 -${containerSize.height} ${containerSize.width} ${containerSize.height}`}
    >
      <defs>
        <filter
          x="0"
          y="-0.1"
          width="1"
          height="1.2"
          id="text-solid-background"
        >
          <feFlood floodColor="var(--page-card)" result="bg" />
          <feMerge>
            <feMergeNode in="bg" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <TextRoundedBackgroundFilter
          id="text-solid-highlight"
          floodColor="hsl(201, 77%, 61%)"
        />
        <TextRoundedBackgroundFilter
          id="text-solid-error"
          floodColor="var(--error)"
        />
        <linearGradient id="white-concave-fade">
          <stop offset="0%" stopColor="hsl(220, 44%, 45%)" stopOpacity="0.1" />
          <stop
            offset="100%"
            stopColor="hsl(220, 44%, 45%)"
            stopOpacity="0.1"
          />
        </linearGradient>
      </defs>
      <g className="axis x-axis">
        <rect
          x="0"
          width={containerSize.width}
          y={plotY(0).toFixed(0)}
          height="8"
        />
      </g>
      {!advanced && (
        <TicksBackgroundArea
          className="new-ticks-area"
          rangeMinIndex={rangeMinIndex}
          rangeMaxIndex={rangeMaxIndex}
          plotX={plotX}
          plotY={percentYBigNumber}
        />
      )}
      <TickBucketsGroup
        tickBuckets={feeTickBuckets}
        plotX={plotX}
        plotY={plotYBigNumber}
      />
      <Axis
        className="x-axis"
        tickMarkIndex={edgePriceIndex}
        highlightedTickIndex={edgePriceIndex}
        significantDecimals={dynamicSignificantDigits}
        plotX={plotX}
        plotY={plotY}
        percentY={percentY}
      />
      {advanced ? (
        <TicksGroup
          className="new-ticks"
          tokenAWarningPriceIndex={tokenAWarningPriceIndex}
          tokenBWarningPriceIndex={tokenBWarningPriceIndex}
          userTicks={userTicks}
          backgroundTicks={userTicksBase}
          setUserTicks={setUserTicks}
          userTickSelected={userTickSelected}
          setUserTickSelected={setUserTickSelected}
          plotX={plotX}
          percentY={percentYBigNumber}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          canMoveX={canMoveX}
        />
      ) : (
        <TicksArea
          className="new-ticks-area"
          currentPriceIndex={edgePriceIndex}
          tokenAWarningPriceIndex={tokenAWarningPriceIndex}
          tokenBWarningPriceIndex={tokenBWarningPriceIndex}
          oneSidedLiquidity={oneSidedLiquidity}
          plotX={plotX}
          plotY={percentYBigNumber}
          containerHeight={containerSize.height}
          rangeMinIndex={rangeMinIndex}
          rangeMaxIndex={rangeMaxIndex}
          fractionalRangeMinIndex={fractionalRangeMinIndex}
          fractionalRangeMaxIndex={fractionalRangeMaxIndex}
          setRangeMinIndex={setRangeMinIndex}
          setRangeMaxIndex={setRangeMaxIndex}
          significantDecimals={dynamicSignificantDigits}
        />
      )}
    </svg>
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
  ]);

  return (
    <>
      <div className="svg-container" ref={svgContainer}>
        {containerSize.width > 0 && containerSize.height > 0 ? svg : null}
      </div>
      {ControlsComponent && (
        <div className="col">
          <ControlsComponent
            zoomIn={
              zoomMaxIndex !== undefined &&
              zoomMinIndex !== undefined &&
              zoomMaxIndex - zoomMinIndex <= minZoomIndexSpread
                ? undefined
                : zoomIn
            }
            zoomOut={
              zoomMinIndex &&
              zoomMaxIndex &&
              dataMinIndex !== undefined &&
              dataMaxIndex !== undefined &&
              dataMinIndex >= zoomMinIndex &&
              dataMaxIndex <= zoomMaxIndex
                ? undefined
                : zoomOut
            }
          />
        </div>
      )}
    </>
  );
}

function fillBuckets(
  emptyBuckets: TickGroupBucketsEmpty,
  originalTicks: TokenTick[],
  matchSide: 'upper' | 'lower'
) {
  const sideLower = matchSide === 'lower';
  const ticks = originalTicks.filter(({ reserve }) => !reserve.isZero());
  return emptyBuckets.reduceRight<TickGroupBucketsFilled>(
    (result, [lowerIndexBound, upperIndexBound]) => {
      const reserve = ticks.reduceRight(
        (result, { tickIndex, reserve }, index, ticks) => {
          const matchToken = sideLower
            ? tickIndex >= lowerIndexBound && tickIndex < upperIndexBound
            : tickIndex > lowerIndexBound && tickIndex <= upperIndexBound;
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
        result.push([lowerIndexBound, upperIndexBound, reserve]);
      }
      return result;
    },
    []
  );
}

function mergeBuckets(
  tokenABuckets: TickGroupBucketsFilled,
  tokenBBuckets: TickGroupBucketsFilled
) {
  const mergedTokenABuckets: TickGroupMergedBucketsFilled = tokenABuckets.map(
    ([lowerBoundIndex, upperBoundIndex, reserve]) => {
      return [lowerBoundIndex, upperBoundIndex, reserve, new BigNumber(0)];
    }
  );
  const mergedTokenBBuckets: TickGroupMergedBucketsFilled = tokenBBuckets.map(
    ([lowerBoundIndex, upperBoundIndex, reserve]) => {
      return [lowerBoundIndex, upperBoundIndex, new BigNumber(0), reserve];
    }
  );

  const middleABucket = mergedTokenABuckets.shift();
  const middleBBucket = mergedTokenBBuckets.shift();

  // find if there is a bucket of bounds that does contain reserves of A and B
  if (
    middleABucket &&
    middleBBucket &&
    middleABucket[0] === middleBBucket[0] &&
    middleABucket[1] === middleBBucket[1]
  ) {
    // merge the one bucket that has reserves of both tokenA and tokenB
    const middleBuckets: TickGroupMergedBucketsFilled = [
      [middleABucket[0], middleABucket[1], middleABucket[2], middleBBucket[3]],
    ];
    return middleBuckets.concat(mergedTokenABuckets, mergedTokenBBuckets);
  }
  // else just return all parts as they are
  else {
    return ([] as TickGroupMergedBucketsFilled).concat(
      middleABucket ? [middleABucket] : [],
      mergedTokenABuckets,
      middleBBucket ? [middleBBucket] : [],
      mergedTokenBBuckets
    );
  }
}

function getRangePositions(
  fractionalRangeMinIndex: number,
  fractionalRangeMaxIndex: number
): [number, number] {
  // move one away from the tick index in question
  // ie. make the range flag be "around" the desired range (not "on" it)
  return [
    Math.ceil(fractionalRangeMinIndex - 1),
    Math.floor(fractionalRangeMaxIndex + 1),
  ];
}

export function getRangeIndexes(
  currentPriceIndex: number | undefined,
  fractionalRangeMinIndex: number,
  fractionalRangeMaxIndex: number
) {
  const [rangeMinIndex, rangeMaxIndex] = getRangePositions(
    fractionalRangeMinIndex,
    fractionalRangeMaxIndex
  );
  if (currentPriceIndex === undefined) {
    return [rangeMinIndex, rangeMaxIndex];
  } else {
    const roundedCurrentPriceIndex =
      currentPriceIndex && Math.round(currentPriceIndex);
    return [
      rangeMinIndex < roundedCurrentPriceIndex
        ? rangeMinIndex + 1
        : rangeMinIndex,
      rangeMaxIndex > roundedCurrentPriceIndex
        ? rangeMaxIndex - 1
        : rangeMaxIndex,
    ];
  }
}

function TicksBackgroundArea({
  rangeMinIndex,
  rangeMaxIndex,
  plotX,
  plotY,
  className,
}: {
  rangeMinIndex: number;
  rangeMaxIndex: number;
  plotX: (x: number) => number;
  plotY: (y: BigNumber) => number;
  className?: string;
}) {
  return !isNaN(rangeMinIndex) && !isNaN(rangeMaxIndex) ? (
    <g
      className={['ticks-area__background', className]
        .filter(Boolean)
        .join(' ')}
    >
      <rect
        className="tick-area"
        // fill is defined on <svg><defs><linearGradient>
        fill="url(#white-concave-fade)"
        x={plotX(rangeMinIndex).toFixed(3)}
        width={
          rangeMaxIndex > rangeMinIndex
            ? (plotX(rangeMaxIndex) - plotX(rangeMinIndex)).toFixed(3)
            : '0'
        }
        y={plotY(new BigNumber(1)).toFixed(3)}
        height={(plotY(new BigNumber(0)) - plotY(new BigNumber(1)) + 8).toFixed(
          3
        )}
      />
    </g>
  ) : null;
}

function TicksArea({
  currentPriceIndex,
  tokenAWarningPriceIndex,
  tokenBWarningPriceIndex,
  oneSidedLiquidity,
  plotX,
  plotY,
  containerHeight,
  rangeMinIndex,
  rangeMaxIndex,
  fractionalRangeMinIndex,
  fractionalRangeMaxIndex,
  setRangeMinIndex,
  setRangeMaxIndex,
  significantDecimals,
  className,
}: {
  currentPriceIndex: number | undefined;
  tokenAWarningPriceIndex: number | undefined;
  tokenBWarningPriceIndex: number | undefined;
  oneSidedLiquidity: boolean;
  plotX: (x: number) => number;
  plotY: (y: BigNumber) => number;
  containerHeight: number;
  rangeMinIndex: number;
  rangeMaxIndex: number;
  fractionalRangeMinIndex: number;
  fractionalRangeMaxIndex: number;
  setRangeMinIndex: (rangeMinIndex: number) => void;
  setRangeMaxIndex: (rangeMaxIndex: number) => void;
  significantDecimals: number;
  className?: string;
}) {
  const lastDisplacementMin = useRef<number>(0);
  const [startDragMin, isDraggingMin] = useOnDragMove(
    useCallback(
      (ev: Event, displacement = { x: 0, y: 0 }) => {
        if (displacement.x && displacement.x !== lastDisplacementMin.current) {
          const newDisplacement = displacement.x - lastDisplacementMin.current;
          const pixelsPerIndex = plotX(1) - plotX(0);
          const newIndex =
            fractionalRangeMinIndex + newDisplacement / pixelsPerIndex;
          setRangeMinIndex(newIndex);
          if (fractionalRangeMaxIndex < newIndex) {
            setRangeMaxIndex(newIndex);
          }
          lastDisplacementMin.current = displacement.x;
        }
      },
      [
        fractionalRangeMinIndex,
        fractionalRangeMaxIndex,
        plotX,
        setRangeMinIndex,
        setRangeMaxIndex,
      ]
    )
  );
  useEffect(() => {
    if (!isDraggingMin) {
      lastDisplacementMin.current = 0;
    }
  }, [isDraggingMin]);

  const lastDisplacementMax = useRef<number>(0);
  const [startDragMax, isDraggingMax] = useOnDragMove(
    useCallback(
      (ev: Event, displacement = { x: 0, y: 0 }) => {
        if (displacement.x && displacement.x !== lastDisplacementMax.current) {
          const newDisplacement = displacement.x - lastDisplacementMax.current;
          const pixelsPerIndex = plotX(1) - plotX(0);
          const newIndex =
            fractionalRangeMaxIndex + newDisplacement / pixelsPerIndex;
          setRangeMaxIndex(newIndex);
          if (fractionalRangeMinIndex > newIndex) {
            setRangeMinIndex(newIndex);
          }
          lastDisplacementMax.current = displacement.x;
        }
      },
      [
        fractionalRangeMinIndex,
        fractionalRangeMaxIndex,
        plotX,
        setRangeMinIndex,
        setRangeMaxIndex,
      ]
    )
  );
  useEffect(() => {
    if (!isDraggingMax) {
      lastDisplacementMax.current = 0;
    }
  }, [isDraggingMax]);

  const rounding = 5;
  const warningIndexIfGreaterThan = (
    index: number | undefined,
    limit: number | undefined
  ): number | undefined => {
    return limit !== undefined && index !== undefined && index > limit
      ? limit
      : undefined;
  };
  const warningPriceIfLessThan = (
    index: number | undefined,
    limit: number | undefined
  ): number | undefined => {
    return limit !== undefined && index !== undefined && index < limit
      ? limit
      : undefined;
  };

  const roundedCurrentPriceIndex =
    currentPriceIndex && Math.round(currentPriceIndex);
  const [rangeMinValueIndex, rangeMaxValueIndex] = getRangeIndexes(
    roundedCurrentPriceIndex,
    fractionalRangeMinIndex,
    fractionalRangeMaxIndex
  );

  const rangeMinIndexWarning = oneSidedLiquidity
    ? warningIndexIfGreaterThan(rangeMinValueIndex, tokenAWarningPriceIndex) ??
      warningPriceIfLessThan(rangeMinValueIndex, tokenBWarningPriceIndex)
    : warningIndexIfGreaterThan(rangeMinValueIndex, roundedCurrentPriceIndex);
  const rangeMaxIndexWarning = oneSidedLiquidity
    ? warningIndexIfGreaterThan(rangeMaxValueIndex, tokenAWarningPriceIndex) ??
      warningPriceIfLessThan(rangeMaxValueIndex, tokenBWarningPriceIndex)
    : warningPriceIfLessThan(rangeMaxValueIndex, roundedCurrentPriceIndex);

  const formatPercentageValue = useCallback(
    (tickIndex: number, currentPriceIndex: number) => {
      return formatAmount(
        formatMaximumSignificantDecimals(
          tickIndexToPrice(new BigNumber(tickIndex))
            .multipliedBy(100)
            .dividedBy(tickIndexToPrice(new BigNumber(currentPriceIndex)))
            .minus(100),
          2
        ),
        {
          signDisplay: 'always',
          useGrouping: true,
        }
      );
    },
    []
  );

  return !isNaN(rangeMinIndex) && !isNaN(rangeMaxIndex) ? (
    <g className={['ticks-area', className].filter(Boolean).join(' ')}>
      <g
        className={[
          'pole-a',
          oneSidedLiquidity &&
            rangeMinIndexWarning !== undefined &&
            'pole--price-warning',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <line
          className="line pole-stick"
          x1={(plotX(rangeMinIndex) - poleWidth / 2).toFixed(3)}
          x2={(plotX(rangeMinIndex) - poleWidth / 2).toFixed(3)}
          y1={(plotY(new BigNumber(0)) + 8).toFixed(3)}
          y2={plotY(new BigNumber(1)).toFixed(3)}
        />
        <rect
          className="pole-to-flag"
          x={(plotX(rangeMinIndex) - rounding).toFixed(3)}
          width={rounding}
          y={plotY(new BigNumber(1)).toFixed(3)}
          height="40"
        />
        <rect
          className="pole-flag"
          x={(plotX(rangeMinIndex) - 30 - poleWidth / 2).toFixed(3)}
          width="30"
          y={plotY(new BigNumber(1)).toFixed(3)}
          height="40"
          rx={rounding}
        />
        <line
          className="pole-flag-stripe"
          x1={(plotX(rangeMinIndex) - 11.5 - poleWidth / 2).toFixed(3)}
          x2={(plotX(rangeMinIndex) - 11.5 - poleWidth / 2).toFixed(3)}
          y1={(plotY(new BigNumber(1)) + 10).toFixed(3)}
          y2={(plotY(new BigNumber(1)) + 30).toFixed(3)}
        />
        <line
          className="pole-flag-stripe"
          x1={(plotX(rangeMinIndex) - 18.5 - poleWidth / 2).toFixed(3)}
          x2={(plotX(rangeMinIndex) - 18.5 - poleWidth / 2).toFixed(3)}
          y1={(plotY(new BigNumber(1)) + 10).toFixed(3)}
          y2={(plotY(new BigNumber(1)) + 30).toFixed(3)}
        />
        <text
          className="pole-value-text"
          filter="url(#text-solid-background)"
          x={(4 + 1.8 + plotX(rangeMinIndex) - poleWidth / 2).toFixed(3)}
          y={plotY(new BigNumber(0)) + 4 + 8}
          dominantBaseline="middle"
          textAnchor="end"
          alignmentBaseline="text-before-edge"
        >
          &nbsp;
          {formatAmount(
            formatMaximumSignificantDecimals(
              tickIndexToPrice(new BigNumber(rangeMinValueIndex)).toFixed(),
              significantDecimals
            ),
            {
              minimumSignificantDigits: significantDecimals,
              useGrouping: true,
            }
          )}
          &nbsp;
        </text>
        {currentPriceIndex !== undefined && (
          <text
            className="pole-percent-text"
            filter="url(#text-solid-highlight)"
            x={(4 + 1.8 + plotX(rangeMinIndex) - poleWidth / 2).toFixed(3)}
            y={5 - containerHeight}
            dy="12"
            textAnchor="end"
          >
            &nbsp;&nbsp;&nbsp;
            {`${formatPercentageValue(rangeMinValueIndex, currentPriceIndex)}%`}
            &nbsp;&nbsp;&nbsp;
          </text>
        )}
        {isDraggingMin ? (
          <rect
            className="pole-flag--hit-area"
            x="0"
            width="100000"
            y="-100000"
            height="100000"
          />
        ) : (
          <rect
            className="pole-flag--hit-area"
            x={(plotX(rangeMinIndex) - 30).toFixed(3)}
            width="30"
            y={plotY(new BigNumber(1)).toFixed(3)}
            height="40"
            rx={rounding}
            onMouseDown={startDragMin}
          />
        )}
      </g>
      <g
        className={[
          'pole-b',
          oneSidedLiquidity &&
            rangeMaxIndexWarning !== undefined &&
            'pole--price-warning',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <line
          className="line pole-stick"
          x1={(plotX(rangeMaxIndex) + poleWidth / 2).toFixed(3)}
          x2={(plotX(rangeMaxIndex) + poleWidth / 2).toFixed(3)}
          y1={(plotY(new BigNumber(0)) + 8).toFixed(3)}
          y2={plotY(new BigNumber(1)).toFixed(3)}
        />
        <rect
          className="pole-to-flag"
          x={plotX(rangeMaxIndex).toFixed(3)}
          width={rounding}
          y={plotY(new BigNumber(1)).toFixed(3)}
          height="40"
        />
        <rect
          className="pole-flag"
          x={(plotX(rangeMaxIndex) + poleWidth / 2).toFixed(3)}
          width="30"
          y={plotY(new BigNumber(1)).toFixed(3)}
          height="40"
          rx={rounding}
        />
        <line
          className="pole-flag-stripe"
          x1={(plotX(rangeMaxIndex) + 11.5 + poleWidth / 2).toFixed(3)}
          x2={(plotX(rangeMaxIndex) + 11.5 + poleWidth / 2).toFixed(3)}
          y1={(plotY(new BigNumber(1)) + 10).toFixed(3)}
          y2={(plotY(new BigNumber(1)) + 30).toFixed(3)}
        />
        <line
          className="pole-flag-stripe"
          x1={(plotX(rangeMaxIndex) + 18.5 + poleWidth / 2).toFixed(3)}
          x2={(plotX(rangeMaxIndex) + 18.5 + poleWidth / 2).toFixed(3)}
          y1={(plotY(new BigNumber(1)) + 10).toFixed(3)}
          y2={(plotY(new BigNumber(1)) + 30).toFixed(3)}
        />
        <text
          className="pole-value-text"
          filter="url(#text-solid-background)"
          x={(4 + 1.8 + plotX(rangeMaxIndex) - poleWidth / 2).toFixed(3)}
          y={plotY(new BigNumber(0)) + 4 + 8}
          dominantBaseline="middle"
          textAnchor="start"
          alignmentBaseline="text-before-edge"
        >
          &nbsp;
          {formatAmount(
            formatMaximumSignificantDecimals(
              tickIndexToPrice(new BigNumber(rangeMaxValueIndex)).toFixed(),
              significantDecimals
            ),
            {
              minimumSignificantDigits: significantDecimals,
              useGrouping: true,
            }
          )}
          &nbsp;
        </text>
        {currentPriceIndex !== undefined && (
          <text
            className="pole-percent-text"
            filter="url(#text-solid-highlight)"
            x={(-(4 + 1.8) + plotX(rangeMaxIndex) + poleWidth / 2).toFixed(3)}
            y={5 - containerHeight}
            dy="12"
            textAnchor="start"
          >
            &nbsp;&nbsp;&nbsp;
            {`${formatPercentageValue(rangeMaxValueIndex, currentPriceIndex)}%`}
            &nbsp;&nbsp;&nbsp;
          </text>
        )}
        {isDraggingMax ? (
          <rect
            className="pole-flag--hit-area"
            x="0"
            width="100000"
            y="-100000"
            height="100000"
          />
        ) : (
          <rect
            className="pole-flag--hit-area"
            x={plotX(rangeMaxIndex).toFixed(3)}
            width="30"
            y={plotY(new BigNumber(1)).toFixed(3)}
            height="40"
            rx={rounding}
            onMouseDown={startDragMax}
          />
        )}
      </g>
      <g className="flag-line">
        <line
          className="line flag-joiner"
          x1={plotX(rangeMinIndex).toFixed(3)}
          x2={plotX(rangeMaxIndex).toFixed(3)}
          y1={plotY(new BigNumber(0.7)).toFixed(3)}
          y2={plotY(new BigNumber(0.7)).toFixed(3)}
        />
        {rangeMinIndexWarning !== undefined && (
          <>
            {/* draw warning line between flag and warning point */}
            <line
              className="line flag-joiner flag-joiner--price-warning"
              x1={plotX(rangeMinIndexWarning).toFixed(3)}
              x2={plotX(rangeMinIndex).toFixed(3)}
              y1={plotY(new BigNumber(0.7)).toFixed(3)}
              y2={plotY(new BigNumber(0.7)).toFixed(3)}
            />
            {/* draw warning line across flag */}
            <line
              className="line flag-joiner flag-joiner--price-warning"
              x1={plotX(rangeMinIndex).toFixed(3)}
              x2={(plotX(rangeMinIndex) - poleWidth).toFixed(3)}
              y1={plotY(new BigNumber(0.7)).toFixed(3)}
              y2={plotY(new BigNumber(0.7)).toFixed(3)}
            />
          </>
        )}
        {rangeMaxIndexWarning !== undefined && (
          <>
            {/* draw warning line between flag and warning point */}
            <line
              className="line flag-joiner flag-joiner--price-warning"
              x1={plotX(rangeMaxIndex).toFixed(3)}
              x2={plotX(rangeMaxIndexWarning).toFixed(3)}
              y1={plotY(new BigNumber(0.7)).toFixed(3)}
              y2={plotY(new BigNumber(0.7)).toFixed(3)}
            />
            {/* draw warning line across flag */}
            <line
              className="line flag-joiner flag-joiner--price-warning"
              x1={plotX(rangeMaxIndex).toFixed(3)}
              x2={(plotX(rangeMaxIndex) + poleWidth).toFixed(3)}
              y1={plotY(new BigNumber(0.7)).toFixed(3)}
              y2={plotY(new BigNumber(0.7)).toFixed(3)}
            />
          </>
        )}
      </g>
    </g>
  ) : null;
}

function TicksGroup({
  tokenAWarningPriceIndex,
  tokenBWarningPriceIndex,
  userTicks,
  backgroundTicks,
  setUserTicks,
  userTickSelected,
  setUserTickSelected,
  plotX,
  percentY,
  className,
  canMoveUp = false,
  canMoveDown = false,
  canMoveX = false,
  ...rest
}: {
  tokenAWarningPriceIndex: number | undefined;
  tokenBWarningPriceIndex: number | undefined;
  userTicks: Array<Tick | undefined>;
  backgroundTicks: Array<Tick | undefined>;
  setUserTicks?: (
    callback: (userTicks: TickGroup, meta?: { index?: number }) => TickGroup
  ) => void;
  userTickSelected: number;
  setUserTickSelected: (index: number) => void;
  plotX: (x: number) => number;
  percentY: (y: BigNumber) => number;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  canMoveX?: boolean;
  className?: string;
}) {
  // collect reserve height to calculate stats to use
  const tickNumbers = userTicks.flatMap((tick) =>
    [tick?.reserveA.toNumber(), tick?.reserveB.toNumber()].filter(
      (reserve): reserve is number => Boolean(reserve)
    )
  );
  const backgroundTickNumbers = backgroundTicks.flatMap((tick) =>
    [tick?.reserveA.toNumber(), tick?.reserveB.toNumber()].filter(
      (reserve): reserve is number => Boolean(reserve)
    )
  );

  // find max cumulative value of either the current ticks or background ticks
  const cumulativeTokenValues: number = Math.max(
    tickNumbers.reduce((acc, v) => acc + v, 0),
    backgroundTickNumbers.reduce((acc, v) => acc + v, 0)
  );

  const maxValue = Math.max(...tickNumbers, ...backgroundTickNumbers);
  const minMaxHeight = getMinYHeight(backgroundTickNumbers.length);

  // add a scaling factor if the maximum tick is very short (scale up to minMaxHeight)
  const scalingFactor =
    cumulativeTokenValues && maxValue / cumulativeTokenValues > minMaxHeight
      ? 0.925
      : (0.925 / (maxValue / cumulativeTokenValues)) * minMaxHeight;

  const lastSelectedTick = useRef<{ tick: Tick; index: number }>();

  const [startDragTick, isDragging] = useOnDragMove(
    useCallback(
      (ev: Event, displacement = { x: 0, y: 0 }) => {
        // exit if there is no tick
        const { index: userTickSelected, tick } =
          lastSelectedTick.current || {};
        if (!tick || userTickSelected === undefined || isNaN(userTickSelected))
          return;

        // move tick price
        if (canMoveX && Math.abs(displacement.x) > Math.abs(displacement.y)) {
          return setUserTicks?.((userTicks) => {
            const pixelsPerIndex = plotX(1) - plotX(0);
            return userTicks?.map((userTick, index) => {
              // modify price
              if (userTickSelected === index) {
                const newIndex =
                  tick.tickIndex + displacement.x / pixelsPerIndex;
                const roundedPrice = new BigNumber(
                  formatPrice(
                    tickIndexToPrice(new BigNumber(newIndex)).toFixed()
                  )
                );
                return {
                  ...userTick,
                  price: roundedPrice,
                  tickIndex: newIndex,
                };
              } else {
                return userTick;
              }
            });
          });
        }
        // move tick value
        else {
          return setUserTicks?.((userTicks, meta = {}) => {
            // append context for callers that read from this
            // note: this is a bit of a hack to keep setUserTicks(tick => ticks)-like compatibility
            meta.index = userTickSelected;
            // calculate position movement
            const linearPixels =
              percentY(new BigNumber(1)) - percentY(new BigNumber(0));
            // todo: attempt an algorithm that places the value at the approximate mouseover value
            // will require current max Y value to interpolate from
            const displacementPercent = displacement.y / linearPixels;
            const dragSpeedFactor = 5; //larger is faster
            const adjustedMovement = 1 + dragSpeedFactor * displacementPercent;
            return userTicks?.map((userTick, index) => {
              // modify price
              if (userTickSelected === index) {
                const originalAValue = backgroundTicks[index]?.reserveA;
                const originalBValue = backgroundTicks[index]?.reserveB;
                const newAValue = tick.reserveA.multipliedBy(adjustedMovement);
                const newBValue = tick.reserveB.multipliedBy(adjustedMovement);
                return {
                  ...userTick,
                  reserveA:
                    (!canMoveDown &&
                      originalAValue &&
                      newAValue.isLessThan(originalAValue)) ||
                    (!canMoveUp &&
                      originalAValue &&
                      newAValue.isGreaterThan(originalAValue))
                      ? originalAValue
                      : newAValue,
                  reserveB:
                    (!canMoveDown &&
                      originalBValue &&
                      newBValue.isLessThan(originalBValue)) ||
                    (!canMoveUp &&
                      originalBValue &&
                      newBValue.isGreaterThan(originalBValue))
                      ? originalBValue
                      : newBValue,
                };
              } else {
                return userTick;
              }
            });
          });
        }
      },
      [
        backgroundTicks,
        canMoveUp,
        canMoveDown,
        canMoveX,
        setUserTicks,
        plotX,
        percentY,
      ]
    )
  );

  const onTickSelected = useCallback(
    (e: MouseEvent) => {
      // set last tick synchronously
      const index = parseInt(
        (e.target as HTMLElement)?.getAttribute('data-key') || ''
      );
      const tick = userTicks?.[index];
      if (!isNaN(index) && tick) {
        setUserTickSelected(index);
        lastSelectedTick.current = {
          tick,
          index,
        };
      }

      startDragTick(e);
    },
    [userTicks, startDragTick, setUserTickSelected]
  );

  const tickPart = userTicks
    .filter(
      (tick): tick is Tick =>
        !!tick && !tick.reserveA.isNaN() && !tick.reserveB.isNaN()
    )
    .map<[Tick, number]>((tick, index) => [tick, index])
    // sort by top to bottom: select ticks then shortest -> tallest ticks
    .sort(([a, aIndex], [b, bIndex]) => {
      // sort any selected tick to the front
      // (so users can select it somehow else then drag it easily here)
      const aIsSelected = aIndex === userTickSelected;
      const bIsSelected = bIndex === userTickSelected;
      return (
        Number(aIsSelected) - Number(bIsSelected) ||
        // sort by height so that short ticks are above tall ticks
        b.reserveA.plus(b.reserveB).comparedTo(a.reserveA.plus(a.reserveB))
      );
    })
    .map(([tick, index]) => {
      const backgroundTick = backgroundTicks[index] || tick;
      const background = {
        tickIndex: backgroundTick.tickIndex,
        reserveA: backgroundTick.reserveA,
        reserveB: backgroundTick.reserveB,
      };
      const { tickIndex, reserveA, reserveB } = tick;
      // todo: display cumulative value of both side of ticks, not just one side
      const totalValue =
        (reserveA.isGreaterThan(0)
          ? cumulativeTokenValues &&
            reserveA
              .multipliedBy(scalingFactor)
              .dividedBy(cumulativeTokenValues)
          : cumulativeTokenValues &&
            reserveB
              .multipliedBy(scalingFactor)
              .dividedBy(cumulativeTokenValues)) || new BigNumber(0);
      const backgroundValue =
        (background.reserveA.isGreaterThan(0)
          ? cumulativeTokenValues &&
            background.reserveA
              .multipliedBy(scalingFactor)
              .dividedBy(cumulativeTokenValues)
          : cumulativeTokenValues &&
            background.reserveB
              .multipliedBy(scalingFactor)
              .dividedBy(cumulativeTokenValues)) || new BigNumber(0);

      const minValue = totalValue.isLessThan(backgroundValue)
        ? totalValue
        : backgroundValue;
      const maxValue = totalValue.isLessThan(backgroundValue)
        ? backgroundValue
        : totalValue;

      return (
        <g
          key={index}
          className={[
            'tick',
            totalValue.isZero() && 'tick--is-zero',
            userTickSelected === index && 'tick--selected',
            reserveA.isGreaterThan(0) ? 'token-a' : 'token-b',
            !totalValue.isEqualTo(backgroundValue) &&
              (totalValue.isLessThan(backgroundValue)
                ? 'tick--diff-negative'
                : 'tick--diff-positive'),
            // warn user if this seems to be a bad trade
            reserveA.isGreaterThan(0)
              ? tokenAWarningPriceIndex &&
                tickIndex > tokenAWarningPriceIndex &&
                'tick--price-warning'
              : tokenBWarningPriceIndex &&
                tickIndex < tokenBWarningPriceIndex &&
                'tick--price-warning',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <line
            {...rest}
            x1={plotX(tickIndex).toFixed(3)}
            x2={plotX(tickIndex).toFixed(3)}
            y1={percentY(new BigNumber(0)).toFixed(3)}
            y2={percentY(minValue).toFixed(3)}
            className="line"
          />
          {tick !== backgroundTick && (
            <line
              {...rest}
              x1={plotX(tickIndex).toFixed(3)}
              x2={plotX(tickIndex).toFixed(3)}
              y1={percentY(minValue).toFixed(3)}
              y2={percentY(maxValue).toFixed(3)}
              className="line line--diff"
            />
          )}
          <circle
            cx={plotX(tickIndex).toFixed(3)}
            cy={percentY(backgroundValue).toFixed(3)}
            r="5"
            className="tip"
          />
          {tick !== backgroundTick && (
            <circle
              cx={plotX(tickIndex).toFixed(3)}
              cy={percentY(totalValue).toFixed(3)}
              r="5"
              className="tip tip--diff"
            />
          )}
          <text
            x={plotX(tickIndex).toFixed(3)}
            y={(percentY(maxValue) - 28).toFixed(3)}
            dy="12"
            dominantBaseline="middle"
            textAnchor="middle"
          >
            {index + 1}
          </text>
          <rect
            className="tick--hit-area"
            data-key={index}
            {...(isDragging
              ? {
                  x: '0',
                  y: '-1000',
                  width: '10000',
                  height: '1000',
                }
              : {
                  x: (plotX(tickIndex) - 7.5).toFixed(3),
                  y: (percentY(maxValue) - 25).toFixed(3),
                  rx: 7.5,
                  width: 15,
                  height: (
                    percentY(minValue) -
                    percentY(maxValue) +
                    35
                  ).toFixed(3),
                })}
            onMouseDown={onTickSelected}
          />
        </g>
      );
    });

  return (
    <g
      className={['ticks', isDragging && 'ticks--is-dragging', className]
        .filter(Boolean)
        .join(' ')}
    >
      {tickPart}
    </g>
  );
}

function TickBucketsGroup({
  tickBuckets,
  plotX,
  plotY,
  className,
  ...rest
}: {
  tickBuckets: TickGroupMergedBucketsFilled;
  plotX: (x: number) => number;
  plotY: (y: BigNumber) => number;
  className?: string;
}) {
  return (
    <g className={['tick-buckets', className].filter(Boolean).join(' ')}>
      {tickBuckets.flatMap(
        ([lowerBoundIndex, upperBoundIndex, tokenAValue, tokenBValue], index) =>
          [
            tokenAValue?.isGreaterThan(0) && (
              <rect
                key={`${index}-0`}
                className="tick-bucket token-a"
                {...rest}
                x={plotX(lowerBoundIndex).toFixed(3)}
                width={(
                  plotX(upperBoundIndex) - plotX(lowerBoundIndex)
                ).toFixed(3)}
                y={plotY(tokenAValue).toFixed(3)}
                height={(plotY(new BigNumber(0)) - plotY(tokenAValue)).toFixed(
                  3
                )}
              />
            ),
            tokenBValue?.isGreaterThan(0) && (
              <rect
                key={`${index}-1`}
                className="tick-bucket token-b"
                {...rest}
                x={plotX(lowerBoundIndex).toFixed(3)}
                width={(
                  plotX(upperBoundIndex) - plotX(lowerBoundIndex)
                ).toFixed(3)}
                y={plotY(tokenAValue.plus(tokenBValue)).toFixed(3)}
                height={(plotY(new BigNumber(0)) - plotY(tokenBValue)).toFixed(
                  3
                )}
              />
            ),
          ].filter(Boolean)
      )}
    </g>
  );
}

function Axis({
  className = '',
  tickMarkIndex,
  tickMarkIndexes = tickMarkIndex ? [tickMarkIndex] : [],
  highlightedTickIndex,
  significantDecimals,
  plotX,
  plotY,
  percentY,
}: {
  className?: string;
  tickMarkIndex?: number;
  tickMarkIndexes?: number[];
  highlightedTickIndex?: number;
  significantDecimals?: number;
  plotX: (x: number) => number;
  plotY: (y: number) => number;
  percentY: (y: number) => number;
}) {
  return (
    <g className={['axis', className].filter(Boolean).join(' ')}>
      <g className="axis-ticks">{tickMarkIndexes.map(mapTickMarkIndex)}</g>
    </g>
  );

  function mapTickMarkIndex(tickMarkIndex: number, index: number) {
    return (
      <g key={index} className="axis-tick">
        {tickMarkIndex === highlightedTickIndex && (
          <line
            className="line--success"
            x1={plotX(tickMarkIndex).toFixed(3)}
            x2={plotX(tickMarkIndex).toFixed(3)}
            y1={plotY(0) + 8}
            y2={percentY(1)}
          />
        )}
        <text
          filter="url(#text-solid-background)"
          className={
            tickMarkIndex === highlightedTickIndex ? 'text--success' : ''
          }
          x={plotX(tickMarkIndex).toFixed(3)}
          y={plotY(0) + 4 + 8}
          dominantBaseline="middle"
          textAnchor="middle"
          alignmentBaseline="text-before-edge"
        >
          &nbsp;
          {formatAmount(
            formatMaximumSignificantDecimals(
              tickIndexToPrice(new BigNumber(tickMarkIndex)).toFixed(),
              significantDecimals
            ),
            {
              minimumSignificantDigits:
                tickMarkIndex === highlightedTickIndex
                  ? significantDecimals
                  : 1,
              useGrouping: true,
            }
          )}
          &nbsp;
        </text>
      </g>
    );
  }
}

function getMinYHeight(tickCount: number): number {
  return 1 / ((tickCount - 2) / 6 + 2) + 0.4;
}
