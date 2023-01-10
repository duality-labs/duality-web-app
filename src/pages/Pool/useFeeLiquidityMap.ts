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
      (result, { fee, price, reserve0, reserve1 }) => {
        const shares = calculateShares({ price, reserve0, reserve1 });
        if (shares.isGreaterThan(0)) {
          const feeString = fee.toFixed();
          result[feeString] = result[feeString].plus(shares);
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
