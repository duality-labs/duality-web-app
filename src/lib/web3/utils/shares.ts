import { Coin } from '@duality-labs/dualityjs/types/codegen/cosmos/base/v1beta1/coin';
import { TokenIdPair, TokenPair, resolveTokenIdPair } from './tokens';
import { guessInvertedOrder } from './pairs';

export interface IndexedShare {
  address: string;
  pairId: string;
  tickIndex1To0: string;
  fee: string;
  sharesOwned: string;
}

export function getShareInfo(coin: Coin) {
  const match = coin.denom.match(
    /^DualityPoolShares-([^-]+)-([^-]+)-t(-?\d+)-f(\d+)$/
  );
  if (match) {
    const [, token0Address, token1Address, tickIndexString, feeString] = match;
    return {
      token0Address,
      token1Address,
      tickIndex1To0String: tickIndexString,
      feeString,
      tickIndex1To0: Number(tickIndexString),
      fee: Number(feeString),
    };
  }
}

export function getShareDenom(
  tokens: TokenPair | TokenIdPair,
  tickIndex1To0: number,
  fee: number
): string | undefined {
  const tokenIds = resolveTokenIdPair(tokens);
  const [tokenId0, tokenId1] = guessInvertedOrder(tokens)
    ? [tokenIds[1], tokenIds[0]]
    : tokenIds;
  if (tokenId0 && tokenId1 && !isNaN(tickIndex1To0) && !isNaN(fee)) {
    return `DualityPoolShares-${tokenId0}-${tokenId1}-t${tickIndex1To0.toFixed(
      0
    )}-f${fee.toFixed(0)}`;
  }
}
