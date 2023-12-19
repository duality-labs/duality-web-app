import { Coin } from '@duality-labs/dualityjs/types/codegen/cosmos/base/v1beta1/coin';

const DexShareRegex = /^neutron\/pool\/(\d+)$/;

// Neutron Dex denoms may be tokenized Dex shares or regular tokens on the chain
export function isDexShare(coin: Coin) {
  return DexShareRegex.test(coin.denom);
}

export function getDexSharePoolID(coin: Coin) {
  const match = coin.denom.match(DexShareRegex);
  if (match) {
    const [, idString] = match;
    const id = Number(idString);
    return id >= 0 ? id : undefined;
  }
}
