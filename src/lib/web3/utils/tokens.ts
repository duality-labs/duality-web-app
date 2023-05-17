import BigNumber from 'bignumber.js';
import { Asset, Chain } from '@chain-registry/types';

export interface Token extends Asset {
  chain: Chain;
}

export type TokenAddress = string; // a valid hex address, eg. 0x01

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
    .sort((a, b) => a.exponent - b.exponent)[0].denom
): string | undefined {
  const { denom_units } = token;
  const inputDenomUnit = denom_units.find(({ denom }) => denom === inputDenom);
  const outputDenomUnit = denom_units.find(
    ({ denom }) => denom === outputDenom
  );
  if (inputDenomUnit && outputDenomUnit) {
    return new BigNumber(amount)
      .shiftedBy(inputDenomUnit.exponent - outputDenomUnit.exponent)
      .toFixed(outputDenomUnit.exponent, BigNumber.ROUND_DOWN);
  }
}
