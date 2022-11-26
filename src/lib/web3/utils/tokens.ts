import BigNumber from 'bignumber.js';
import { Token } from '../../../components/TokenPicker/hooks';

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
