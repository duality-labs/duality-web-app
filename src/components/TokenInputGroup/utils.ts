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
  result = result.replace(
    /^(0+)(.?)/,
    function (_: string, text: string, nextChar: string, index: number) {
      if (!nextChar || nextChar === '.') {
        removeChar(index, text.length - 1);
        return `0${nextChar}`;
      } else {
        removeChar(index, text.length);
        return nextChar;
      }
    }
  );

  // remove lagging zeros
  result = result.replace(
    /(\.)(.*)0+$/,
    function (
      fullText: string,
      point: string,
      previousText: string,
      text: string,
      index: number
    ) {
      if (previousText) {
        removeChar(index, text.length - 1);
        return `${point}${previousText}`;
      } else {
        removeChar(index + fullText.length - text.length + 1, text.length - 1);
        return `${point}${previousText}${0}`;
      }
    }
  );

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
