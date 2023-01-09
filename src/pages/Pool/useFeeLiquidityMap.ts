import { useMemo } from 'react';
import BigNumber from 'bignumber.js';

import {
  TokenAddress,
  useIndexerPairData,
} from '../../lib/web3/indexerProvider';
import { FeeType, feeTypes } from '../../lib/web3/utils/fees';
import { calculateShares } from '../../lib/web3/utils/ticks';

export default function useFeeLiquidityMap(
  tokenA?: TokenAddress,
  tokenB?: TokenAddress
) {
  const {
    data: pair,
    isValidating,
    error,
  } = useIndexerPairData(tokenA, tokenB);
  const feeLiquidityMap = useMemo(() => {
    if (!pair) return;

    const ticks = Object.values(pair.ticks);
    const feeTypeLiquidity = feeTypes.reduce<Record<FeeType['fee'], BigNumber>>(
      (result, feeType) => {
        result[feeType.fee] = new BigNumber(0);
        return result;
      },
      {}
    );

    const feeSharesMap = ticks.reduce<{ [feeTier: string]: BigNumber }>(
      (result, tickData) => {
        const totalShares = calculateShares(tickData)
        if (totalShares.isGreaterThan(0)) {
          const feeString = tickData.fee.toFixed();
          result[feeString] = result[feeString].plus(totalShares);
        }
        return result;
      },
      feeTypeLiquidity
    );

    const totalLiquidity = Object.values(feeSharesMap).reduce<BigNumber>(
      (total, shares) => {
        return total.plus(shares);
      },
      new BigNumber(0)
    );

    // normalize shares to a percentage
    return Object.entries(feeSharesMap).reduce<{
      [feeTier: string]: BigNumber;
    }>((result, [feeString, shares]) => {
      result[feeString] = shares.dividedBy(totalLiquidity);
      return result;
    }, feeTypeLiquidity);
  }, [pair]);

  return {
    data: feeLiquidityMap,
    error,
    isValidating,
  };
}
