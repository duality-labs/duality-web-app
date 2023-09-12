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
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMagnifyingGlassPlus,
  faMagnifyingGlassMinus,
} from '@fortawesome/free-solid-svg-icons';

import { useBankBalanceBaseAmount } from '../../lib/web3/hooks/useUserBankBalances';

import SelectInput, { OptionProps } from '../../components/inputs/SelectInput';
import StepNumberInput from '../../components/StepNumberInput';
import { useNumericInputState } from '../../components/inputs/NumberInput';
import TokenInputGroup from '../../components/TokenInputGroup';
import TokenPicker from '../../components/TokenPicker/TokenPicker';
import LiquiditySelector from '../../components/LiquiditySelector';
import {
  TickGroup,
  Tick,
  getRangeIndexes,
} from '../../components/LiquiditySelector/LiquiditySelector';
import { useCurrentPriceFromTicks } from '../../components/LiquiditySelector/useCurrentPriceFromTicks';
import RadioButtonGroupInput from '../../components/RadioButtonGroupInput/RadioButtonGroupInput';
import PriceDataDisclaimer from '../../components/PriceDataDisclaimer';
import {
  MyEditedPositionTableCard,
  MyNewPositionTableCard,
} from './MyPositionTableCard';

import { useTokenPathPart } from '../../lib/web3/hooks/useTokens';
import { useDeposit } from './useDeposit';
import useFeeLiquidityMap from './useFeeLiquidityMap';

import {
  formatAmount,
  formatMaximumSignificantDecimals,
  formatPrice,
} from '../../lib/utils/number';
import { priceToTickIndex, tickIndexToPrice } from '../../lib/web3/utils/ticks';
import { FeeType, feeTypes } from '../../lib/web3/utils/fees';
import { LiquidityShape, liquidityShapes } from '../../lib/web3/utils/shape';
import {
  Token,
  getBaseDenomAmount,
  getDisplayDenomAmount,
  roundToBaseUnit,
} from '../../lib/web3/utils/tokens';

import './Pool.scss';
import RadioInput from '../../components/RadioInput';
import { PriceCardRow, PriceUSDCard } from '../../components/cards/PriceCard';
import {
  EditedPosition,
  useEditLiquidity,
} from '../MyLiquidity/useEditLiquidity';
import { guessInvertedOrder } from '../../lib/web3/utils/pairs';
import {
  usePoolDepositFilterForPair,
  useUserPositionsContext,
} from '../../lib/web3/hooks/useUserShares';
import { usePairPrice } from '../../lib/tokenPrices';

import PoolLayout from './PoolLayout';
import NumberInput from '../../components/inputs/NumberInput/NumberInput';

// the default resolution for a number in 18 decimal places
const {
  REACT_APP__MAX_FRACTION_DIGITS = '',
  REACT_APP__MAX_TICK_INDEXES = '',
} = process.env;
const maxFractionDigits = parseInt(REACT_APP__MAX_FRACTION_DIGITS) || 20;
const [
  priceMinIndex = Number.MIN_SAFE_INTEGER,
  priceMaxIndex = Number.MAX_SAFE_INTEGER,
] = REACT_APP__MAX_TICK_INDEXES.split(',').map(Number).filter(Boolean);
const priceMin = tickIndexToPrice(new BigNumber(priceMinIndex)).toNumber();
const priceMax = tickIndexToPrice(new BigNumber(priceMaxIndex)).toNumber();
const priceRangeLimits: [number, number] = [priceMin, priceMax];
const defaultFee = '0.30%';
const defaultLiquidityShape =
  liquidityShapes.find(({ value }) => value === 'normal') ?? liquidityShapes[0];

const defaultPrecision = '30';

const formatRangeString = (value: BigNumber.Value, significantDecimals = 3) => {
  return formatAmount(
    formatMaximumSignificantDecimals(value, significantDecimals),
    { minimumSignificantDigits: significantDecimals },
    { reformatSmallValues: false }
  );
};

const restrictPriceRangeValues = (
  valueString: string,
  [priceMin, priceMax]: [number, number] = priceRangeLimits
): string => {
  const value = new BigNumber(valueString);
  if (value.isLessThan(priceMin)) {
    return new BigNumber(priceMin).toFixed();
  }
  if (value.isGreaterThan(priceMax)) {
    return new BigNumber(priceMax).toFixed();
  }
  if (!value.isNaN()) {
    return valueString;
  }
  return '1';
};

// map a way to get standard user ticks from and Edited Position object
function getEditedPositionTick(
  includeTickDiff = true,
  invertedTokenOrder = false
) {
  return ({
    token0,
    token1,
    deposit,
    token0Context,
    token1Context,
    tickDiff0,
    tickDiff1,
  }: EditedPosition): Tick => {
    const maybeTickDiff0 = includeTickDiff ? tickDiff0 : new BigNumber(0);
    const maybeTickDiff1 = includeTickDiff ? tickDiff1 : new BigNumber(0);
    return {
      reserveA: !invertedTokenOrder
        ? maybeTickDiff0.plus(token0Context?.userReserves || 0)
        : maybeTickDiff1.plus(token1Context?.userReserves || 0),
      reserveB: !invertedTokenOrder
        ? maybeTickDiff1.plus(token1Context?.userReserves || 0)
        : maybeTickDiff0.plus(token0Context?.userReserves || 0),
      tickIndexBToA:
        (!invertedTokenOrder ? 1 : -1) * deposit.centerTickIndex1To0.toNumber(),
      priceBToA: tickIndexToPrice(
        !invertedTokenOrder
          ? new BigNumber(deposit.centerTickIndex1To0.toNumber())
          : new BigNumber(deposit.centerTickIndex1To0.toNumber()).negated()
      ),
      fee: deposit.fee.toNumber(),
      tokenA: !invertedTokenOrder ? token0 : token1,
      tokenB: !invertedTokenOrder ? token1 : token0,
    };
  };
}

