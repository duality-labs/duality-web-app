import {
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
  FormEvent,
  ReactNode,
  useMemo,
  Fragment,
  useRef,
} from 'react';
import { Link, useMatch } from 'react-router-dom';
import BigNumber from 'bignumber.js';

import {
  formatAmount,
  formatMaximumSignificantDecimals,
  formatPrice,
} from '../../lib/utils/number';
import { priceToTickIndex, tickIndexToPrice } from '../../lib/web3/utils/ticks';

export const formatRangeString = (
  value: BigNumber.Value,
  significantDecimals = 3
) => {
  return formatAmount(
    formatMaximumSignificantDecimals(value, significantDecimals),
    { minimumSignificantDigits: significantDecimals }
  );
};

export function useRangeState(
  initialRangeMinFormValue: string,
  initialRangeMaxFormValue: string
): [
  [string, (rangeFormValue: string) => void],
  [string, (rangeFormValue: string) => void],
  [number, React.Dispatch<React.SetStateAction<number>>],
  [number, React.Dispatch<React.SetStateAction<number>>]
] {
  const [rangeMinFormValue, _setRangeMinFormValue] = useState<string>(
    initialRangeMinFormValue
  );
  const [rangeMaxFormValue, _setRangeMaxFormValue] = useState<string>(
    initialRangeMaxFormValue
  );
  const [rangeMinIndex, _setRangeMinIndex] = useState<number>(() =>
    priceToTickIndex(new BigNumber(initialRangeMinFormValue)).toNumber()
  );
  const [rangeMaxIndex, _setRangeMaxIndex] = useState<number>(() =>
    priceToTickIndex(new BigNumber(initialRangeMaxFormValue)).toNumber()
  );

  // we have two controls for each range value: a string and index setter
  // these both need to update each other in order to not cause conflicts

  const setRangeMinIndex = useCallback<
    (value: React.SetStateAction<number>) => void
  >(
    (rangeMinIndexOrCallback: number | ((prevState: number) => number)) => {
      _setRangeMinIndex((prevIndex) => {
        const rangeMinIndex =
          typeof rangeMinIndexOrCallback === 'function'
            ? rangeMinIndexOrCallback(prevIndex)
            : rangeMinIndexOrCallback;
        const rangeMinFormValue = getRangeMinFormValue(rangeMinIndex);
        if (rangeMinFormValue !== undefined) {
          _setRangeMinFormValue(rangeMinFormValue);
        }
        return rangeMinIndex;
      });

      function getRangeMinFormValue(rangeMinIndex: number): string | undefined {
        if (rangeMinIndex !== undefined && rangeMaxIndex !== undefined) {
          // calculate complementary value
          return formatRangeString(
            tickIndexToPrice(new BigNumber(rangeMinIndex)),
            getSignificantDecimals(rangeMinIndex, rangeMaxIndex)
          );
        }
      }
    },
    [rangeMaxIndex]
  );

  const setRangeMaxIndex = useCallback<
    (value: React.SetStateAction<number>) => void
  >(
    (rangeMaxIndexOrCallback: number | ((prevState: number) => number)) => {
      _setRangeMaxIndex((prevIndex) => {
        const rangeMaxIndex =
          typeof rangeMaxIndexOrCallback === 'function'
            ? rangeMaxIndexOrCallback(prevIndex)
            : rangeMaxIndexOrCallback;
        const rangeMaxFormValue = getRangeMaxFormValue(rangeMaxIndex);
        if (rangeMaxFormValue !== undefined) {
          _setRangeMaxFormValue(rangeMaxFormValue);
        }
        return rangeMaxIndex;
      });

      function getRangeMaxFormValue(rangeMaxIndex: number): string | undefined {
        if (rangeMinIndex !== undefined && rangeMaxIndex !== undefined) {
          // calculate complementary value
          return formatRangeString(
            tickIndexToPrice(new BigNumber(rangeMaxIndex)),
            getSignificantDecimals(rangeMinIndex, rangeMaxIndex)
          );
        }
      }
    },
    [rangeMinIndex]
  );

  const setRangeMinFormValue = useCallback(
    (rangeMinFormValue: string) => {
      if (rangeMinFormValue !== undefined && rangeMaxIndex !== undefined) {
        // an issue here is that there is a circular dependency of:
        //   price -> tickIndex -> significantDecimals -> price -> ...
        // however it should converge quickly, and usually on the first iteration
        const intermediateTickIndex = priceToTickIndex(
          new BigNumber(rangeMinFormValue)
        ).toNumber();
        // calculate complementary value
        const price = formatRangeString(
          rangeMinFormValue,
          getSignificantDecimals(intermediateTickIndex, rangeMaxIndex)
        );

        // set range values
        _setRangeMinFormValue(rangeMinFormValue);
        _setRangeMinIndex(priceToTickIndex(new BigNumber(price)).toNumber());
      }
    },
    [rangeMaxIndex]
  );

  const setRangeMaxFormValue = useCallback(
    (rangeMaxFormValue: string) => {
      if (rangeMinIndex !== undefined && rangeMaxFormValue !== undefined) {
        // an issue here is that there is a circular dependency of:
        //   price -> tickIndex -> significantDecimals -> price -> ...
        // however it should converge quickly, and usually on the first iteration
        const intermediateTickIndex = priceToTickIndex(
          new BigNumber(rangeMaxFormValue)
        ).toNumber();
        // calculate complementary value
        const price = formatRangeString(
          rangeMaxFormValue,
          getSignificantDecimals(rangeMinIndex, intermediateTickIndex)
        );

        // set range values
        _setRangeMaxFormValue(rangeMaxFormValue);
        _setRangeMaxIndex(priceToTickIndex(new BigNumber(price)).toNumber());
      }
    },
    [rangeMinIndex]
  );

  //   const setRangeMinFormValue = useCallback<(value: React.SetStateAction<string>) => void>((rangeMinFormValueOrCallback: string | ((prevState: string) => string)) => {
  //     _setRangeMinFormValue(prevFormValue => {
  //       const rangeMinFormValue = typeof rangeMinFormValueOrCallback === 'function'
  //         ? rangeMinFormValueOrCallback(prevFormValue)
  //         : rangeMinFormValueOrCallback;
  //       const rangeMinIndex = getRangeMinIndex(rangeMinFormValue);
  //       if (rangeMinIndex !== undefined) {
  //         _setRangeMinIndex(rangeMinIndex)
  //       }
  //       return rangeMinFormValue;
  //     });

  //     function getRangeMinIndex(rangeMinFormValue: string) {
  //       if (rangeMinFormValue !== undefined && rangeMaxIndex !== undefined) {
  //         // an issue here is that there is a circular dependency of:
  //         //   price -> tickIndex -> significantDecimals -> price -> ...
  //         // however it should converge quickly, and usually on the first iteration
  //         const intermediateTickIndex = priceToTickIndex(new BigNumber(rangeMinFormValue)).toNumber();
  //         // calculate complementary value
  //         const price = formatRangeString(
  //             rangeMinFormValue,
  //             getSignificantDecimals(intermediateTickIndex, rangeMaxIndex)
  //         );
  //         return priceToTickIndex(new BigNumber(price)).toNumber();
  //       }
  //     }
  //   }, [rangeMaxIndex]);

  //   const setRangeMaxFormValue = useCallback<(value: React.SetStateAction<string>) => void>((rangeMaxFormValueOrCallback: string | ((prevState: string) => string)) => {
  //     _setRangeMaxFormValue(prevFormValue => {
  //       const rangeMaxFormValue = typeof rangeMaxFormValueOrCallback === 'function'
  //         ? rangeMaxFormValueOrCallback(prevFormValue)
  //         : rangeMaxFormValueOrCallback;
  //       const rangeMaxIndex = getRangeMaxIndex(rangeMaxFormValue);
  //       if (rangeMaxIndex !== undefined) {
  //         _setRangeMaxIndex(rangeMaxIndex)
  //       }
  //       return rangeMaxFormValue;
  //     });
  //     function getRangeMaxIndex(rangeMaxFormValue: string | undefined) {
  //       if (rangeMinIndex !== undefined && rangeMaxFormValue !== undefined) {
  //         // an issue here is that there is a circular dependency of:
  //         //   price -> tickIndex -> significantDecimals -> price -> ...
  //         // however it should converge quickly, and usually on the first iteration
  //         const intermediateTickIndex = priceToTickIndex(new BigNumber(rangeMaxFormValue)).toNumber();
  //         // calculate complementary value
  //         const price = formatRangeString(
  //           rangeMaxFormValue,
  //           getSignificantDecimals(rangeMinIndex, intermediateTickIndex)
  //         );

  //         return priceToTickIndex(new BigNumber(price)).toNumber();
  //       }
  //     }
  //     }, [rangeMinIndex]);

  return [
    [rangeMinFormValue, setRangeMinFormValue],
    [rangeMaxFormValue, setRangeMaxFormValue],
    [rangeMinIndex, setRangeMinIndex],
    [rangeMaxIndex, setRangeMaxIndex],
  ];
}

export function useSignificantDecimals(
  rangeMinIndex: number,
  rangeMaxIndex: number
) {
  return useMemo(
    () => getSignificantDecimals(rangeMinIndex, rangeMaxIndex),
    [rangeMaxIndex, rangeMinIndex]
  );
}

// find significant digits for display on the chart that makes sense
// eg. when viewing from 1-100 just 3 significant digits is fine
//     when viewing from 100-100.01 then 6 significant digits is needed
function getSignificantDecimals(rangeMinIndex: number, rangeMaxIndex: number) {
  const diff = rangeMaxIndex - rangeMinIndex;
  switch (true) {
    case diff <= 25:
      return 6;
    case diff <= 250:
      return 5;
    case diff <= 2500:
      return 4;
    default:
      return 3;
  }
}
