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
  formatPercentage,
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

export default function LiquiditySelector({
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

  // todo: base graph start and end on existing ticks and current price
  //       (if no existing ticks exist only cuurent price can indicate start and end)

  const currentPriceIndexFromTicks = useCurrentPriceIndexFromTicks(
    tokenA?.address,
    tokenB?.address
  );

  const isUserTicksAZero =
    oneSidedLiquidity &&
    userTicks.every((tick) => tick?.reserveA.isZero() ?? true);
  const isUserTicksBZero =
    oneSidedLiquidity &&
    userTicks.every((tick) => tick?.reserveB.isZero() ?? true);

  // note edge price, the price of the edge of one-sided liquidity
  const edgePriceIndex = useMemo(() => {
    if (currentPriceIndexFromTicks !== undefined) {
      return currentPriceIndexFromTicks;
    }
    // return calculated price index
    if (Number(initialPrice) > 0) {
      return priceToTickIndex(new BigNumber(initialPrice)).toNumber();
    }
    return undefined;
  }, [currentPriceIndexFromTicks, initialPrice]);

  // note warning price, the price at which warning states should be shown
  const [tokenAWarningPriceIndex, tokenBWarningPriceIndex] = useMemo(() => {
    const [tokenAEdgeTick]: (TokenTick | undefined)[] = tokenATicks;
    const [tokenBEdgeTick]: (TokenTick | undefined)[] = tokenBTicks;
    return oneSidedLiquidity
      ? // for one-sided liquidity this is the behind enemy lines check
        [
          !isUserTicksAZero ? tokenBEdgeTick?.tickIndexBToA : undefined,
          !isUserTicksBZero ? tokenAEdgeTick?.tickIndexBToA : undefined,
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
      (tokenATicks[tokenATicks.length - 1] || tokenBTicks[0])?.tickIndexBToA,
      (tokenBTicks[tokenBTicks.length - 1] || tokenATicks[0])?.tickIndexBToA,
    ];
  }, [tokenATicks, tokenBTicks]);

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

  const [rangeMinIndex, rangeMaxIndex] = getRangePositions(
    edgePriceIndex,
    fractionalRangeMinIndex,
    fractionalRangeMaxIndex
  );

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

  // set and allow ephemeral setting of graph extents
  // allow user ticks to reset the boundary of the graph
  const [graphMinIndex, graphMaxIndex] = useMemo<[number, number]>(() => {
    const allValues = [
      ...userTicks.map<number | undefined>((tick) => tick?.tickIndexBToA),
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

  useEffect(() => {
    setViewableIndexes([viewableMinIndex, viewableMaxIndex]);
  }, [setViewableIndexes, viewableMinIndex, viewableMaxIndex]);

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
  const tickBuckets = useMemo<TickGroupMergedBucketsFilled>(() => {
    if (edgePriceIndex === undefined) {
      return [];
    }
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
  }, [emptyBuckets, tokenATicks, tokenBTicks, edgePriceIndex]);

  // calculate highest value to plot on the chart
  const yMaxValue = useMemo(() => {
    return tickBuckets.reduce(
      (
        result,
        [lowerBoundIndex, upperBoundIndex, tokenAValue, tokenBValue]
      ) => {
        return Math.max(result, tokenAValue.toNumber(), tokenBValue.toNumber());
      },
      0
    );
  }, [tickBuckets]);

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

  const TextRoundedBackgroundFilter = useCallback(
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
    },
    []
  );

  const svg = (
    <svg
      className="chart-liquidity"
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
        <linearGradient id="flag-pole-fade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="15%" stopColor="hsla(165, 83%, 57%)" stopOpacity="1" />
          <stop
            offset="40%"
            stopColor="hsla(165, 83%, 57%)"
            stopOpacity="0.15"
          />
        </linearGradient>
        <linearGradient id="flag-pole-fade-error" x1="0" x2="0" y1="0" y2="1">
          <stop offset="15%" stopColor="var(--error)" stopOpacity="1" />
          <stop offset="40%" stopColor="var(--error)" stopOpacity="0.15" />
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
      {edgePriceIndex !== undefined && (
        <TickBucketsGroup
          tickBuckets={tickBuckets}
          edgePriceIndex={edgePriceIndex}
          plotX={plotX}
          plotY={plotYBigNumber}
        />
      )}
      <Axis
        className="x-axis"
        tickMarkIndex={edgePriceIndex || 0}
        highlightedTickIndex={edgePriceIndex}
        significantDecimals={dynamicSignificantDigits}
        plotX={plotX}
        plotY={plotY}
        percentY={percentY}
      />
      {!advanced && (
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
      <TicksGroup
        className={['new-ticks', advanced && 'edit-ticks']
          .filter(Boolean)
          .join(' ')}
        currentPriceIndex={edgePriceIndex}
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
      <EmptyState
        warnings={[
          // warn if tokens are not set
          !(tokenA && tokenB) && 'Add a token pair to create a new position',
          // warn is no current price is set
          edgePriceIndex === undefined &&
            'Add a starting price to create a new position',
        ]}
      />
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
    setZoomRange,
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
              // the +2 on index spread allows for rounded values on both sides
              zoomedRangeMaxIndex - zoomedRangeMinIndex <=
              minZoomIndexSpread + 2
                ? undefined
                : zoomIn
            }
            zoomOut={
              (dataMinIndex ?? zoomMinIndexLimit) >= zoomedRangeMinIndex &&
              (dataMaxIndex ?? zoomMaxIndexLimit) <= zoomedRangeMaxIndex
                ? undefined
                : zoomOut
            }
          />
        </div>
      )}
    </>
  );
}

function EmptyState({ warnings }: { warnings: ReactNode[] }) {
  const warning = warnings.filter(Boolean).shift();
  return warning ? (
    <g className="empty-state" transform="translate(0, -100)">
      <text
        x="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        filter="url(#text-solid-background)"
      >
        <>&nbsp;</>
        {warning}
        <>&nbsp;</>
      </text>
    </g>
  ) : null;
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
  rangeMinIndex: number,
  rangeMaxIndex: number
) {
  const roundedCurrentPriceIndex =
    currentPriceIndex && Math.round(currentPriceIndex);
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
          // set main range first to avoid flash of not disabled styling
          // when moving between two disabled index pairs
          setRangeMinIndex(newIndex);
          // keep one tick space between min and max UI visuals
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
          // set main range first to avoid flash of not disabled styling
          // when moving between two disabled index pairs
          setRangeMaxIndex(newIndex);
          // keep one tick space between min and max UI visuals
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
    currentPriceIndex,
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
      return formatPercentage(
        tickIndexToPrice(new BigNumber(tickIndex))
          .dividedBy(tickIndexToPrice(new BigNumber(currentPriceIndex)))
          .minus(1)
          .toFixed(),
        {
          signDisplay: 'always',
          useGrouping: true,
        },
        2
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
          className="line pole-stick-edge"
          x1={plotX(rangeMinIndex).toFixed(3)}
          x2={plotX(rangeMinIndex).toFixed(3)}
          y1={plotY(new BigNumber(1)).toFixed(3)}
          y2={(plotY(new BigNumber(0)) + 8).toFixed(3)}
        />
        <rect
          className="pole-stick"
          x={(plotX(rangeMinIndex) - poleWidth).toFixed(3)}
          width={poleWidth}
          y={plotY(new BigNumber(1)).toFixed(3)}
          height={(
            plotY(new BigNumber(0)) -
            plotY(new BigNumber(1)) +
            8
          ).toFixed(3)}
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
          x={(4 + plotX(rangeMinIndex) - poleWidth / 2).toFixed(3)}
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
            },
            {
              reformatSmallValues: false,
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
            {formatPercentageValue(
              // show percentage to this limit index line (inclusive)
              rangeMinValueIndex <= Math.round(currentPriceIndex)
                ? rangeMinValueIndex - 1
                : rangeMinValueIndex,
              currentPriceIndex
            )}
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
          className="line pole-stick-edge"
          x1={plotX(rangeMaxIndex).toFixed(3)}
          x2={plotX(rangeMaxIndex).toFixed(3)}
          y1={plotY(new BigNumber(1)).toFixed(3)}
          y2={(plotY(new BigNumber(0)) + 8).toFixed(3)}
        />
        <rect
          className="pole-stick"
          x={plotX(rangeMaxIndex).toFixed(3)}
          width={poleWidth}
          y={plotY(new BigNumber(1)).toFixed(3)}
          height={(
            plotY(new BigNumber(0)) -
            plotY(new BigNumber(1)) +
            8
          ).toFixed(3)}
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
          x={(4 + plotX(rangeMaxIndex) - poleWidth / 2).toFixed(3)}
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
            },
            {
              reformatSmallValues: false,
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
            {formatPercentageValue(
              // show percentage to this limit index line (inclusive)
              rangeMaxValueIndex >= Math.round(currentPriceIndex)
                ? rangeMaxValueIndex + 1
                : rangeMaxValueIndex,
              currentPriceIndex
            )}
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
  currentPriceIndex,
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
  currentPriceIndex: number | undefined;
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
  const currentPrice = tickIndexToPrice(new BigNumber(currentPriceIndex || 1));
  // collect reserve height to calculate stats to use
  const tickValues = userTicks.flatMap((tick) =>
    [
      tick?.reserveA.toNumber(),
      tick?.reserveB.multipliedBy(currentPrice).toNumber(),
    ].filter((reserve): reserve is number => Boolean(reserve))
  );
  const backgroundTickValues = backgroundTicks.flatMap((tick) =>
    [
      tick?.reserveA.toNumber(),
      tick?.reserveB.multipliedBy(currentPrice).toNumber(),
    ].filter((reserve): reserve is number => Boolean(reserve))
  );

  // find max cumulative value of either the current ticks or background ticks
  const cumulativeTokenValues: number = Math.max(
    tickValues.reduce((acc, v) => acc + v, 0),
    backgroundTickValues.reduce((acc, v) => acc + v, 0)
  );

  const maxValue = Math.max(...tickValues, ...backgroundTickValues);
  const minMaxHeight = getMinYHeight(backgroundTickValues.length);

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
                const newIndexBToA =
                  tick.tickIndexBToA + displacement.x / pixelsPerIndex;
                const roundedPrice = new BigNumber(
                  formatPrice(
                    tickIndexToPrice(new BigNumber(newIndexBToA)).toFixed()
                  )
                );
                return {
                  ...userTick,
                  price: roundedPrice,
                  tickIndexBToA: newIndexBToA,
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
        startDragTick(e);
      }
    },
    [userTicks, startDragTick, setUserTickSelected]
  );

  // register that clicking anywhere else in the liquidity chart will de-select the tick
  useEffect(() => {
    const charts = getCharts();
    charts.forEach((chart) => {
      chart.addEventListener('mousedown', handleClick);
    });
    return () => {
      charts.concat(getCharts());
      charts.forEach((chart) => {
        chart.addEventListener('mousedown', handleClick);
      });
    };
    function getCharts(): SVGSVGElement[] {
      return document
        ? Array.from(document.querySelectorAll('svg.chart-liquidity'))
        : [];
    }
    function handleClick() {
      setUserTickSelected(-1);
      lastSelectedTick.current = undefined;
    }
  }, [setUserTickSelected]);

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
      const tickIsSelected = userTickSelected === index;
      const backgroundTick = backgroundTicks[index] || tick;
      const background = {
        tickIndexBToA: backgroundTick.tickIndexBToA,
        reserveA: backgroundTick.reserveA,
        reserveB: backgroundTick.reserveB,
      };
      const { tickIndexBToA, reserveA, reserveB } = tick;
      // todo: display cumulative value of both side of ticks, not just one side
      const totalValue =
        (reserveA.isGreaterThan(0)
          ? cumulativeTokenValues &&
            reserveA
              .multipliedBy(scalingFactor)
              .dividedBy(cumulativeTokenValues)
          : cumulativeTokenValues &&
            reserveB
              .multipliedBy(currentPrice)
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
              .multipliedBy(currentPrice)
              .multipliedBy(scalingFactor)
              .dividedBy(cumulativeTokenValues)) || new BigNumber(0);

      const minValue = totalValue.isLessThan(backgroundValue)
        ? totalValue
        : backgroundValue;
      const maxValue = totalValue.isLessThan(backgroundValue)
        ? backgroundValue
        : totalValue;

      return !cumulativeTokenValues ? null : (
        <g
          key={index}
          className={[
            'tick',
            totalValue.isZero() && 'tick--is-zero',
            tickIsSelected && 'tick--selected',
            reserveA.isGreaterThan(0) ? 'token-a' : 'token-b',
            !totalValue.isEqualTo(backgroundValue) &&
              (totalValue.isLessThan(backgroundValue)
                ? 'tick--diff-negative'
                : 'tick--diff-positive'),
            // warn user if this seems to be a bad trade
            reserveA.isGreaterThan(0)
              ? tokenAWarningPriceIndex &&
                tickIndexBToA > tokenAWarningPriceIndex &&
                'tick--price-warning'
              : tokenBWarningPriceIndex &&
                tickIndexBToA < tokenBWarningPriceIndex &&
                'tick--price-warning',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <line
            {...rest}
            x1={plotX(tickIndexBToA).toFixed(3)}
            x2={plotX(tickIndexBToA).toFixed(3)}
            y1={percentY(new BigNumber(0)).toFixed(3)}
            y2={percentY(minValue).toFixed(3)}
            className="line"
          />
          {tick !== backgroundTick && (
            <line
              {...rest}
              x1={plotX(tickIndexBToA).toFixed(3)}
              x2={plotX(tickIndexBToA).toFixed(3)}
              y1={percentY(minValue).toFixed(3)}
              y2={percentY(maxValue).toFixed(3)}
              className="line line--diff"
            />
          )}
          <circle
            cx={plotX(tickIndexBToA).toFixed(3)}
            cy={percentY(backgroundValue).toFixed(3)}
            r="5"
            className="tip"
          />
          {tick !== backgroundTick && (
            <circle
              cx={plotX(tickIndexBToA).toFixed(3)}
              cy={percentY(totalValue).toFixed(3)}
              r="5"
              className="tip tip--diff"
            />
          )}
          <text
            x={plotX(tickIndexBToA).toFixed(3)}
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
                  x: (plotX(tickIndexBToA) - 7.5).toFixed(3),
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
  edgePriceIndex,
  plotX,
  plotY,
  className,
}: {
  tickBuckets: TickGroupMergedBucketsFilled;
  edgePriceIndex: number;
  plotX: (x: number) => number;
  plotY: (y: BigNumber) => number;
  className?: string;
}) {
  // buckets have integer bounds but the edgePriceIndex comes as a float for
  // maximum accuracy, make sure we can compare them easily here
  const roundedCurrentPriceIndex = Math.round(edgePriceIndex);

  return (
    <g
      className={['tick-buckets', 'tick-buckets--stacked', className]
        .filter(Boolean)
        .join(' ')}
    >
      {tickBuckets
        .sort((a, b) => a[0] - b[0])
        .flatMap((bucket, index) => {
          const [lowerBoundIndex, upperBoundIndex, tokenAValue, tokenBValue] =
            bucket;
          const leftSide = lowerBoundIndex < roundedCurrentPriceIndex;
          // offset the reserve value Y position if stacking buckets
          const [tokenAOffset, tokenBOffset]: (BigNumber | number)[] =
            // place "behind enemy lines" tokens below main liquiidty tokens
            !leftSide ? [0, tokenAValue] : [tokenBValue, 0];
          const buckets = [
            <Bucket
              key={`${index}-a`}
              className={['token-a', !leftSide && 'behind-enemy-lines']
                .filter(Boolean)
                .join(' ')}
              lowerBoundIndex={lowerBoundIndex}
              upperBoundIndex={upperBoundIndex}
              reserveValue={tokenAValue}
              offsetValue={tokenAOffset}
              plotX={plotX}
              plotY={plotY}
            />,
            <Bucket
              key={`${index}-b`}
              className={['token-b', leftSide && 'behind-enemy-lines']
                .filter(Boolean)
                .join(' ')}
              lowerBoundIndex={lowerBoundIndex}
              upperBoundIndex={upperBoundIndex}
              reserveValue={tokenBValue}
              offsetValue={tokenBOffset}
              plotX={plotX}
              plotY={plotY}
            />,
          ];
          // pick the rendering order
          return leftSide ? buckets : buckets.reverse();
        })}
    </g>
  );
}

function Bucket({
  className,
  lowerBoundIndex,
  upperBoundIndex,
  reserveValue,
  offsetValue,
  plotX,
  plotY,
}: {
  lowerBoundIndex: number;
  upperBoundIndex: number;
  reserveValue: BigNumber;
  offsetValue: BigNumber | number;
  className: string;
  plotX: (x: number) => number;
  plotY: (y: BigNumber) => number;
}) {
  return reserveValue.isGreaterThan(0) ? (
    <rect
      className={`tick-bucket ${className}`}
      x={plotX(lowerBoundIndex).toFixed(3)}
      width={(plotX(upperBoundIndex) - plotX(lowerBoundIndex)).toFixed(3)}
      y={plotY(reserveValue.plus(offsetValue)).toFixed(3)}
      height={(plotY(new BigNumber(0)) - plotY(reserveValue)).toFixed(3)}
    />
  ) : null;
}

function Axis({
  className = '',
  tickMarkIndex,
  tickMarkIndexes = tickMarkIndex !== undefined ? [tickMarkIndex] : [],
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
            },
            {
              reformatSmallValues: false,
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
