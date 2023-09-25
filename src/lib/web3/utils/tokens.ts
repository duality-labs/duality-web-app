import BigNumber from 'bignumber.js';
import { Asset, Chain } from '@chain-registry/types';
import { sha256 } from '@cosmjs/crypto';

const { REACT_APP__CHAIN_ID = '' } = process.env;

export interface Token extends Asset {
  // each asset should have exactly one chain parent
  chain: Chain;
}

export type TokenID = string; // a valid token identifier, eg. token or ibc/3C3D7B3BE4ECC85A0E5B52A3AEC3B7DFC2AA9CA47C37821E57020D6807043BE9

export type TokenPair = [Token, Token];
export type TokenIdPair = [TokenID, TokenID];
export function resolveTokenId(
  token: Token | TokenID | undefined
): TokenID | undefined {
  return typeof token === 'string' ? token : getTokenId(token);
}
export function resolveTokenIdPair(
  [token0, token1]: TokenPair | TokenIdPair | [undefined, undefined] = [
    undefined,
    undefined,
  ]
): [TokenID | undefined, TokenID | undefined] {
  return [resolveTokenId(token0), resolveTokenId(token1)];
}

export const ibcDenomRegex = /^ibc\/[0-9A-Fa-f]+$/;
export function getIbcBaseDenom(token: Token | undefined): string | undefined {
  const ibcDenom = token?.ibc?.source_denom;
  // return the source IBC denom if it is found
  if (ibcDenom) {
    const baseUnit = token.denom_units.find((unit) => unit.denom === ibcDenom);
    // return the denom that matches an appended IBC denom alias
    if (baseUnit) {
      return baseUnit.aliases?.find((alias) => alias.match(ibcDenomRegex));
    }
  }
}

// the token ID is what is the Duality chain uses as the identifying string of its denoms
// it is basically the base denom in local or IBC string format
export function getTokenId(token: Token | undefined): string | undefined {
  // return IBC base denom or the local token base denom as the token identifier
  if (token?.ibc) {
    return getIbcBaseDenom(token);
  } else if (token?.chain.chain_id === REACT_APP__CHAIN_ID) {
    return token?.base;
  }
}

export function getDenomAmount(
  token: Token,
  amount: BigNumber.Value,
  // default to minimum denomination output
  inputDenom: string = token.denom_units
    .slice()
    .sort((a, b) => a.exponent - b.exponent)[0].denom,
  // default to minimum denomination output
  outputDenom: string = token.denom_units
    .slice()
    .sort((a, b) => a.exponent - b.exponent)[0].denom,
  {
    fractionalDigits,
    // set minimum significant digits forcibly past fractional digits
    significantDigits,
  }: {
    fractionalDigits?: number;
    // should we display more digits if there is not enough resolution to see?
    significantDigits?: number;
  } = {}
): string | undefined {
  const { denom_units } = token;
  const inputDenomUnit = denom_units.find((unit) => {
    return (
      // match denom
      unit.denom === inputDenom ||
      // or match alias
      unit.aliases?.find((alias) => alias === inputDenom)
    );
  });
  const outputDenomUnit = denom_units.find(
    ({ denom }) => denom === outputDenom
  );
  if (inputDenomUnit && outputDenomUnit) {
    const outputValue = new BigNumber(amount).shiftedBy(
      inputDenomUnit.exponent - outputDenomUnit.exponent
    );
    const outputString = outputValue.toFixed(
      fractionalDigits ?? outputDenomUnit.exponent,
      BigNumber.ROUND_DOWN
    );
    // return output modified to have more digits if asked for
    return significantDigits &&
      // calculate output significant digits and if this is less than asked
      new BigNumber(outputString).sd(true) < significantDigits
      ? outputValue.sd(significantDigits).toFixed()
      : // extend digits
        outputString;
  }
}

export function getDisplayDenomAmount(
  token: Token,
  amount: BigNumber.Value,
  options: {
    fractionalDigits?: number;
    // should we display more digits if there is not enough resolution to see?
    significantDigits?: number;
  } = {}
): string | undefined {
  return getDenomAmount(token, amount, token.base, token.display, options);
}

export function getBaseDenomAmount(
  token: Token,
  amount: BigNumber.Value,
  {
    fractionalDigits = 0,
    // so digits forcibly past fractional digits
    significantDigits,
  }: {
    fractionalDigits?: number;
    // should we display more digits if there is not enough resolution to see?
    significantDigits?: number;
  } = {}
): string | undefined {
  return getDenomAmount(token, amount, token.display, token.base, {
    fractionalDigits,
    significantDigits,
  });
}

export function roundToBaseUnit(
  token: Token,
  amount: BigNumber.Value,
  roundingMode: BigNumber.RoundingMode = BigNumber.ROUND_DOWN
): string | undefined {
  const baseAmount = getBaseDenomAmount(token, amount);
  const roundedAmount =
    baseAmount && new BigNumber(baseAmount).toFixed(0, roundingMode);
  const displayAmount =
    roundedAmount && getDisplayDenomAmount(token, roundedAmount);
  return displayAmount && new BigNumber(displayAmount).toFixed();
}

// get how much a utoken amount is worth in USD
export function getTokenValue(
  token: Token,
  amount: BigNumber.Value | undefined,
  price: number | undefined
): number | undefined {
  if (price === undefined || amount === undefined) {
    return undefined;
  }
  return new BigNumber(getDisplayDenomAmount(token, amount) || 0)
    .multipliedBy(price || 0)
    .toNumber();
}

// get IBC hash representation of a IBC transferred denom
export function getIbcDenom(
  baseDenom: string,
  channel: string,
  port = 'transfer'
) {
  return `ibc/${Buffer.from(
    sha256(Buffer.from(`${port}/${channel}/${baseDenom}`))
  )
    .toString('hex')
    .toUpperCase()}`;
}
