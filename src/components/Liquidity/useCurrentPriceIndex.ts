import BigNumber from 'bignumber.js';
import { useMemo } from 'react';

import { Token } from '../../lib/web3/utils/tokens';
import { priceToTickIndex } from '../../lib/web3/utils/ticks';
import useCurrentPriceIndexFromTicks from './useCurrentPriceFromTicks';

export function useCurrentPriceIndex(
  tokenA: Token | undefined,
  tokenB: Token | undefined,
  initialPriceFormValue = ''
): number | undefined {
  // todo: base graph start and end on existing ticks and current price
  //       (if no existing ticks exist only current price can indicate start and end)

  const currentPriceIndexFromTicks = useCurrentPriceIndexFromTicks(
    tokenA?.address,
    tokenB?.address
  );

  // note edge price, the price of the edge of one-sided liquidity
  const currentPriceIndex = useMemo(() => {
    // return price as calculated by ticks
    if (currentPriceIndexFromTicks !== undefined) {
      return currentPriceIndexFromTicks;
    }
    // return calculated price index from user-given initial price
    if (Number(initialPriceFormValue) > 0) {
      return priceToTickIndex(new BigNumber(initialPriceFormValue)).toNumber();
    }
    return undefined;
  }, [currentPriceIndexFromTicks, initialPriceFormValue]);

  return currentPriceIndex;
}
