import BigNumber from 'bignumber.js';
import { useMemo } from 'react';

import { roundToSignificantDigits } from '../../lib/utils/number';
import { Token } from '../../lib/web3/utils/tokens';
import { useOrderedTokenPair } from '../../lib/web3/hooks/useTokenPairs';
import { useTokenPairTickLiquidity } from '../../lib/web3/hooks/useTickLiquidity';
import { TickInfo, priceToTickIndex } from '../../lib/web3/utils/ticks';

const { REACT_APP__MAX_TICK_INDEXES = '' } = process.env;
const [
  priceMinIndex = Number.MIN_SAFE_INTEGER,
  priceMaxIndex = Number.MAX_SAFE_INTEGER,
] = REACT_APP__MAX_TICK_INDEXES.split(',').map(Number).filter(Boolean);

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

const defaultMinIndex = priceToTickIndex(new BigNumber(1 / 1.1)).toNumber();
const defaultMaxIndex = priceToTickIndex(new BigNumber(1.1)).toNumber();

export function useLiquidityDataExtents(
  tokenA: Token | undefined,
  tokenB: Token | undefined
) {
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

  // set and allow ephemeral setting of graph extents
  // allow user ticks to reset the boundary of the graph
  const [dataMinIndex, dataMaxIndex] = useMemo<(number | undefined)[]>(() => {
    return [
      (tokenATicks[tokenATicks.length - 1] || tokenBTicks[0])?.tickIndexBToA,
      (tokenBTicks[tokenBTicks.length - 1] || tokenATicks[0])?.tickIndexBToA,
    ];
  }, [tokenATicks, tokenBTicks]);

  return [dataMinIndex, dataMaxIndex];
}

export function useUserRangeExtents(
  rangeMin: BigNumber.Value,
  rangeMax: BigNumber.Value,
  edgePriceIndex?: number
) {
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

  const [rangeMinIndex, rangeMaxIndex] = useMemo(
    () =>
      getRangePositions(
        edgePriceIndex,
        fractionalRangeMinIndex,
        fractionalRangeMaxIndex
      ),
    [edgePriceIndex, fractionalRangeMaxIndex, fractionalRangeMinIndex]
  );

  return [rangeMinIndex, rangeMaxIndex];
}

export function useUserTickExtents(userTicks: Array<Tick | undefined> = []) {
  const [userTicksMinIndex, userTicksMaxIndex] = useMemo(() => {
    return userTicks.reduce<[number | undefined, number | undefined]>(
      ([userTicksMinIndex, userTicksMaxIndex], tick) => {
        const tickIndex = tick?.tickIndexBToA;
        // don't update extents if there is no tick index
        if (tickIndex === undefined) {
          return [userTicksMinIndex, userTicksMaxIndex];
        }
        // update extents if value is outside current extents
        return [
          userTicksMinIndex === undefined
            ? tickIndex
            : tickIndex < userTicksMinIndex
            ? tickIndex
            : userTicksMinIndex,
          userTicksMaxIndex === undefined
            ? tickIndex
            : tickIndex > userTicksMaxIndex
            ? tickIndex
            : userTicksMaxIndex,
        ];
      },
      [undefined, undefined]
    );
  }, [userTicks]);
  return [userTicksMinIndex, userTicksMaxIndex];
}

export function useChartIndexes({
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
}: {
  dataMinIndex: number | undefined;
  dataMaxIndex: number | undefined;
  userTicksMinIndex: number | undefined;
  userTicksMaxIndex: number | undefined;
  rangeMinIndex: number | undefined;
  rangeMaxIndex: number | undefined;
  zoomMinIndex: number | undefined;
  zoomMaxIndex: number | undefined;
  edgePriceIndex: number | undefined;
}) {
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
      userTicksMinIndex,
      userTicksMaxIndex,
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
    userTicksMinIndex,
    userTicksMaxIndex,
    zoomedDataMinIndex,
    zoomedDataMaxIndex,
    initialGraphMinIndex,
    initialGraphMaxIndex,
  ]);

  return [graphMinIndex, graphMaxIndex];
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
