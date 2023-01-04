import { Dispatch, SetStateAction, useState } from 'react';

// restrict output values to valid numbers as string
// invalid inputs such as '' or '.' are returned as undefined
const formatValue = (value: string): string | undefined => {
  return value.length > 0 && !isNaN(Number(value)) ? value : undefined;
};

// opinionated use of numeric input state to read a formatted 'valid' output
// so that a parent/ancestor component may see the state of both an input
// value and its resolved output value (or an inline default value if given)
//   eg. [inputValue, setInputValue, value='0'] = useNumericInputState();
//   where: `inputValue` may be "." and `value` would be "0";
export function useNumericInputState(
  defaultValue: string | (() => string) = ''
): [string, Dispatch<SetStateAction<string>>, string | undefined] {
  const [inputStringValue, setInputStringValue] =
    useState<string>(defaultValue);
  // return input string state with extra formatted value
  return [inputStringValue, setInputStringValue, formatValue(inputStringValue)];
}
