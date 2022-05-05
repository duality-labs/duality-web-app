import React, { useState, useEffect } from 'react';

import TokenPicker from '../TokenPicker';

import { Token } from '../TokenPicker/mockHooks';

import './TokenInputGroup.scss';

interface InputGroupProps {
  changeToken: (token?: Token) => void;
  changeValue: (value: string) => void;
  exclusion?: Token;
  token?: Token;
  value?: string;
  className?: string;
  tokenList: Array<Token>;
}

export default function TokenInputGroup({
  tokenList,
  changeValue,
  changeToken,
  value,
  exclusion,
  className,
  token,
}: InputGroupProps) {
  const [selectedToken, setToken] = useState(token);
  const [selectedValue, setValue] = useState(value);

  useEffect(() => {
    setValue(value);
  }, [value]);

  useEffect(() => {
    setToken(token);
  }, [token]);

  return (
    <div className={`${className || ''} token-input-group`}>
      <input
        type="text"
        className="form-control"
        value={selectedValue ?? '...'}
        onInput={onInput}
        onChange={(e) => onInputChange(e.target.value)}
      />
      <TokenPicker
        value={selectedToken}
        onChange={changeSelected}
        tokenList={tokenList}
        exclusion={exclusion}
      />
    </div>
  );

  function onInputChange(newValue: string) {
    setValue(newValue);
    changeValue(newValue);
  }

  function changeSelected(newToken: Token | undefined) {
    if (newToken === exclusion) return;
    setToken(newToken);
    changeToken(newToken);
  }
}

/**
 * Clear invalid characters from the input
 * @param {React.FormEvent<HTMLInputElement>} event change event
 * @returns {void}
 */
function onInput(event: React.FormEvent<HTMLInputElement>) {
  const target = event.currentTarget;
  const value = target.value;
  let selectionStart = target.selectionStart ?? value.length;
  let selectionEnd = target.selectionEnd ?? value.length;
  let firstDigitFound = false;
  let pointFound = false;
  let result = '';

  // special case (0|0)
  if (value === '00' && selectionStart === 1 && selectionEnd === 1) {
    target.value = '0';
    target.selectionStart = 1;
    target.selectionEnd = 1;
    return;
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

  target.value = result;
  target.selectionStart = selectionStart;
  target.selectionEnd = selectionEnd;

  function removeChar(index: number, gap = 1) {
    if (!gap) return;
    for (let i = gap; i >= 1; i--) {
      if (index <= selectionStart - i) selectionStart -= 1;
      if (index <= selectionEnd - i) selectionEnd -= 1;
    }
  }
}
