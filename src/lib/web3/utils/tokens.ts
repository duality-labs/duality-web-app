import BigNumber from 'bignumber.js';
import { Asset, Chain } from '@chain-registry/types';

export interface Token extends Asset {
  chain: Chain;
  // enforce that an address exists
  address: TokenAddress;
}

export type TokenAddress = string; // a valid hex address, eg. 0x01

export type TokenPair = [Token, Token];
export type TokenAddressPair = [TokenAddress, TokenAddress];
export function getTokenAddressPair([token0, token1]:
  | TokenPair
  | TokenAddressPair): TokenAddressPair {
  return [
    typeof token0 === 'string' ? token0 : token0.address,
    typeof token1 === 'string' ? token1 : token1.address,
  ];
}

export function getAmountInDenom(
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
  const inputDenomUnit = denom_units.find(({ denom }) => denom === inputDenom);
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

// get how much a utoken amount is worth in USD
export function getTokenValue(
  token: Token,
  amount: BigNumber.Value | undefined,
  price: number | undefined
): number | undefined {
  if (price === undefined || amount === undefined) {
    return undefined;
  }
  return new BigNumber(
    getAmountInDenom(token, amount, token.address, token.display) || 0
  )
    .multipliedBy(price || 0)
    .toNumber();
}
