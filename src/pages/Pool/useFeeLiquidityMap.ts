import { useMemo } from 'react';
import BigNumber from 'bignumber.js';

import { useTokenPairTickLiquidity } from '../../lib/web3/hooks/useTickLiquidity';
import { FeeType, feeTypes } from '../../lib/web3/utils/fees';
import { calculateShares } from '../../lib/web3/utils/ticks';
import { TokenID } from '../../lib/web3/utils/tokens';

export default function useFeeLiquidityMap(tokenA?: TokenID, tokenB?: TokenID) {
  const {
    data: [token0Ticks, token1Ticks],
    isValidating,
    error,
  } = useTokenPairTickLiquidity([tokenA, tokenB]);

  const feeLiquidityMap = useMemo(() => {
    if (!token0Ticks || !token1Ticks) return;

    const ticks = token0Ticks.concat(token1Ticks);
    const feeTypeLiquidity = feeTypes.reduce<Record<FeeType['fee'], BigNumber>>(
      (result, feeType) => {
        result[feeType.fee] = new BigNumber(0);
        return result;
      },
      {}
    );

    const feeSharesMap = ticks.reduce<{ [feeTier: string]: BigNumber }>(
      (result, { fee, price1To0, reserve0, reserve1 }) => {
        const shares = calculateShares({ price1To0, reserve0, reserve1 });
        if (shares.isGreaterThan(0)) {
          const feeString = fee.toFixed();
          result[feeString] = shares.plus(result[feeString] ?? 0);
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
  }, [token0Ticks, token1Ticks]);

  return {
    data: feeLiquidityMap,
    error,
    isValidating,
  };
}
