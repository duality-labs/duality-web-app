import { CoinSDKType } from '@duality-labs/dualityjs/types/codegen/cosmos/base/v1beta1/coin';
import { TokenAddressPair, TokenPair, getTokenAddressPair } from './tokens';
import { guessInvertedOrder } from './pairs';

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

export function getShareDenom(
  tokens: TokenPair | TokenAddressPair,
  tickIndex: number,
  fee: number
): string | undefined {
  const tokenAddresses = getTokenAddressPair(tokens);
  const [token0Address, token1Address] = guessInvertedOrder(
    tokenAddresses[0],
    tokenAddresses[1]
  )
    ? [tokenAddresses[1], tokenAddresses[0]]
    : tokenAddresses;
  if (token0Address && token1Address && !isNaN(tickIndex) && !isNaN(fee)) {
    return `DualityPoolShares-${token0Address}-${token1Address}-t${tickIndex.toFixed(
      0
    )}-f${fee.toFixed(0)}`;
  }
}
