/**
 * Clear invalid characters from the input
 * @param {HTMLInputElement} dom input element
 * @param {String} append optional string to always be appended to number
 * @returns {HTMLInputElement}
 */
export function cleanInput(dom: HTMLInputElement, append = '') {
  const value = dom.value.endsWith(append)
    ? dom.value.slice(0, dom.value.length - append.length)
    : dom.value;
  let selectionStart = dom.selectionStart ?? value.length;
  let selectionEnd = dom.selectionEnd ?? value.length;
  let firstDigitFound = false;
  let pointFound = false;
  let result = '';

  // special case (0|0)
  if (value === '00' && selectionStart === 1 && selectionEnd === 1) {
    dom.value = `0${append}`;
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
        // Remove the character if the current one is a '.' but one has already been found
        removeChar(index);
      } else if (firstDigitFound) {
        // If this is the first '.' found and a digit has already been registered
        result += char;
        pointFound = true;
      } else {
        // If the first dot appears prior to any digits add a 0 and push selection
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
    return `${text}0`;
  });

  // remove leading zeros
  const oldSize = result.length;
  result = result.replace(/^0+((?:\d+\.)|(?:\d$))/, '$1');
  const sizeDiff = oldSize - result.length;
  selectionStart = Math.max(selectionStart - sizeDiff, 0);
  selectionEnd = Math.max(selectionEnd - sizeDiff, 0);

  // remove lagging zeros
  result = result.replace(/(\.\d+?)0+$/, function (_, text, index) {
    const zeroIndex = index + text.length;
    const extraZeroes = '0'.repeat(
      Math.max(0, Math.max(selectionStart, selectionEnd) - zeroIndex)
    );
    return text + extraZeroes;
  });
  selectionStart = Math.min(selectionStart, result.length);
  selectionEnd = Math.min(selectionEnd, result.length);

  // special case, fully empty text
  if (!value) {
    result = '0';
    selectionStart = 1;
    selectionEnd = 1;
  }

  dom.value = `${result}${append}`;
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
