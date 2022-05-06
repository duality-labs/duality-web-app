/**
 * Clear invalid characters from the input
 * @param {HTMLInputElement} dom input element
 * @returns {HTMLInputElement}
 */
export function cleanInput(dom: HTMLInputElement) {
  const value = dom.value;
  let selectionStart = dom.selectionStart ?? value.length;
  let selectionEnd = dom.selectionEnd ?? value.length;
  let firstDigitFound = false;
  let pointFound = false;
  let result = '';

  // special case (0|0)
  if (value === '00' && selectionStart === 1 && selectionEnd === 1) {
    dom.value = '0';
    dom.selectionStart = 1;
    dom.selectionEnd = 1;
    return dom;
  }

  // remove invalid characters
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (/\d/.test(char)) {
      firstDigitFound = true;
      result += char;
    } else if (char === '.') {
      if (pointFound) {
        // Ignore multiple points (0._0)
        removeChar(index);
      } else if (firstDigitFound) {
        // Check for the first point (0_0)
        result += char;
        pointFound = true;
      } else {
        // Check for the first point if no digit has been registered and add a 0 (_0)
        result += '0' + char;
        if (index < selectionStart) selectionStart += 1;
        if (index < selectionEnd) selectionEnd += 1;
        pointFound = true;
      }
    } else {
      removeChar(index);
    }
  }

  // convert 0. to 0.0
  result = result.replace(/\.$/, function (text: string, index: number) {
    if (index > selectionStart) selectionStart += 1;
    if (index > selectionEnd) selectionEnd += 1;
    return text + '0';
  });

  // remove leading zeros
  const oldSize = result.length;
  result = result.replace(/^0+((?:\d+\.)|(?:\d$))/, '$1'); // todo
  const sizeDiff = oldSize - result.length;
  selectionStart = Math.max(selectionStart - sizeDiff, 0);
  selectionEnd = Math.max(selectionEnd - sizeDiff, 0);

  // remove lagging zeros
  result = result.replace(/(\.\d+?)0+$/, '$1');
  selectionStart = Math.min(selectionStart, result.length);
  selectionEnd = Math.min(selectionEnd, result.length);

  // special case, fully empty text
  if (!value) {
    result = '0';
    selectionStart = 0;
    selectionEnd = 0;
  }

  dom.value = result;
  dom.selectionStart = selectionStart;
  dom.selectionEnd = selectionEnd;
  return dom;

  function removeChar(index: number, gap = 1) {
    if (!gap) return;
    for (let i = gap; i >= 1; i--) {
      if (index <= selectionStart - i) selectionStart -= 1;
      if (index <= selectionEnd - i) selectionEnd -= 1;
    }
  }
}