export default function PoolManagement({
  tokenA,
  tokenB,
  setTokenA,
  setTokenB,
  setTokens,
}: {
  tokenA: Token | undefined;
  tokenB: Token | undefined;
  setTokenA: (tokenA: Token | undefined) => void;
  setTokenB: (tokenB: Token | undefined) => void;
  setTokens: ([tokenA, tokenB]: [Token?, Token?]) => void;
}) {
  const tokenAPath = useTokenPathPart(tokenA);
  const tokenBPath = useTokenPathPart(tokenB);

  const [feeType, setFeeType] = useState<FeeType | undefined>(() =>
    feeTypes.find(({ label }) => label === defaultFee)
  );
  const [inputValueA, setInputValueA, valueA = '0'] = useNumericInputState();
  const [inputValueB, setInputValueB, valueB = '0'] = useNumericInputState();
  const [lastUsedInput, setLastUsedInput] = useState<'A' | 'B'>();
  // convert input value text to correct denom values
  const values = useMemo(
    (): [string, string] => [
      (tokenA && getBaseDenomAmount(tokenA, valueA)) || '0',
      (tokenB && getBaseDenomAmount(tokenB, valueB)) || '0',
    ],
    [tokenA, tokenB, valueA, valueB]
  );

  const isValueAZero = new BigNumber(valueA).isZero();
  const isValueBZero = new BigNumber(valueB).isZero();

  const valuesValid =
    !!tokenA && !!tokenB && values.some((v) => Number(v) >= 0);

  const currentPriceFromTicks = useCurrentPriceFromTicks(
    tokenA?.address,
    tokenB?.address
  );

  const [initialPrice, setInitialPrice] = useState<string>('');
  // set price to price from ticks or user supplied value
  const edgePrice = useMemo(() => {
    if (currentPriceFromTicks) {
      return currentPriceFromTicks;
    }
    const initialPriceNumber = Number(initialPrice);
    return initialPriceNumber > 0
      ? new BigNumber(initialPriceNumber)
      : undefined;
  }, [currentPriceFromTicks, initialPrice]);

  // reset initial price whenever selected tokens are changed
  useEffect(() => {
    setInitialPrice('');
  }, [tokenA, tokenB]);

  // start with a default range of nothing, but is should be quickly set
  // after price information becomes available
  const [[fractionalRangeMin, fractionalRangeMax], setRangeUnprotected] =
    useState(['1', '1']);
  const [significantDecimals, setSignificantDecimals] = useState(3);

  const handleSetInitialPrice = useCallback(
    (price: string): void => {
      const priceNumber = Number(price);
      if (priceNumber > 0) {
        setRangeUnprotected([
          new BigNumber(priceNumber / 100).toFixed(),
          new BigNumber(priceNumber * 100).toFixed(),
        ]);
      }
      setInitialPrice(price);
    },
    [setRangeUnprotected]
  );

  const [liquidityShape, setLiquidityShape] = useState<LiquidityShape>(
    defaultLiquidityShape
  );
  const [precision, setPrecision] = useState<string>(defaultPrecision);
  // restrict precision to 2 ticks on double-sided liquidity mode
  useEffect(() => {
    setPrecision((precision) => {
      const precisionMin = !isValueAZero && !isValueBZero ? 2 : 1;
      return Number(precision) >= precisionMin ? precision : `${precisionMin}`;
    });
  }, [isValueAZero, isValueBZero]);

  const [{ isValidating: isValidatingDeposit }, sendDepositRequest] =
    useDeposit([tokenA, tokenB]);

  const [maybeUserTicks, setUserTicksUnprotected] = useState<TickGroup>([]);
  // ensure that setting of user ticks never goes outside our prescribed bounds
  const setUserTicks = useCallback<
    React.Dispatch<React.SetStateAction<TickGroup>>
  >((userTicksOrCallback) => {
    function restrictTickPrices(tick: Tick): Tick {
      const { reserveA, reserveB, priceBToA } = tick;
      // restrict values to equal to or greater than 0
      const newReserveA = reserveA.isGreaterThan(0)
        ? reserveA
        : new BigNumber(0);
      const newReserveB = reserveB.isGreaterThan(0)
        ? reserveB
        : new BigNumber(0);

      if (priceBToA.isLessThan(priceMin)) {
        const newPrice = new BigNumber(priceMin);
        return {
          ...tick,
          reserveA: newReserveA,
          reserveB: newReserveB,
          priceBToA: new BigNumber(priceMin),
          tickIndexBToA: priceToTickIndex(newPrice).toNumber(),
        };
      }
      if (priceBToA.isGreaterThan(priceMax)) {
        const newPrice = new BigNumber(priceMax);
        return {
          ...tick,
          reserveA: newReserveA,
          reserveB: newReserveB,
          priceBToA: new BigNumber(priceMax),
          tickIndexBToA: priceToTickIndex(newPrice).toNumber(),
        };
      }
      return {
        ...tick,
        reserveA: newReserveA,
        reserveB: newReserveB,
      };
    }
    if (typeof userTicksOrCallback === 'function') {
      const userTicksCallback = userTicksOrCallback;
      return setUserTicksUnprotected((userTicks) => {
        return userTicksCallback(userTicks).map(restrictTickPrices);
      });
    }
    const userTicks = userTicksOrCallback;
    setUserTicksUnprotected(userTicks.map(restrictTickPrices));
  }, []);

  // don't map out ticks if the edge price is not yet set
  const userTicks = useMemo(() => {
    if (!edgePrice) {
      return [];
    }
    return maybeUserTicks;
  }, [maybeUserTicks, edgePrice]);

  const [invertTokenOrder, setInvertTokenOrder] = useState<boolean>(() => {
    return edgePrice?.isLessThan(1) || false;
  });

  const onSubmitAddLiquidity = useCallback(
    async function (e: FormEvent<HTMLFormElement>) {
      e.preventDefault();
      if (!valuesValid) return;

      // normalize tick reserve to the values asked for
      const { reserveATotal, reserveBTotal } = userTicks.reduce(
        ({ reserveATotal, reserveBTotal }, { reserveA, reserveB }) => {
          return {
            reserveATotal: reserveATotal.plus(reserveA),
            reserveBTotal: reserveBTotal.plus(reserveB),
          };
        },
        { reserveATotal: new BigNumber(0), reserveBTotal: new BigNumber(0) }
      );
      const normalizedTicks = userTicks.map((tick) => {
        return {
          ...tick,
          ...(reserveATotal.isGreaterThan(0) && {
            reserveA: tick.reserveA
              .multipliedBy(values[0])
              .dividedBy(reserveATotal),
          }),
          ...(reserveBTotal.isGreaterThan(0) && {
            reserveB: tick.reserveB
              .multipliedBy(values[1])
              .dividedBy(reserveBTotal),
          }),
        };
      });

      if (feeType?.fee) {
        await sendDepositRequest(
          tokenA,
          tokenB,
          new BigNumber(feeType.fee),
          normalizedTicks
        );
      }
    },
    [
      values,
      valuesValid,
      tokenA,
      tokenB,
      feeType,
      userTicks,
      sendDepositRequest,
    ]
  );

  const [userTickSelected, setUserTickSelected] = useState(-1);
  useEffect(() => {
    setUserTickSelected((selected) =>
      Math.min(selected, Number(precision) - 1)
    );
  }, [precision]);

  const edgePriceIndex = useMemo(() => {
    return edgePrice && priceToTickIndex(edgePrice, 'none').toNumber();
  }, [edgePrice]);

  const [rangeMinIndex, rangeMaxIndex] = useMemo(() => {
    const fractionalRangeMinIndex = priceToTickIndex(
      new BigNumber(fractionalRangeMin),
      'none'
    ).toNumber();
    const fractionalRangeMaxIndex = priceToTickIndex(
      new BigNumber(fractionalRangeMax),
      'none'
    ).toNumber();
    return getRangeIndexes(
      edgePriceIndex,
      fractionalRangeMinIndex,
      fractionalRangeMaxIndex
    );
  }, [fractionalRangeMin, fractionalRangeMax, edgePriceIndex]);

  const formatSignificantDecimalRangeString = useCallback(
    (price: BigNumber.Value) => {
      return formatRangeString(price, significantDecimals);
    },
    [significantDecimals]
  );

  const rangeMin = useMemo<number>(
    () => tickIndexToPrice(new BigNumber(rangeMinIndex)).toNumber(),
    [rangeMinIndex]
  );
  const rangeMax = useMemo<number>(
    () => tickIndexToPrice(new BigNumber(rangeMaxIndex)).toNumber(),
    [rangeMaxIndex]
  );

  const [pairPriceMin, pairPriceMax] = useMemo<[number, number]>(() => {
    const spreadFactor = 1000;
    // expand adjustment min and max to take into account current values
    return edgePrice
      ? [
          Math.min(rangeMin, edgePrice.dividedBy(spreadFactor).toNumber()),
          Math.max(rangeMax, edgePrice.multipliedBy(spreadFactor).toNumber()),
        ]
      : [priceMin, priceMax];
  }, [edgePrice, rangeMin, rangeMax]);

  // protect price range extents
  const setRange = useCallback<
    React.Dispatch<React.SetStateAction<[string, string]>>
  >(
    (valueOrCallback) => {
      const restrictValues = ([min, max]: [string, string]): [
        string,
        string
      ] => {
        return [
          restrictPriceRangeValues(min, [pairPriceMin, pairPriceMax]),
          restrictPriceRangeValues(max, [pairPriceMin, pairPriceMax]),
        ];
      };
      if (typeof valueOrCallback === 'function') {
        const callback = valueOrCallback;
        return setRangeUnprotected((values) => {
          return restrictValues(callback(values));
        });
      }
      const value = valueOrCallback;
      setRangeUnprotected(restrictValues(value));
    },
    [pairPriceMin, pairPriceMax]
  );

  const [, setFirstCurrentPrice] = useState<{
    tokenA?: Token;
    tokenB?: Token;
    price?: number | BigNumber;
    isValueAZero?: boolean;
    isValueBZero?: boolean;
  }>({ tokenA, tokenB });
  // remove price on token change
  const lastEdgePrice = useRef<BigNumber>();
  lastEdgePrice.current = edgePrice;
  useEffect(() => {
    const edgePrice = lastEdgePrice.current;
    const setRangeForNewPriceData = (price: number | BigNumber) => {
      setRangeUnprotected([
        isValueAZero && !isValueBZero
          ? new BigNumber(price).multipliedBy(1.1).toFixed()
          : new BigNumber(price).multipliedBy(0.5).toFixed(),
        isValueBZero && !isValueAZero
          ? new BigNumber(price).multipliedBy(0.9).toFixed()
          : new BigNumber(price).multipliedBy(2).toFixed(),
      ]);
    };
    setFirstCurrentPrice((state) => {
      // if there is no currentPriceFromTicks yet, then wait until there is
      if (!edgePrice) {
        // set decent looking example range for an unknown price
        setRangeUnprotected(['0.01', '100']);
        return state;
      }
      // current tokens with maybe new price
      else if (state.tokenA === tokenA && state.tokenB === tokenB) {
        // set range on first price after switching tokens
        if (!state.price) {
          setRangeForNewPriceData(edgePrice);
        }
        return {
          price: edgePrice,
          ...state,
          isValueAZero,
          isValueBZero,
        };
      }
      // reverse of current tokens
      else if (state.tokenA === tokenB && state.tokenB === tokenA) {
        return {
          tokenA,
          tokenB,
          isValueAZero,
          isValueBZero,
          price: new BigNumber(1).dividedBy(edgePrice),
        };
      }
      // new pair
      else {
        // set range on immediately known current price
        if (edgePrice) {
          setRangeForNewPriceData(edgePrice);
        }
        return {
          tokenA,
          tokenB,
          isValueAZero,
          isValueBZero,
          price: edgePrice,
        };
      }
    });
  }, [tokenA, tokenB, isValueAZero, isValueBZero, setRangeUnprotected]);

  const swapAll = useCallback(() => {
    const flipAroundCurrentPriceSwap = (value: BigNumber.Value) => {
      // invert price
      const newValue = new BigNumber(1).dividedBy(new BigNumber(value));
      // round number to formatted string
      return formatSignificantDecimalRangeString(newValue);
    };
    setInvertTokenOrder((order) => !order);
    setRangeUnprotected([
      flipAroundCurrentPriceSwap(rangeMax),
      flipAroundCurrentPriceSwap(rangeMin),
    ]);
    setInputValueA(inputValueB);
    setInputValueB(inputValueA);
    setLastUsedInput((lastUsedInput) => {
      return lastUsedInput !== undefined
        ? lastUsedInput === 'A'
          ? 'B'
          : 'A'
        : undefined;
    });
    setTokens([tokenB, tokenA]);
    setInitialPrice((price) => {
      const priceNumber = Number(price);
      if (priceNumber > 0) {
        return formatAmount(1 / priceNumber);
      }
      return price;
    });
  }, [
    tokenA,
    tokenB,
    setTokens,
    rangeMin,
    rangeMax,
    setRangeUnprotected,
    inputValueA,
    inputValueB,
    setInputValueA,
    setInputValueB,
    setLastUsedInput,
    setInitialPrice,
    formatSignificantDecimalRangeString,
  ]);

  const [chartTypeSelected] = useState<'AMM' | 'Orderbook'>('AMM');

  // get the shape function we will use to calculate the ticks
  const shapeFunction = useMemo((): ((xPercent: number) => number) => {
    switch (liquidityShape.value) {
      case 'increasing':
        // linearly increase from -1/3 to +1/3 (or 2 to 4 before normalization)
        return (xPercent) => 2 + 2 * xPercent;
      case 'decreasing':
        // linearly decrease from +1/3 to -1/3 (or 4 to 2 before normalization)
        return (xPercent) => 4 - 2 * xPercent;
      case 'normal':
        // normal distribution curve
        return (xPercent) => {
          return (
            (1 / Math.sqrt(2 * Math.PI)) *
            Math.exp(-(1 / 2) * Math.pow((xPercent - 0.5) / 0.25, 2))
          );
        };
      case 'flat':
      default:
        // uniform
        return () => 1;
    }
  }, [liquidityShape]);

  // this is a simple calculation to doesn't really need a memo
  // its just here to group the logic
  const tickCount = useMemo(() => {
    // how many ticks did the user ask for
    const userDesiredTickCount = Number(precision) || 1;
    // how many ticks can they have?
    const possibleTickCount = rangeMaxIndex - rangeMinIndex + 1;
    // the number of ticks we will use
    return Math.min(userDesiredTickCount, possibleTickCount);
  }, [precision, rangeMaxIndex, rangeMinIndex]);

  // determine the normalized values for each tick
  const shapeUnitValueArray = useMemo(() => {
    const unitValues =
      tickCount > 1
        ? // calculate the relative value heights for each tick index
          Array.from({ length: tickCount }).map((_, index, ticks) => {
            const xPercent = index / (ticks.length - 1);
            return shapeFunction(xPercent);
          })
        : // return single point
          [1];
    const unitValuesTotal = unitValues.reduce((acc, v) => acc + v, 0) || 1;
    // return normalized shape values (values add to 1)
    return unitValues.map((value) => value / unitValuesTotal);
  }, [tickCount, shapeFunction]);

  const shapeReservesArray = useMemo((): Array<
    [tickIndex: number, reservesA: BigNumber, reservesB: BigNumber]
  > => {
    const amountA = new BigNumber(values[0] || 0);
    const amountB = new BigNumber(values[1] || 0);
    if (lastUsedInput && edgePriceIndex !== undefined) {
      // calculate the used tick indexes
      const tickIndexValues = shapeUnitValueArray.map(
        (value, index, ticks): [tickIndex: number, value: number] => {
          const xPercent = index / Math.max(1, ticks.length - 1);
          // interpolate the whole tick index nearest to the array index
          const tickIndex = Math.round(
            rangeMinIndex + xPercent * (rangeMaxIndex - rangeMinIndex)
          );
          return [tickIndex, value];
        }
      );
      // // split values into tokenA and tokenB values
      // find what mode we will be in:
      if (lastUsedInput === 'A') {
        // split values into different tokens
        const tokenUnitValues = tickIndexValues.map(([tickIndex, value]) => {
          return edgePriceIndex <= rangeMinIndex || edgePriceIndex > tickIndex
            ? [tickIndex, value, 0]
            : [tickIndex, 0, value];
        });
        // find factor to adjust by
        const totalUnitValueA =
          edgePriceIndex > rangeMinIndex
            ? tokenUnitValues.reduce((acc, [, value]) => acc + value, 0) || 1
            : 1;
        // adjust to last value given
        const adjustmentFactor = amountA.dividedBy(totalUnitValueA || 1);
        return tokenUnitValues.map(([tickIndex, valueA, valueB]) => {
          return [
            tickIndex,
            adjustmentFactor.multipliedBy(valueA),
            // convert other token reserves using equivalent value
            // totalAmount0 = amount0 + amount1 * price1To0
            adjustmentFactor
              .multipliedBy(valueB)
              .dividedBy(tickIndexToPrice(new BigNumber(edgePriceIndex))),
          ];
        });
      }
      if (lastUsedInput === 'B') {
        // split values into different tokens
        const tokenUnitValues = tickIndexValues.map(([tickIndex, value]) => {
          return edgePriceIndex >= rangeMaxIndex || edgePriceIndex < tickIndex
            ? [tickIndex, 0, value]
            : [tickIndex, value, 0];
        });
        // find factor to adjust by
        const totalUnitValueB =
          edgePriceIndex < rangeMaxIndex
            ? tokenUnitValues.reduce((acc, [, , value]) => acc + value, 0) || 1
            : 1;
        // adjust to last value given
        const adjustmentFactor = amountB.dividedBy(totalUnitValueB || 1);
        return tokenUnitValues.map(([tickIndex, valueA, valueB]) => {
          return [
            tickIndex,
            // convert other token reserves using equivalent value
            // totalAmount0 = amount0 + amount1 * price1To0
            adjustmentFactor
              .multipliedBy(valueA)
              .multipliedBy(tickIndexToPrice(new BigNumber(edgePriceIndex))),
            adjustmentFactor.multipliedBy(valueB),
          ];
        });
      }
    }
    // don't compute it an input was not touched
    return [];
  }, [
    shapeUnitValueArray,
    edgePriceIndex,
    rangeMinIndex,
    rangeMaxIndex,
    values,
    lastUsedInput,
  ]);

  // overwrite the input field for the token amount not set
  useLayoutEffect(() => {
    if (tokenA && tokenB && feeType) {
      if (lastUsedInput === 'A') {
        const amountB = shapeReservesArray
          .reduce((acc, [, , reserveB]) => acc.plus(reserveB), new BigNumber(0))
          .toFixed();
        // convert to the display units of the original token
        const displayAmountB = getDisplayDenomAmount(tokenB, amountB);
        // then transpose this complementary value to the new units
        setInputValueB(
          roundToBaseUnit(tokenB, new BigNumber(displayAmountB || 0).sd(6)) ??
            ''
        );
      } else if (lastUsedInput === 'B') {
        const amountA = shapeReservesArray.reduce(
          (acc, [, reserveA]) => acc.plus(reserveA),
          new BigNumber(0)
        );
        // convert to the display units of the original token
        const displayAmountA = getDisplayDenomAmount(tokenA, amountA);
        // then transpose this complementary value to the new units
        setInputValueA(
          roundToBaseUnit(tokenA, new BigNumber(displayAmountA || 0).sd(6)) ??
            ''
        );
      }
      // if either side is set then calculate the new user ticks
      if (lastUsedInput) {
        setUserTicks(
          shapeReservesArray.map(([tickIndex, reserveA, reserveB]) => {
            return {
              reserveA,
              reserveB,
              priceBToA: tickIndexToPrice(new BigNumber(tickIndex)),
              tickIndexBToA: tickIndex,
              fee: feeType.fee,
              tokenA,
              tokenB,
            };
          })
        );
      }
    }
  }, [
    shapeReservesArray,
    lastUsedInput,
    tokenB,
    tokenA,
    setInputValueA,
    setInputValueB,
    setUserTicks,
    feeType,
  ]);

  const { data: balanceTokenA } = useBankBalanceBaseAmount(tokenA);
  const { data: balanceTokenB } = useBankBalanceBaseAmount(tokenB);

  // compare with BigNumber to avoid float imprecision
  const hasSufficientFundsA =
    (balanceTokenA && new BigNumber(balanceTokenA).gte(values[0])) || false;
  const hasSufficientFundsB =
    (balanceTokenB && new BigNumber(balanceTokenB).gte(values[1])) || false;

  const { data: feeLiquidityMap } = useFeeLiquidityMap(
    tokenA?.address,
    tokenB?.address
  );

  const pairPoolDepositFilter = usePoolDepositFilterForPair(
    tokenA && tokenB ? [tokenA, tokenB] : ['', '']
  );
  const userPositionsContext = useUserPositionsContext(pairPoolDepositFilter);

  const [{ isValidating: isValidatingEdit }, sendEditRequest] =
    useEditLiquidity();

  const invertedTokenOrder = guessInvertedOrder(
    tokenA?.address ?? '',
    tokenB?.address ?? ''
  );

  const [[viewableMinIndex, viewableMaxIndex] = [], setViewableIndexes] =
    useState<[number, number] | undefined>();

  const [editedUserPosition, setEditedUserPosition] = useState<
    Array<EditedPosition>
  >([]);

  useEffect(() => {
    setEditedUserPosition((editedUserPosition) => {
      let isEqual = editedUserPosition.length === userPositionsContext.length;
      if (isEqual) {
        for (let i = 0; i < editedUserPosition.length; i++) {
          const deposit = editedUserPosition[i].deposit;
          const updatedDeposit = userPositionsContext[i].deposit;
          if (
            // check if the user's deposits have changed at all
            !(
              deposit.pairID.token0 === updatedDeposit.pairID.token0 &&
              deposit.pairID.token1 === updatedDeposit.pairID.token1 &&
              deposit.sharesOwned === updatedDeposit.sharesOwned &&
              deposit.lowerTickIndex1To0.equals(
                updatedDeposit.lowerTickIndex1To0
              ) &&
              deposit.centerTickIndex1To0.equals(
                updatedDeposit.centerTickIndex1To0
              ) &&
              deposit.upperTickIndex1To0.equals(
                updatedDeposit.upperTickIndex1To0
              ) &&
              deposit.fee.equals(updatedDeposit.fee)
            )
            // todo: check if the reserves have changed side
          ) {
            isEqual = false;
            break;
          }
        }
      }

      if (isEqual) {
        // merge context updates into the edited position
        return editedUserPosition.map((editedUserPosition, i) => {
          return {
            ...editedUserPosition,
            token0Context: userPositionsContext[i].token0Context,
            token1Context: userPositionsContext[i].token1Context,
          };
        });
      } else {
        // reset the position as it has changed
        return userPositionsContext.map<EditedPosition>((userPosition) => ({
          ...userPosition,
          tickDiff0: new BigNumber(0),
          tickDiff1: new BigNumber(0),
        }));
      }
    });
  }, [userPositionsContext]);

  const editedUserTicksBase = useMemo(() => {
    return userPositionsContext
      .map<EditedPosition>((userPosition) => ({
        ...userPosition,
        tickDiff0: new BigNumber(0),
        tickDiff1: new BigNumber(0),
      }))
      .map(getEditedPositionTick(true, invertedTokenOrder))
      .sort((a, b) => a.tickIndexBToA - b.tickIndexBToA);
  }, [userPositionsContext, invertedTokenOrder]);

  const editedUserTicks = useMemo(() => {
    return editedUserPosition
      .map(getEditedPositionTick(true, invertedTokenOrder))
      .sort((a, b) => a.tickIndexBToA - b.tickIndexBToA);
  }, [editedUserPosition, invertedTokenOrder]);

  const diffTokenA = useMemo(
    () =>
      editedUserPosition.reduce(
        !invertedTokenOrder
          ? (acc, shareDiff) => acc.plus(shareDiff.tickDiff0)
          : (acc, shareDiff) => acc.plus(shareDiff.tickDiff1),
        new BigNumber(0)
      ),
    [invertedTokenOrder, editedUserPosition]
  );
  const diffTokenB = useMemo(
    () =>
      editedUserPosition.reduce(
        !invertedTokenOrder
          ? (acc, shareDiff) => acc.plus(shareDiff.tickDiff1)
          : (acc, shareDiff) => acc.plus(shareDiff.tickDiff0),
        new BigNumber(0)
      ),
    [invertedTokenOrder, editedUserPosition]
  );

  // use the callback originally intender for setUserTicks
  // to instead set the diff of the editedUserPosition
  const setEditedUserTicksWithUserTicks = useCallback<
    React.Dispatch<React.SetStateAction<TickGroup>>
  >((userTicksOrCallback) => {
    return setEditedUserPosition((editedUserPosition) => {
      const userTicks = editedUserPosition.map(getEditedPositionTick());
      // get changes made to the given user ticks
      const modifiedUserTicks =
        typeof userTicksOrCallback === 'function'
          ? userTicksOrCallback(userTicks)
          : userTicksOrCallback;
      // add these changes to the
      return editedUserPosition.map((editedUserPosition, index) => {
        const userTick = userTicks[index];
        const modifiedUserTick = modifiedUserTicks[index];
        return {
          ...editedUserPosition,
          // derive diffs
          tickDiff0: modifiedUserTick.reserveA.minus(userTick.reserveA),
          tickDiff1: modifiedUserTick.reserveB.minus(userTick.reserveB),
        };
      });
    });
  }, []);

  const onSubmitEditLiquidity = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      // get relevant tick diffs
      await sendEditRequest(editedUserPosition);
    },
    [sendEditRequest, editedUserPosition]
  );
  const matchTokenManagement = useMatch('/pools/:tokenA/:tokenB/:addOrEdit');
  const addOrEdit = matchTokenManagement?.params['addOrEdit'];

  const editMode = addOrEdit === 'edit';
  const hasEdits = !diffTokenA.isZero() || !diffTokenB.isZero();

  const addLiquidityForm = (
    <form
      className={[
        'col--sidebar',
        editMode ? 'collapsed' : 'expanded',
        editMode ? 'ml-0' : 'ml-4',
      ].join(' ')}
      onSubmit={onSubmitAddLiquidity}
    >
      <fieldset
        className="page-card page-card--col"
        disabled={isValidatingDeposit}
      >
        <div className="chart-header row h4">Add Liquidity</div>
        <div className="card-row my-3">
          {tokenA ? (
            <TokenInputGroup
              className="flex"
              variant={!hasSufficientFundsA && 'error'}
              onValueChanged={(value) => {
                setInputValueA(value);
                setLastUsedInput('A');
              }}
              onTokenChanged={setTokenA}
              token={tokenA}
              value={inputValueA}
              exclusion={tokenB}
            />
          ) : (
            <TokenPicker
              className="flex button-primary p-4"
              value={tokenA}
              onChange={setTokenA}
              exclusion={tokenB}
            />
          )}
        </div>
        <div className="card-row my-3">
          {tokenB ? (
            <TokenInputGroup
              className="flex"
              variant={!hasSufficientFundsB && 'error'}
              onValueChanged={(value) => {
                setInputValueB(value);
                setLastUsedInput('B');
              }}
              onTokenChanged={setTokenB}
              token={tokenB}
              value={inputValueB}
              exclusion={tokenA}
            />
          ) : (
            <TokenPicker
              className="flex button-primary p-4"
              value={tokenB}
              onChange={setTokenB}
              exclusion={tokenA}
            />
          )}
        </div>
        <div className="row">
          <SelectInput<FeeType>
            className="col flex select-fee-tier"
            list={feeTypes}
            value={feeType}
            onChange={setFeeType}
            getLabel={(feeType) =>
              feeType ? `${feeType.label} Fee Tier` : 'Select Fee Tier'
            }
            getDescription={(feeType) =>
              !feeType ? null : (
                <>
                  <span>{feeType.description}</span>
                  <span> </span>
                  <span className="badge badge-xs">
                    {feeLiquidityMap?.[feeType.fee]
                      .multipliedBy(100)
                      .toFixed(0) ?? '0'}
                    % of Liquidity
                  </span>
                </>
              )
            }
          />
        </div>
        <div className="liquidity-shape">
          <div className="col flex">
            <h4 className="mt-2">Liquidity Shape</h4>
            <RadioInput<LiquidityShape>
              className="col flex mb-0"
              maxColumnCount={4}
              list={liquidityShapes}
              value={liquidityShape}
              onChange={setLiquidityShape}
              OptionComponent={LiquidityShapeOptionComponent}
            />
          </div>
          <StepNumberInput
            title="Number of Ticks"
            min={
              rangeMin === rangeMax ? 1 : !isValueAZero && !isValueBZero ? 2 : 1
            }
            max={rangeMin === rangeMax ? 1 : 40}
            value={rangeMin === rangeMax ? '1' : precision}
            onChange={setPrecision}
            minSignificantDigits={1}
          />
        </div>
        <div className="row gap-3">
          <div className="col flex">
            <button
              className="button button-dark submit-button text-medium mt-4 p-3"
              type="button"
              onClick={() => {
                setInputValueA('');
                setInputValueB('');
                setLastUsedInput(undefined);
              }}
              disabled={isValueAZero && isValueBZero}
            >
              Cancel
            </button>
          </div>
          <div className="col flex">
            <input
              className="button-primary text-medium mt-4 p-3"
              type="submit"
              disabled={
                (isValueAZero && isValueBZero) ||
                !hasSufficientFundsA ||
                !hasSufficientFundsB ||
                // ensure that user has agreed on an initial price if no data exists
                edgePrice === undefined
              }
              value="Confirm"
            />
          </div>
        </div>
        {(!isValueAZero || !isValueBZero) && (
          <PriceDataDisclaimer tokenA={tokenA} tokenB={tokenB} />
        )}
      </fieldset>
    </form>
  );
  const editLiquidityForm = (
    <form
      className={[
        'col--sidebar ml-auto',
        editMode ? 'expanded' : 'collapsed',
        editMode ? 'mr-4' : 'mr-0',
      ].join(' ')}
      onSubmit={onSubmitEditLiquidity}
    >
      <fieldset
        className="page-card page-card--col"
        disabled={!hasEdits || isValidatingEdit}
      >
        <div className="chart-header row h4">Edit Liquidity</div>
        <div className="col my-3">
          {editedUserPosition.map((userPosition) => {
            const [diffA, diffB] = invertTokenOrder
              ? [userPosition.tickDiff1, userPosition.tickDiff0]
              : [userPosition.tickDiff0, userPosition.tickDiff1];
            const [tokenA, tokenB] = invertTokenOrder
              ? [userPosition.token1, userPosition.token0]
              : [userPosition.token0, userPosition.token1];
            const price = formatPrice(
              tickIndexToPrice(
                new BigNumber(
                  userPosition.deposit.centerTickIndex1To0.toNumber()
                )
              ).toNumber()
            );
            const withdrawA = diffA.isLessThan(0) && (
              <div className="row">
                <div className="col">
                  Withdraw @ {price} {tokenB.symbol}/{tokenA.symbol}
                </div>
                <div className="col ml-auto">
                  {formatAmount(
                    getDisplayDenomAmount(tokenA, diffA.negated().toNumber()) ||
                      0
                  )}{' '}
                  {tokenA.symbol}
                </div>
              </div>
            );
            const withdrawB = diffB.isLessThan(0) && (
              <div className="row">
                <div className="col">
                  Withdraw @ {price} {tokenB.symbol}/{tokenA.symbol}
                </div>
                <div className="col ml-auto">
                  {formatAmount(
                    getDisplayDenomAmount(tokenB, diffB.negated().toNumber()) ||
                      0
                  )}{' '}
                  {tokenB.symbol}
                </div>
              </div>
            );
            const depositA = diffA.isGreaterThan(0) && (
              <div className="row">
                <div className="col">
                  Deposit @ {price} {tokenB.symbol}/{tokenA.symbol}
                </div>
                <div className="col ml-auto">
                  {formatAmount(
                    getDisplayDenomAmount(tokenA, diffA.toNumber()) || 0
                  )}{' '}
                  {tokenA.symbol}
                </div>
              </div>
            );
            const depositB = diffB.isGreaterThan(0) && (
              <div className="row">
                <div className="col">
                  Deposit @ {price} {tokenB.symbol}/{tokenA.symbol}
                </div>
                <div className="col ml-auto">
                  {formatAmount(
                    getDisplayDenomAmount(tokenB, diffB.toNumber()) || 0
                  )}{' '}
                  {tokenB.symbol}
                </div>
              </div>
            );
            return (
              <Fragment
                key={`${userPosition.deposit.centerTickIndex1To0}-${userPosition.deposit.fee}`}
              >
                {depositA}
                {depositB}
                {withdrawA}
                {withdrawB}
              </Fragment>
            );
          })}
        </div>
        {editedUserPosition.filter(
          (tick) => !tick.tickDiff0.isZero() || !tick.tickDiff1.isZero()
        ).length > 0 ? (
          <>
            <hr />
            <div className="col my-3">
              <div className="h4">You will receive:</div>
              {tokenA && !diffTokenA.isZero() && (
                <div className="ml-auto">
                  {formatAmount(
                    getDisplayDenomAmount(
                      tokenA,
                      diffTokenA.negated().toNumber()
                    ) || 0
                  )}{' '}
                  {tokenA.symbol}
                </div>
              )}
              {tokenB && !diffTokenB.isZero() && (
                <div className="ml-auto">
                  {formatAmount(
                    getDisplayDenomAmount(
                      tokenB,
                      diffTokenB.negated().toNumber()
                    ) || 0
                  )}{' '}
                  {tokenB.symbol}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="m-auto">No edits made</div>
        )}
        <div className="row gap-3">
          <div className="col flex">
            <button
              className="button button-dark submit-button text-medium mt-4 p-3"
              type="button"
              onClick={() => {
                setEditedUserPosition((ticks) =>
                  ticks.map((tick) => ({
                    ...tick,
                    tickDiff0: new BigNumber(0),
                    tickDiff1: new BigNumber(0),
                  }))
                );
              }}
              value="Cancel"
            >
              Cancel
            </button>
          </div>
          <div className="col flex">
            <input
              className="button-primary text-medium mt-4 p-3"
              type="submit"
              disabled={!hasSufficientFundsA || !hasSufficientFundsB}
              value="Confirm"
            />
          </div>
        </div>
      </fieldset>
    </form>
  );

  const estimatedPairPriceResponse = usePairPrice(tokenA, tokenB);
  const estimatedPairPriceString =
    estimatedPairPriceResponse.data &&
    // protect against zero and infinite price
    estimatedPairPriceResponse.data > 0 &&
    Number.isFinite(estimatedPairPriceResponse.data)
      ? formatPrice(estimatedPairPriceResponse.data, {
          maximumSignificantDigits: 5,
        })
      : '';

  return (
    <PoolLayout
      tokenA={tokenA}
      tokenB={tokenB}
      swap={swapAll}
      header={
        tokenA && tokenB && editMode ? (
          <div className="row gap-3">
            <div className="col">
              <Link to={`/portfolio/pools/${tokenAPath}/${tokenBPath}`}>
                <button className="button button-primary py-3 px-4">
                  Stake Position
                </button>
              </Link>
            </div>
            <div className="col">
              <Link to={`/pools/${tokenAPath}/${tokenBPath}/add`}>
                <button className="button button-primary py-3 px-4">
                  Add To Position
                </button>
              </Link>
            </div>
          </div>
        ) : (
          tokenA &&
          tokenB &&
          editedUserPosition &&
          editedUserPosition.length > 0 && (
            <div className="col">
              <Link to={`/pools/${tokenAPath}/${tokenBPath}/edit`}>
                <button className="button button-primary py-3 px-4">
                  Edit Position
                </button>
              </Link>
            </div>
          )
        )
      }
      disabled={!!isValidatingDeposit}
    >
      <div className="mt-3">
        <div className="col flex gap-lg">
          <div className="col row-lg gap-4 col-slide-container gutter-x-4">
            {addLiquidityForm}
            <div className="col flex gap-4">
              {tokenA && tokenB && currentPriceFromTicks === undefined && (
                <div className="page-card col">
                  <div className="h4">Select Starting Price</div>
                  <div className="panel panel-primary col my-3 gap-2">
                    <div>
                      This pool must be initialized before you can add
                      liquidity.
                    </div>
                    <div>
                      <strong>To initialize:</strong>
                      <ul className="pl-5">
                        <li>Set Starting Price</li>
                        <li>Enter Liquidity Price Range</li>
                        <li>Deposit Amount</li>
                      </ul>
                    </div>
                    <div className="text-secondary">
                      Gas fees will be higher than usual due to the
                      initialization transaction
                    </div>
                  </div>
                  <PriceCardRow className="gutter-l-4 flow-wrap flex-centered">
                    <PriceUSDCard token={tokenA} />
                    <PriceUSDCard token={tokenB} />
                    <div className="row flex-centered px-4">
                      {estimatedPairPriceString
                        ? `~${estimatedPairPriceString} ${tokenA.symbol}/${tokenB.symbol}`
                        : estimatedPairPriceResponse.isValidating
                        ? '...'
                        : ''}
                    </div>
                  </PriceCardRow>
                  <div className="row mt-2 gap-md">
                    <div className="mt-2 pt-3">
                      Starting {tokenA.symbol}/{tokenB.symbol} price
                    </div>
                    <NumberInput
                      type="text"
                      className="flex number-input--field-rounded"
                      placeholder={estimatedPairPriceString || '0'}
                      value={initialPrice}
                      onChange={handleSetInitialPrice}
                    />
                  </div>
                  <PriceDataDisclaimer tokenA={tokenA} tokenB={tokenB} />
                </div>
              )}
              <div className="page-card chart-card col row-lg gapx-lg">
                <div className="col">
                  <div className="chart-header row flow-wrap mb-4">
                    <div className="col">
                      <div className="h4">Liquidity Distribution</div>
                    </div>
                    <div className="col flex-centered ml-auto text-muted">
                      <div className="row gap-2">
                        <strong>Current Price:</strong>
                        <div className="chart-highlight">
                          {currentPriceFromTicks !== undefined
                            ? formatAmount(
                                formatMaximumSignificantDecimals(
                                  currentPriceFromTicks
                                ),
                                { useGrouping: true },
                                { reformatSmallValues: false }
                              )
                            : '-'}
                        </div>
                        {tokenA && tokenB && (
                          <div>
                            {tokenA.display.toUpperCase()} per{' '}
                            {tokenB.display.toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex row chart-area gap-3">
                    <LiquiditySelector
                      tokenA={tokenA}
                      tokenB={tokenB}
                      initialPrice={initialPrice}
                      rangeMin={fractionalRangeMin}
                      rangeMax={fractionalRangeMax}
                      setRange={setRange}
                      setSignificantDecimals={setSignificantDecimals}
                      setViewableIndexes={setViewableIndexes}
                      userTickSelected={userTickSelected}
                      setUserTickSelected={setUserTickSelected}
                      fee={feeType?.fee}
                      userTicksBase={editMode ? editedUserTicksBase : userTicks}
                      userTicks={editMode ? editedUserTicks : userTicks}
                      setUserTicks={
                        editMode
                          ? setEditedUserTicksWithUserTicks
                          : setUserTicks
                      }
                      advanced={editMode}
                      // todo: fix dragging of edit mode ticks
                      canMoveUp={!editMode}
                      canMoveDown={!editMode}
                      oneSidedLiquidity={isValueAZero || isValueBZero}
                      ControlsComponent={ChartControls}
                    ></LiquiditySelector>
                  </div>
                  <div
                    className={['price-card mt-4', editMode && 'hide']
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <div className="card-row">
                      <StepNumberInput<number>
                        title="MIN PRICE"
                        value={rangeMin}
                        onChange={(value: BigNumber.Value) => {
                          setRange(([, max]) => {
                            const newIndex = priceToTickIndex(
                              new BigNumber(value),
                              'round'
                            );
                            // place the price halfway inside the fractional index limits
                            // of the desired tick index bucket (remember these are rounded
                            // away from zero on a split-token chart) so when the user
                            // drags the limit controls we are not 1px from an index change
                            const offset =
                              edgePriceIndex !== undefined
                                ? newIndex.isGreaterThanOrEqualTo(
                                    Math.round(edgePriceIndex)
                                  )
                                  ? +0.5
                                  : -0.5
                                : 0;
                            return [
                              tickIndexToPrice(newIndex.plus(offset)).toFixed(),
                              max,
                            ];
                          });
                        }}
                        stepFunction={logarithmStep}
                        pressedDelay={500}
                        pressedInterval={100}
                        min={pairPriceMin}
                        max={rangeMax}
                        description={
                          tokenA && tokenB
                            ? `${tokenA.symbol} per ${tokenB.symbol}`
                            : 'No Tokens'
                        }
                        minSignificantDigits={(valueString: string) =>
                          Math.min(Math.max(valueString.length + 1), 8)
                        }
                        maxSignificantDigits={maxFractionDigits + 2}
                        format={formatSignificantDecimalRangeString}
                      />
                      <StepNumberInput<number>
                        title="MAX PRICE"
                        value={rangeMax}
                        onChange={(value: BigNumber.Value) => {
                          setRange(([min]) => {
                            const newIndex = priceToTickIndex(
                              new BigNumber(value),
                              'round'
                            );
                            // place the price halfway inside the fractional index limits
                            // of the desired tick index bucket (remember these are rounded
                            // away from zero on a split-token chart) so when the user
                            // drags the limit controls we are not 1px from an index change
                            const offset =
                              edgePriceIndex !== undefined
                                ? newIndex.isLessThanOrEqualTo(
                                    Math.round(edgePriceIndex)
                                  )
                                  ? -0.5
                                  : +0.5
                                : 0;
                            return [
                              min,
                              tickIndexToPrice(newIndex.plus(offset)).toFixed(),
                            ];
                          });
                        }}
                        stepFunction={logarithmStep}
                        pressedDelay={500}
                        pressedInterval={100}
                        min={rangeMin}
                        max={pairPriceMax}
                        description={
                          tokenA && tokenB
                            ? `${tokenA.symbol} per ${tokenB.symbol}`
                            : 'No Tokens'
                        }
                        minSignificantDigits={(valueString: string) =>
                          Math.min(Math.max(valueString.length + 1), 8)
                        }
                        maxSignificantDigits={maxFractionDigits + 2}
                        format={formatSignificantDecimalRangeString}
                      />
                    </div>
                  </div>
                  {chartTypeSelected === 'Orderbook' && (
                    <div className="mt-4 p-4 orderbook-card">
                      <RadioButtonGroupInput<number>
                        className="mx-auto mt-2 mb-4"
                        buttonClassName="py-3 px-4"
                        values={(() => {
                          const map = new Map<number, ReactNode>();
                          map.set(-1, 'All');
                          if (rangeMin === rangeMax) {
                            map.set(0, 1);
                            return map;
                          }
                          for (
                            let index = 0;
                            index < Number(precision);
                            index++
                          ) {
                            map.set(index, index + 1);
                          }
                          return map;
                        })()}
                        value={userTickSelected}
                        onChange={(tickSelectedString) => {
                          setUserTickSelected(tickSelectedString);
                        }}
                      />
                      <div className="row">
                        <div className="col">
                          {!userTicks[userTickSelected] ? (
                            <div className="row precision-card">
                              <h3 className="card-title mr-auto">
                                Number of Ticks
                              </h3>
                              <StepNumberInput
                                editable={false}
                                min={
                                  rangeMin === rangeMax
                                    ? 1
                                    : !isValueAZero && !isValueBZero
                                    ? 2
                                    : 1
                                }
                                max={rangeMin === rangeMax ? 1 : 10}
                                value={rangeMin === rangeMax ? '1' : precision}
                                onChange={setPrecision}
                                minSignificantDigits={1}
                              />
                              <button
                                type="button"
                                className="button-info ml-2"
                                onClick={() => setPrecision(defaultPrecision)}
                              >
                                Auto
                              </button>
                            </div>
                          ) : (
                            <div className="row tick-price-card">
                              <h3 className="card-title mr-auto">Price</h3>
                              <StepNumberInput
                                key={userTickSelected}
                                min={priceMin}
                                max={priceMax}
                                pressedDelay={500}
                                pressedInterval={100}
                                stepFunction={logarithmStep}
                                value={userTicks[
                                  userTickSelected
                                ].priceBToA.toNumber()}
                                onChange={(value) => {
                                  setUserTicks((userTicks) => {
                                    // skip non-update
                                    const newValue = new BigNumber(value);
                                    if (
                                      userTicks[
                                        userTickSelected
                                      ].priceBToA.isEqualTo(newValue)
                                    )
                                      return userTicks;
                                    // replace singular tick price
                                    return userTicks.map(
                                      (userTick, index): Tick => {
                                        return index === userTickSelected
                                          ? {
                                              ...userTick,
                                              priceBToA: newValue,
                                              tickIndexBToA:
                                                priceToTickIndex(
                                                  newValue
                                                ).toNumber(),
                                            }
                                          : userTick;
                                      }
                                    );
                                  });
                                }}
                                maxSignificantDigits={maxFractionDigits + 1}
                                format={formatSignificantDecimalRangeString}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {editLiquidityForm}
          </div>
          <div className="col col--left gap-4">
            {tokenA && tokenB && editMode ? (
              <MyEditedPositionTableCard
                tokenA={tokenA}
                tokenB={tokenB}
                editedUserPosition={editedUserPosition}
                setEditedUserPosition={setEditedUserPosition}
                viewableMinIndex={viewableMinIndex}
                viewableMaxIndex={viewableMaxIndex}
              />
            ) : (
              <MyNewPositionTableCard
                tokenA={tokenA}
                tokenB={tokenB}
                userTicks={userTicks}
              />
            )}
          </div>
        </div>
      </div>
    </PoolLayout>
  );
}

function ChartControls({
  zoomIn,
  zoomOut,
}: {
  zoomIn?: () => void;
  zoomOut?: () => void;
}) {
  return (
    <div className="row chart-zoom-controls flow-wrap gap-2">
      <button
        type="button"
        className="col flex-centered"
        disabled={!zoomIn}
        onClick={zoomIn}
      >
        <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
      </button>
      <button
        type="button"
        className="col flex-centered"
        disabled={!zoomOut}
        onClick={zoomOut}
      >
        <FontAwesomeIcon icon={faMagnifyingGlassMinus} />
      </button>
    </div>
  );
}

function LiquidityShapeOptionComponent({
  option: { icon, label },
}: OptionProps<LiquidityShape>) {
  return (
    <div className="col flex flex-centered mt-1 pt-3">
      <img src={icon} alt={label} height={36} />
      <div className="my-2">{label}</div>
    </div>
  );
}

// calculates set from last digit (eg. 0.98 -> 0.99 -> 1.0 -> 1.1)
// while respecting significant digits expectation
function logarithmStep(
  valueNumber: number,
  direction: number,
  valueString: string
): number {
  const value = new BigNumber(valueString);
  const significantDigits = value.sd(false);
  const trailingZeros =
    valueString.length - valueString.replace(/0*(.?)0+$/g, '$1').length;
  const orderOfMagnitude = Math.floor(Math.log10(value.toNumber()));
  // find order of magnitude of last digit to use as basis of add/sub value
  const orderOfMagnitudeLastDigit =
    orderOfMagnitude - significantDigits - trailingZeros + 1;

  // add or remove values
  if (direction !== 0) {
    // if adding to value
    if (direction > 0) {
      const nextStep = value.plus(
        new BigNumber(10).exponentiatedBy(orderOfMagnitudeLastDigit)
      );
      // go to the next index value if it is further away than this new value
      // otherwise the nextStep value may get rounded back down and not change
      const nextIndexStep = tickIndexToPrice(
        priceToTickIndex(value, 'round').plus(1)
      );
      return BigNumber.max(nextStep, nextIndexStep).toNumber();
    }
    // if subtracting from value
    else {
      const nextStep = value.minus(
        new BigNumber(10).exponentiatedBy(
          // reduce the order of magnitude of the value if going from a singular '1'
          // eg. 1 -> 0.9,  0.1 -> 0.09,  0.01 -> 0.009
          // so that the user doesn't go to 0 on a logarithmic scale
          orderOfMagnitudeLastDigit +
            (significantDigits === 1 && !!valueString.match(/1/) ? -1 : 0)
        )
      );
      // go to the next index value if it is further away than this new value
      // otherwise the nextStep value may get rounded back down and not change
      const nextIndexStep = tickIndexToPrice(
        priceToTickIndex(value, 'round').minus(1)
      );
      return BigNumber.min(nextStep, nextIndexStep).toNumber();
    }
  }
  return valueNumber;
}
