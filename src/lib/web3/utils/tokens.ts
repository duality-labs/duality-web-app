import BigNumber from 'bignumber.js';
import { Asset, Chain } from '@chain-registry/types';
import { sha256 } from '@cosmjs/crypto';

export interface Token extends Asset {
  chain: Chain;
  // enforce that an address exists
  address: TokenAddress;
}

export type TokenAddress = string; // a valid hex address, eg. 0x01

export type TokenPair = [Token, Token];
export type TokenAddressPair = [TokenAddress, TokenAddress];
export function getTokenAddress(
  token: Token | TokenAddress | undefined
): TokenAddress | undefined {
  return typeof token === 'string' ? token : token?.address;
}
export function getTokenAddressPair(
  [token0, token1]: TokenPair | TokenAddressPair | [undefined, undefined] = [
    undefined,
    undefined,
  ]
): [TokenAddress | undefined, TokenAddress | undefined] {
  return [getTokenAddress(token0), getTokenAddress(token1)];
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
    // so digits forcibly past fractional digits
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
