import { cleanInput } from './utils';

interface InputProperties {
  selectionStart: number;
  selectionEnd: number;
  value: string;
}

test.concurrent.each([
  ['0|', '0|'],
  ['.|', '0.|0'],
  ['.0|', '0.0|'],
  ['0.|', '0.|0'],
  ['00.|', '0.|0'],
  ['-4|', '4|'],
  ['-|4', '|4'],
  ['-04|', '4|'],
  ['-0|4', '|4'],
  ['-0|4.00', '|4.0'],
  ['-04|.00', '4|.0'],
  ['-04.|00', '4.|0'],
  ['-04.0|0', '4.0|'],
  ['-04.00|', '4.0|'],
])('converts "%s" to "%s"', function (originalValue, expectedValue) {
  const { value, selectionStart, selectionEnd } = parseValue(originalValue);
  const dom = createInput(value, selectionStart, selectionEnd);
  const expected = parseValue(expectedValue);
  cleanInput(dom);
  expect(dom.value).toBe(expected.value);
  expect(dom.selectionStart).toBe(expected.selectionStart);
  expect(dom.selectionEnd).toBe(expected.selectionEnd);
});

function createInput(
  value: string,
  start: number,
  end?: number
): HTMLInputElement {
  const input = document.createElement('input');
  input.value = value;
  input.selectionStart = start;
  input.selectionEnd = end ?? start;
  return input;
}

function parseValue(text: string): InputProperties {
  const start = text.indexOf('|');
  const end = text.lastIndexOf('|');
  return {
    value: text.replace(/\|/g, ''),
    selectionStart: start === -1 ? text.length : start,
    selectionEnd: start === -1 ? text.length : start === end ? start : end - 1,
  };
}
