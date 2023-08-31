import { useMemo, useCallback } from 'react';
import { Token } from '../../lib/web3/utils/tokens';
import { useTickLiquidityBuckets } from './useBuckets';
import { useCurrentPriceIndex } from './useCurrentPriceIndex';

const bucketWidth = 8; // bucket width in pixels

const leftPadding = 75;
const rightPadding = 75;
const topPadding = 33;
const bottomPadding = 26; // height of axis-ticks element

export function useViewableIndexes(
  graphMinIndex: number,
  graphMaxIndex: number,
  containerWidth = 0
) {
  const [viewableMinIndex, viewableMaxIndex] = useMemo<[number, number]>(() => {
    // get bounds
    const spread = graphMaxIndex - graphMinIndex;
    const width = Math.max(1, containerWidth - leftPadding - rightPadding);
    return [
      graphMinIndex - (spread * leftPadding) / width,
      graphMaxIndex + (spread * rightPadding) / width,
    ];
  }, [graphMinIndex, graphMaxIndex, containerWidth]);
  return [viewableMinIndex, viewableMaxIndex];
}

export default function usePlotFunctions({
  tokenA,
  tokenB,
  initialPriceFormValue = '',
  containerWidth = 0,
  containerHeight = 0,
  graphMinIndex,
  graphMaxIndex,
}: {
  tokenA?: Token;
  tokenB?: Token;
  initialPriceFormValue?: string;
  containerHeight: number;
  containerWidth: number;
  graphMinIndex: number;
  graphMaxIndex: number;
}) {
  const edgePriceIndex = useCurrentPriceIndex(
    tokenA,
    tokenB,
    initialPriceFormValue
  );

  const [viewableMinIndex, viewableMaxIndex] = useViewableIndexes(
    graphMinIndex,
    graphMaxIndex,
    containerWidth
  );

  const tickBuckets = useTickLiquidityBuckets({
    tokenA,
    tokenB,
    containerWidth,
    bucketWidth,
    viewableMinIndex,
    viewableMaxIndex,
    edgePriceIndex,
  });

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
      Math.max(0, containerWidth - leftPadding - rightPadding),
      // height
      Math.max(0, containerHeight - topPadding - bottomPadding),
    ];
  }, [containerWidth, containerHeight]);

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
  return [plotX, plotY, percentY];
}
