import { CoinSDKType } from '@duality-labs/dualityjs/types/codegen/cosmos/base/v1beta1/coin';

export interface IndexedShare {
  address: string;
  pairId: string;
  tickIndex: string;
  fee: string;
  sharesOwned: string;
}

export function getShareInfo(coin: CoinSDKType) {
  const match = coin.denom.match(
    /^DualityPoolShares-([^-]+)-([^-]+)-t(-?\d+)-f(\d+)$/
  );
  if (match) {
    const [, token0Address, token1Address, tickIndexString, feeString] = match;
    return {
      token0Address,
      token1Address,
      tickIndexString,
      feeString,
      tickIndex: Number(tickIndexString),
      fee: Number(feeString),
    };
  }
}
