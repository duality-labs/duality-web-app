import BigNumber from 'bignumber.js';
import { Token } from '../../../components/TokenPicker/hooks';

export function getAmountInDenom(
  token: Token,
  amount: BigNumber.Value,
  inputDenom: string,
  outputDenom: string
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
