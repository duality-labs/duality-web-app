import { Coin } from '../generated/ts-client/cosmos.bank.v1beta1/types/cosmos/base/v1beta1/coin';

export interface IndexedShare {
  address: string;
  pairId: string;
  tickIndex: string;
  feeIndex: string;
  sharesOwned: string;
}

export function getShareInfo(coin: Coin) {
  const match = coin.denom.match(
    /^DualityPoolShares-([^-]+)-([^-]+)-t(-?\d+)-f(\d+)$/
  );
  if (match) {
    const [, token0Address, token1Address, tickIndexString, feeIndexString] =
      match;
    return {
      token0Address,
      token1Address,
      tickIndexString,
      feeIndexString,
      tickIndex: Number(tickIndexString),
      feeIndex: Number(feeIndexString),
    };
  }
}
