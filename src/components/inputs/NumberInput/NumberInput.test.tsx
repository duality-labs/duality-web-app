import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import NumberInput from './NumberInput';

interface InputProperties {
  selectionStart: number;
  selectionEnd: number;
  value: string;
  inputtedValue: string;
}

function TestNumberInput({ initialValue = '' }: { initialValue: string }) {
  const [value, setValue] = useState(initialValue);
  return (
    <>
      <label htmlFor="test-input">Test</label>
      <NumberInput id="test-input" value={value} onChange={setValue} />
    </>
  );
}

// The '|' represents the selectionStart
// The selectionEnd can also be specified by using another '|' (defaults to same as start)
// If no '|' are found then it defaults to right after the last character
test.concurrent.each([
  // 0 and . tests
  ['0|', '0|'],
  ['.|', '.|'],
  ['.0|', '.0|'],
  ['0.|', '0.|'],
  ['00.|', '00.|'],
  // Invalid character tests
  ['-|4', '|4'],
  // Trailing 0s tests
  ['0.000001220000|', '0.000001220000|'],
  ['0.00000|1220000', '0.00000|1220000'],
  ['0.00000122|0000', '0.00000122|0000'],
  ['0.0000012200|00', '0.0000012200|00'],
  // Leading 0s tests
  ['000|', '000|'],
  ['00|0', '00|0'],
  ['0000.|', '0000.|'],
  ['0000.0|', '0000.0|'],
  ['0000.|0', '0000.|0'],
  ['0|000.0', '0|000.0'],
])('converts "%s" to "%s"', async function (originalValue, expectedValue) {
  const { value, inputtedValue, selectionStart, selectionEnd } = parseValue(
    originalValue,
    { extractInputtedValue: true }
  );
  render(<TestNumberInput initialValue={value} />);

  // get input
  const input = await screen.findByLabelText<HTMLInputElement>('Test');
  input.focus();
  input.selectionStart = selectionStart;
  input.selectionEnd = selectionEnd;

  // simulateuser typing
  // cannot use userEvent.type here as that can reset the selection cursor to the end
  userEvent.keyboard(inputtedValue);

  const expected = parseValue(expectedValue);

  expect(input.value).toBe(expected.value);
  expect(input.selectionStart).toBe(expected.selectionStart);
  expect(input.selectionEnd).toBe(expected.selectionEnd);
});

function parseValue(
  futureText: string,
  { extractInputtedValue = false } = {}
): InputProperties {
  const inputtedValueIndex = futureText.lastIndexOf('|') - 1;
  const textArray = futureText.split('');
  const inputtedValue = extractInputtedValue
    ? textArray.splice(inputtedValueIndex, 1).join('')
    : '';
  const text = textArray.join('');
  const start = text.indexOf('|');
  const end = text.lastIndexOf('|');
  return {
    value: text.replace(/\|/g, ''),
    selectionStart: start === -1 ? text.length : start,
    selectionEnd: start === -1 ? text.length : start === end ? start : end - 1,
    inputtedValue,
  };
}
