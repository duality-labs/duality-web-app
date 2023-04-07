import {
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
  FormEvent,
  ReactNode,
  useMemo,
} from 'react';
import { Link } from 'react-router-dom';
import BigNumber from 'bignumber.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus,
  faArrowRightArrowLeft,
  faMagnifyingGlassPlus,
  faMagnifyingGlassMinus,
} from '@fortawesome/free-solid-svg-icons';

import {
  getBalance,
  getPairID,
  useBankBalances,
} from '../../lib/web3/indexerProvider';

import SelectInput, { OptionProps } from '../../components/inputs/SelectInput';
import StepNumberInput from '../../components/StepNumberInput';
import { useNumericInputState } from '../../components/inputs/NumberInput';
import TokenInputGroup from '../../components/TokenInputGroup';
import LiquiditySelector from '../../components/LiquiditySelector';
import {
  TickGroup,
  Tick,
  getRangeIndexes,
} from '../../components/LiquiditySelector/LiquiditySelector';
import { useCurrentPriceFromTicks } from '../../components/LiquiditySelector/useCurrentPriceFromTicks';
import RadioButtonGroupInput from '../../components/RadioButtonGroupInput/RadioButtonGroupInput';
import PriceDataDisclaimer from '../../components/PriceDataDisclaimer';
import PoolsTableCard from '../../components/cards/PoolsTableCard';

import useTokens from '../../lib/web3/hooks/useTokens';
import { useDeposit } from './useDeposit';
import useFeeLiquidityMap from './useFeeLiquidityMap';

import {
  formatAmount,
  formatMaximumSignificantDecimals,
} from '../../lib/utils/number';
import { priceToTickIndex, tickIndexToPrice } from '../../lib/web3/utils/ticks';
import { FeeType, feeTypes } from '../../lib/web3/utils/fees';
import { LiquidityShape, liquidityShapes } from '../../lib/web3/utils/shape';
import { Token } from '../../lib/web3/utils/tokens';

import './Pool.scss';
import TokenPairLogos from '../../components/TokenPairLogos';
import RadioInput from '../../components/RadioInput';
import useShareValueMap from '../MyLiquidity/useShareValueMap';

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
  liquidityShapes.find(({ value }) => value === 'flat') ?? liquidityShapes[0];

const defaultPrecision = '6';

const formatRangeString = (value: BigNumber.Value, significantDecimals = 3) => {
  return formatAmount(
    formatMaximumSignificantDecimals(value, significantDecimals),
    { minimumSignificantDigits: significantDecimals }
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

export default function PoolPage() {
  return (
    <div className="container row flex py-5">
      <div className="page col flex">
        <Pool />
      </div>
    </div>
  );
}

function Pool() {
  const [tokenA, setTokenA] = useState(undefined as Token | undefined);
  const [tokenB, setTokenB] = useState(undefined as Token | undefined);
  const [feeType, setFeeType] = useState<FeeType | undefined>(() =>
    feeTypes.find(({ label }) => label === defaultFee)
  );
  const tokenList = useTokens();

  // set token A to be first token in list if not already populated
  useEffect(() => {
    if (tokenList.length > 0 && !tokenA) {
      setTokenA(tokenList.find((token) => token.symbol === 'TKN'));
    }
  }, [tokenA, tokenList]);
  // set token B to be USDC token in list if not already populated
  useEffect(() => {
    const USDC = tokenList?.find((token) => token.symbol === 'STK');
    if (USDC && !tokenB) {
      setTokenB(USDC);
    }
  }, [tokenB, tokenList]);

  const [inputValueA, setInputValueA, valueA = '0'] = useNumericInputState();
  const [inputValueB, setInputValueB, valueB = '0'] = useNumericInputState();
  const values = useMemo(
    (): [string, string] => [valueA, valueB],
    [valueA, valueB]
  );

  const isValueAZero = new BigNumber(valueA).isZero();
  const isValueBZero = new BigNumber(valueB).isZero();

  const [valuesConfirmed, setValuesConfirmed] = useState(false);
  const valuesValid =
    !!tokenA && !!tokenB && values.some((v) => Number(v) >= 0);

  const currentPriceFromTicks = useCurrentPriceFromTicks(
    tokenA?.address,
    tokenB?.address
  );

  const edgePrice = currentPriceFromTicks;

  // start with a default range of nothing, but is should be quickly set
  // after price information becomes available
  const [fractionalRangeMin, setRangeMinUnprotected] = useState('1');
  const [fractionalRangeMax, setRangeMaxUnprotected] = useState('1');
  const [significantDecimals, setSignificantDecimals] = useState(3);

  const [pairPriceMin, pairPriceMax] = useMemo<[number, number]>(() => {
    const spreadFactor = 1000;
    return edgePrice
      ? [
          edgePrice.dividedBy(spreadFactor).toNumber(),
          edgePrice.multipliedBy(spreadFactor).toNumber(),
        ]
      : [priceMin, priceMax];
  }, [edgePrice]);
  // protect price range extents
  const setRangeMin = useCallback<React.Dispatch<React.SetStateAction<string>>>(
    (valueOrCallback) => {
      const restrictValue = (value: string) => {
        return restrictPriceRangeValues(value, [pairPriceMin, pairPriceMax]);
      };
      if (typeof valueOrCallback === 'function') {
        const callback = valueOrCallback;
        return setRangeMinUnprotected((value) => {
          return restrictValue(callback(value));
        });
      }
      const value = valueOrCallback;
      setRangeMinUnprotected(restrictValue(value));
    },
    [pairPriceMin, pairPriceMax]
  );
  const setRangeMax = useCallback<React.Dispatch<React.SetStateAction<string>>>(
    (valueOrCallback) => {
      const restrictValue = (value: string) => {
        return restrictPriceRangeValues(value, [pairPriceMin, pairPriceMax]);
      };
      if (typeof valueOrCallback === 'function') {
        const callback = valueOrCallback;
        return setRangeMaxUnprotected((value) => {
          return restrictValue(callback(value));
        });
      }
      const value = valueOrCallback;
      setRangeMaxUnprotected(restrictValue(value));
    },
    [pairPriceMin, pairPriceMax]
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

  const [userTicks, setUserTicksUnprotected] = useState<TickGroup>([]);
  // ensure that setting of user ticks never goes outside our prescribed bounds
  const setUserTicks = useCallback<
    React.Dispatch<React.SetStateAction<TickGroup>>
  >((userTicksOrCallback) => {
    function restrictTickPrices(tick: Tick): Tick {
      const { reserveA, reserveB, price } = tick;
      // restrict values to equal to or greater than 0
      const newReserveA = reserveA.isGreaterThan(0)
        ? reserveA
        : new BigNumber(0);
      const newReserveB = reserveB.isGreaterThan(0)
        ? reserveB
        : new BigNumber(0);

      if (price.isLessThan(priceMin)) {
        const newPrice = new BigNumber(priceMin);
        return {
          ...tick,
          reserveA: newReserveA,
          reserveB: newReserveB,
          price: new BigNumber(priceMin),
          tickIndex: priceToTickIndex(newPrice).toNumber(),
        };
      }
      if (price.isGreaterThan(priceMax)) {
        const newPrice = new BigNumber(priceMax);
        return {
          ...tick,
          reserveA: newReserveA,
          reserveB: newReserveB,
          price: new BigNumber(priceMax),
          tickIndex: priceToTickIndex(newPrice).toNumber(),
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

  const [invertTokenOrder, setInvertTokenOrder] = useState<boolean>(() => {
    return edgePrice?.isLessThan(1) || false;
  });

  const [, setFirstCurrentPrice] = useState<{
    tokenA?: Token;
    tokenB?: Token;
    price?: number | BigNumber;
    isValueAZero?: boolean;
    isValueBZero?: boolean;
  }>({ tokenA, tokenB });
  // remove price on token change
  useEffect(() => {
    const setRangeForNewPriceData = (price: number | BigNumber) => {
      setRangeMin(
        isValueAZero && !isValueBZero
          ? new BigNumber(price).multipliedBy(1.1).toFixed()
          : new BigNumber(price).multipliedBy(0.5).toFixed()
      );
      setRangeMax(
        isValueBZero && !isValueAZero
          ? new BigNumber(price).multipliedBy(0.9).toFixed()
          : new BigNumber(price).multipliedBy(2).toFixed()
      );
    };
    setFirstCurrentPrice((state) => {
      // if there is no currentPriceFromTicks yet, then wait until there is
      if (!edgePrice) {
        // set decent looking example range for an unknown price
        setRangeMin('0.01');
        setRangeMax('100');
        return state;
      }
      // current tokens with maybe new price
      else if (state.tokenA === tokenA && state.tokenB === tokenB) {
        // set range on first price after switching tokens
        if (
          !state.price ||
          state.isValueAZero !== isValueAZero ||
          state.isValueBZero !== isValueBZero
        ) {
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
  }, [
    tokenA,
    tokenB,
    isValueAZero,
    isValueBZero,
    edgePrice,
    setRangeMin,
    setRangeMax,
  ]);

  const onSubmit = useCallback(
    async function (e: FormEvent<HTMLFormElement>) {
      e.preventDefault();
      if (!valuesValid) return;
      const submitValue =
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        ((e.nativeEvent as any)?.submitter as HTMLInputElement).value;
      if (submitValue.toLowerCase() === 'customize') {
        return setValuesConfirmed(true);
      }

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

  const swapAll = useCallback(() => {
    const flipAroundCurrentPriceSwap = (value: BigNumber.Value) => {
      // invert price
      const newValue = new BigNumber(1).dividedBy(new BigNumber(value));
      // round number to formatted string
      return formatSignificantDecimalRangeString(newValue);
    };
    setInvertTokenOrder((order) => !order);
    setRangeMin(() => flipAroundCurrentPriceSwap(rangeMax));
    setRangeMax(() => flipAroundCurrentPriceSwap(rangeMin));
    setInputValueA(inputValueB);
    setInputValueB(inputValueA);
    setTokenA(tokenB);
    setTokenB(tokenA);
  }, [
    tokenA,
    tokenB,
    rangeMin,
    rangeMax,
    setRangeMin,
    setRangeMax,
    inputValueA,
    inputValueB,
    setInputValueA,
    setInputValueB,
    formatSignificantDecimalRangeString,
  ]);

  const [chartTypeSelected] = useState<'AMM' | 'Orderbook'>('AMM');

  // todo: this effect should be replaced with a better calculation for ticks
  const tickCount = Number(precision || 1);
  useLayoutEffect(() => {
    function getUserTicks(): TickGroup {
      const indexMin = rangeMinIndex;
      const indexMax = rangeMaxIndex;
      // set multiple ticks across the range
      const fee = feeType?.fee;
      if (
        tokenA &&
        tokenB &&
        tickCount > 1 &&
        indexMin !== undefined &&
        indexMax !== undefined &&
        indexMax >= indexMin &&
        fee !== undefined
      ) {
        const tokenAmountA = new BigNumber(values[0]);
        const tokenAmountB = new BigNumber(values[1]);

        // space new ticks linearly across tick (which is exponentially across price)
        const tickCounts: [number, number] = [0, 0];
        // space ticks across unique tick indexes
        const tickPrices = Array.from({ length: tickCount })
          .reduce<number[]>((result, _, index) => {
            const tickIndex = Math.round(
              indexMin +
                (index * (indexMax - indexMin)) / Math.max(1, tickCount - 1)
            );
            // add index only if it is unique
            return !result.includes(tickIndex)
              ? [...result, tickIndex]
              : result;
          }, [])
          .map<Tick>((tickIndex, index, tickIndexes) => {
            const price = tickIndexToPrice(new BigNumber(tickIndex));

            // choose whether token A or B should be added for the tick at this price
            const invertToken =
              isValueAZero || isValueBZero
                ? // enforce singe-sided liquidity has single ticks
                  isValueBZero
                : // for double-sided liquidity split the ticks somewhere
                edgePrice
                ? // split the ticks at the current price if it exists
                  price.isLessThan(edgePrice)
                : // split the ticks by index if no price exists yet
                  index < tickIndexes.length / 2;
            // add to count
            tickCounts[invertToken ? 0 : 1] += 1;
            return {
              reserveA: new BigNumber(invertToken ? 1 : 0),
              reserveB: new BigNumber(invertToken ? 0 : 1),
              price: price,
              tickIndex: tickIndex,
              fee: fee,
              tokenA: tokenA,
              tokenB: tokenB,
            };
          });

        const shapeFactor = (() => {
          return (() => {
            switch (liquidityShape.value) {
              case 'increasing':
                return tickPrices.map((_, index, tickPrices) => {
                  const percent = index / (tickPrices.length - 1);
                  return 1 + percent;
                });
              case 'normal':
                return tickPrices.map((_, index, tickPrices) => {
                  const percent = index / (tickPrices.length - 1);
                  return (
                    (1 / Math.sqrt(2 * Math.PI)) *
                    Math.exp(-(1 / 2) * Math.pow((percent - 0.5) / 0.25, 2))
                  );
                });
              case 'decreasing':
                return tickPrices.map((_, index, tickPrices) => {
                  const percent = 1 - index / (tickPrices.length - 1);
                  return 1 + percent;
                });
              case 'flat':
              default:
                return tickPrices.map(() => 1);
            }
          })();
        })();

        // normalise the tick amounts given
        return tickPrices.map((tick, index) => {
          return {
            ...tick,
            reserveA: tickCounts[0]
              ? tokenAmountA
                  .multipliedBy(shapeFactor[index])
                  .multipliedBy(tick.reserveA)
              : new BigNumber(0),
            reserveB: tickCounts[1]
              ? tokenAmountB
                  .multipliedBy(shapeFactor[index])
                  .multipliedBy(tick.reserveB)
              : new BigNumber(0),
          };
        });
      }
      // set 1 tick in the middle of the range given
      else if (
        tokenA &&
        tokenB &&
        indexMin !== undefined &&
        indexMax !== undefined &&
        indexMin === indexMax &&
        feeType &&
        fee !== undefined
      ) {
        const tickIndex = Math.round((indexMin + indexMax) / 2);
        const price = tickIndexToPrice(new BigNumber(tickIndex));
        return [
          {
            reserveA: new BigNumber(!isValueAZero ? 1 : 0),
            reserveB: new BigNumber(!isValueBZero ? 1 : 0),
            price: price,
            tickIndex: tickIndex,
            fee: fee,
            tokenA: tokenA,
            tokenB: tokenB,
          },
        ];
      }
      // or set no ticks
      else {
        return [];
      }
    }

    setUserTicks?.((userTicks) => {
      const newUserTicks = getUserTicks();

      // check if number of ticks are equal or value in ticks are equal
      if (
        userTicks.length !== newUserTicks.length ||
        !newUserTicks.every((newUserTick, ticksIndex) => {
          const userTick = userTicks[ticksIndex];
          return (
            newUserTick.fee === userTick.fee &&
            newUserTick.tickIndex === userTick.tickIndex &&
            newUserTick.reserveA.isEqualTo(userTick.reserveA) &&
            newUserTick.reserveB.isEqualTo(userTick.reserveB)
          );
        })
      ) {
        // return changed values
        return newUserTicks;
      } else {
        // return same values
        return userTicks;
      }
    });
  }, [
    values,
    isValueAZero,
    isValueBZero,
    feeType,
    tokenA,
    tokenB,
    liquidityShape,
    rangeMinIndex,
    rangeMaxIndex,
    tickCount,
    edgePrice,
    invertTokenOrder,
    setUserTicks,
  ]);

  const { data: balances } = useBankBalances();
  const balanceTokenA =
    tokenA && balances && new BigNumber(getBalance(tokenA, balances));
  const balanceTokenB =
    tokenB && balances && new BigNumber(getBalance(tokenB, balances));

  const hasSufficientFundsA =
    balanceTokenA?.isGreaterThanOrEqualTo(values[0] || 0) || false;
  const hasSufficientFundsB =
    balanceTokenB?.isGreaterThanOrEqualTo(values[1] || 0) || false;

  const { data: feeLiquidityMap } = useFeeLiquidityMap(
    tokenA?.address,
    tokenB?.address
  );

  const [newReserveATotal, newReserveBTotal] = useMemo(() => {
    return [
      userTicks.reduce(
        (acc, tick) => acc.plus(tick.reserveA),
        new BigNumber(0)
      ),
      userTicks.reduce(
        (acc, tick) => acc.plus(tick.reserveB),
        new BigNumber(0)
      ),
    ];
  }, [userTicks]);

  const [selectedPoolsList, setSelectedPoolsList] = useState<'all' | 'mine'>(
    'all'
  );

  const confirmButton = (
    <input
      className="button-primary text-medium mt-4 p-3"
      type="submit"
      disabled={
        (isValueAZero && isValueBZero) ||
        !hasSufficientFundsA ||
        !hasSufficientFundsB
      }
      value="Confirm"
    />
  );

  const userShareValueMap = useShareValueMap();
  const forward =
    userShareValueMap?.[
      getPairID(tokenA?.address || '', tokenB?.address || '')
    ];
  const reverse =
    userShareValueMap?.[
      getPairID(tokenB?.address || '', tokenA?.address || '')
    ];
  const userShareValues = forward || reverse;

  const [userReserveATotal, userReserveBTotal] = useMemo(() => {
    const token0Reserves = userShareValues?.reduce(
      (acc, { userReserves0 }) => acc.plus(userReserves0),
      new BigNumber(0)
    );
    const token1Reserves = userShareValues?.reduce(
      (acc, { userReserves1 }) => acc.plus(userReserves1),
      new BigNumber(0)
    );
    return forward
      ? [token0Reserves, token1Reserves]
      : [token1Reserves, token0Reserves];
  }, [userShareValues, forward]);

  const editMode = false;

  if (!tokenA || !tokenB || !valuesConfirmed) {
    return (
      <form
        className={[
          'pool-page m-auto row flex-centered flow-wrap gap-5',
          isValidatingDeposit && 'disabled',
        ]
          .filter(Boolean)
          .join(' ')}
        onSubmit={onSubmit}
      >
        <PoolsTableCard
          className="flex flex-auto"
          title="Pairs"
          switchValue={selectedPoolsList}
          switchOnChange={setSelectedPoolsList}
          onTokenPairClick={([token0, token1]) => {
            setTokenA(token0);
            setTokenB(token1);
          }}
        />
        <div className="assets-card page-card">
          <h3 className="card-title mb-4">Add Liquidity</h3>
          <div className="mb-4">
            <p>
              Add liquidity in any ratio to earn fees on
              <br /> other people’s trades! Learn more{' '}
              <Link to="/liquidity">here</Link>.
            </p>
          </div>
          <div className="card-row">
            <TokenInputGroup
              variant={tokenA && !hasSufficientFundsA && 'error'}
              onValueChanged={setInputValueA}
              onTokenChanged={setTokenA}
              tokenList={tokenList}
              token={tokenA}
              value={inputValueA}
              exclusion={tokenB}
            />
          </div>
          <div className="plus-space mx-auto my-4">
            <FontAwesomeIcon icon={faPlus}></FontAwesomeIcon>
          </div>
          <div className="card-row">
            <TokenInputGroup
              variant={tokenB && !hasSufficientFundsB && 'error'}
              onValueChanged={setInputValueB}
              onTokenChanged={setTokenB}
              tokenList={tokenList}
              token={tokenB}
              value={inputValueB}
              exclusion={tokenA}
            />
          </div>
          <div className="row flex-centered mt-5 gapx-5">
            <div className="col flex">
              <input
                className="button-primary text-medium pill-outline px-4 py-4"
                disabled={
                  !valuesValid || !hasSufficientFundsA || !hasSufficientFundsB
                }
                type="submit"
                name="action"
                value="Customize"
              />
            </div>
            <div className="col flex">
              <input
                className="button-primary text-medium px-4 py-4"
                disabled={
                  (isValueAZero && isValueBZero) ||
                  !hasSufficientFundsA ||
                  !hasSufficientFundsB
                }
                type="submit"
                name="action"
                value="Add Liquidity"
              />
            </div>
          </div>
          <PriceDataDisclaimer tokenA={tokenA} tokenB={tokenB} />
        </div>
      </form>
    );
  }

  return (
    <form
      className={[isValidatingDeposit && 'disabled'].filter(Boolean).join(' ')}
      onSubmit={onSubmit}
    >
      <div className="pool-page">
        <div className="row gap-4">
          <div className="col flex gap-4">
            <div
              className={`chart-card col chart-type--${chartTypeSelected.toLowerCase()}`}
            >
              <div className="chart-header row flow-wrap">
                <div className="col">
                  <div className="chart-header row my-4">
                    <TokenPairLogos
                      className="h3"
                      tokenA={tokenA}
                      tokenB={tokenB}
                    />
                    <h2 className="h3">
                      {tokenA.symbol} {tokenB.symbol} Pool
                    </h2>
                    <button
                      type="button"
                      className="ml-auto icon-button"
                      onClick={swapAll}
                    >
                      <FontAwesomeIcon
                        icon={faArrowRightArrowLeft}
                      ></FontAwesomeIcon>
                    </button>
                  </div>
                </div>
              </div>
              <hr className="mt-3 mb-4" />
              <div className="flex col row-lg gapx-lg">
                <div className="flex col col--right">
                  <div className="chart-header row flow-wrap my-4">
                    <div className="col">
                      <h3 className="h3">Liquidity Distribution</h3>
                    </div>
                    <div className="col flex-centered ml-auto text-muted">
                      <div className="row gap-2">
                        <strong>Current Price:</strong>
                        <div className="chart-highlight">
                          {currentPriceFromTicks?.toFixed(5) ?? '-'}
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
                      rangeMin={fractionalRangeMin}
                      rangeMax={fractionalRangeMax}
                      setRangeMin={setRangeMin}
                      setRangeMax={setRangeMax}
                      setSignificantDecimals={setSignificantDecimals}
                      userTickSelected={userTickSelected}
                      setUserTickSelected={setUserTickSelected}
                      feeTier={feeType?.fee}
                      userTicks={userTicks}
                      setUserTicks={setUserTicks}
                      advanced={chartTypeSelected === 'Orderbook'}
                      canMoveUp
                      canMoveDown
                      canMoveX
                      oneSidedLiquidity={isValueAZero || isValueBZero}
                      ControlsComponent={ChartControls}
                    ></LiquiditySelector>
                  </div>
                  <div className="price-card mt-4">
                    <div className="card-row">
                      <StepNumberInput<number>
                        title="MIN PRICE"
                        value={rangeMin}
                        onChange={(value: BigNumber.Value) => {
                          setRangeMin(() => {
                            const newIndex = priceToTickIndex(
                              new BigNumber(value),
                              'round'
                            );
                            // place the price halfway inside the fractional index limits
                            // of the desired tick index bucket (remember these are rounded
                            // away from zero on a split-token chart) so when the user
                            // drags the limit controls we are not 1px from an index change
                            if (edgePriceIndex !== undefined) {
                              const offset = newIndex.isGreaterThanOrEqualTo(
                                Math.round(edgePriceIndex)
                              )
                                ? +0.5
                                : -0.5;
                              return tickIndexToPrice(
                                newIndex.plus(offset)
                              ).toFixed();
                            }
                            return tickIndexToPrice(newIndex).toFixed();
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
                          setRangeMax(() => {
                            const newIndex = priceToTickIndex(
                              new BigNumber(value),
                              'round'
                            );
                            // place the price halfway inside the fractional index limits
                            // of the desired tick index bucket (remember these are rounded
                            // away from zero on a split-token chart) so when the user
                            // drags the limit controls we are not 1px from an index change
                            if (edgePriceIndex !== undefined) {
                              const offset = newIndex.isLessThanOrEqualTo(
                                Math.round(edgePriceIndex)
                              )
                                ? -0.5
                                : +0.5;
                              return tickIndexToPrice(
                                newIndex.plus(offset)
                              ).toFixed();
                            }
                            return tickIndexToPrice(newIndex).toFixed();
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
                                ].price.toNumber()}
                                onChange={(value) => {
                                  setUserTicks((userTicks) => {
                                    // skip non-update
                                    const newValue = new BigNumber(value);
                                    if (
                                      userTicks[
                                        userTickSelected
                                      ].price.isEqualTo(newValue)
                                    )
                                      return userTicks;
                                    // replace singular tick price
                                    return userTicks.map((userTick, index) => {
                                      return index === userTickSelected
                                        ? {
                                            ...userTick,
                                            price: newValue,
                                            tickIndex:
                                              priceToTickIndex(
                                                newValue
                                              ).toNumber(),
                                          }
                                        : userTick;
                                    });
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
                <div className="col pt-lg col-lg-hide">{confirmButton}</div>
              </div>
            </div>
            <div className="page-card">
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '7.5%' }}></th>
                    <th style={{ width: '20%' }}>Price</th>
                    <th style={{ width: '20%' }}>Percent</th>
                    <th style={{ width: '20%' }}>
                      {tokenA.display.toUpperCase()}
                    </th>
                    <th style={{ width: '20%' }}>
                      {tokenB.display.toUpperCase()}
                    </th>
                    {!(isValueAZero && isValueBZero) && (
                      <th style={{ width: '12.5%' }}>Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {isValueAZero && isValueBZero ? (
                    userShareValues ? (
                      userShareValues
                        // sort by price
                        .sort((a, b) => {
                          return tickIndexToPrice(
                            forward
                              ? new BigNumber(a.share.tickIndex)
                              : new BigNumber(a.share.tickIndex).negated()
                          )
                            .minus(
                              tickIndexToPrice(
                                forward
                                  ? new BigNumber(b.share.tickIndex)
                                  : new BigNumber(b.share.tickIndex).negated()
                              )
                            )
                            .toNumber();
                        })
                        .map(
                          (
                            {
                              share,
                              token0,
                              token1,
                              userReserves0,
                              userReserves1,
                            },
                            index
                          ) => {
                            // const tokenA = forward ? token0 : token1;
                            // const tokenB = forward ? token1 : token0;
                            const reserveA = forward
                              ? userReserves0
                              : userReserves1;
                            const reserveB = forward
                              ? userReserves1
                              : userReserves0;
                            const price = tickIndexToPrice(
                              forward
                                ? new BigNumber(share.tickIndex)
                                : new BigNumber(share.tickIndex).negated()
                            );
                            return price.isGreaterThanOrEqualTo(rangeMin) &&
                              price.isLessThanOrEqualTo(rangeMax) ? (
                              <tr key={index} className="pt-2">
                                <td>{index + 1}</td>
                                <td>
                                  {new BigNumber(price.toFixed(5)).toFixed(5)}
                                </td>
                                <td>
                                  {userReserveATotal &&
                                  reserveA.isGreaterThan(1e-5)
                                    ? `${
                                        userReserveATotal.isGreaterThan(0)
                                          ? new BigNumber(
                                              reserveA
                                                .multipliedBy(100)
                                                .dividedBy(userReserveATotal)
                                            ).toFixed(1)
                                          : 0
                                      }%`
                                    : ''}
                                  {userReserveBTotal &&
                                  reserveB.isGreaterThan(1e-5)
                                    ? `${
                                        userReserveBTotal.isGreaterThan(0)
                                          ? new BigNumber(
                                              reserveB
                                                .multipliedBy(100)
                                                .dividedBy(userReserveBTotal)
                                            ).toFixed(1)
                                          : 0
                                      }%`
                                    : ''}
                                </td>
                                <td>
                                  {reserveA.isGreaterThan(1e-5)
                                    ? reserveA.toFixed(3)
                                    : ''}
                                </td>
                                <td>
                                  {reserveB.isGreaterThan(1e-5)
                                    ? reserveB.toFixed(3)
                                    : ''}
                                </td>
                                <td className="row gap-2 ml-4">
                                  {reserveA
                                    ?.plus(reserveB || 0)
                                    .isGreaterThan(0) &&
                                    (reserveA.isZero() ||
                                      reserveB.isZero()) && (
                                      <button
                                        type="button"
                                        className="button button-light"
                                      >
                                        Withdraw
                                      </button>
                                    )}
                                  {false && (
                                    <button
                                      type="button"
                                      className="button button-default"
                                    >
                                      Reset
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ) : null;
                          }
                        )
                    ) : (
                      <tr>
                        <td
                          colSpan={5}
                          className="p-5"
                          style={{ textAlign: 'center' }}
                        >
                          No deposits made yet
                        </td>
                      </tr>
                    )
                  ) : (
                    userTicks.map((tick, index) => {
                      return tick.price.isGreaterThanOrEqualTo(rangeMin) &&
                        tick.price.isLessThanOrEqualTo(rangeMax) ? (
                        <tr key={index} className="pt-2">
                          <td>{index + 1}</td>
                          <td>
                            {new BigNumber(tick.price.toFixed(5)).toFixed(5)}
                          </td>
                          <td>
                            {tick.reserveA.isGreaterThan(1e-5)
                              ? `${
                                  newReserveATotal.isGreaterThan(0)
                                    ? new BigNumber(
                                        tick.reserveA
                                          .multipliedBy(100)
                                          .dividedBy(newReserveATotal)
                                      ).toFixed(1)
                                    : 0
                                }%`
                              : ''}
                            {tick.reserveB.isGreaterThan(1e-5)
                              ? `${
                                  newReserveBTotal.isGreaterThan(0)
                                    ? new BigNumber(
                                        tick.reserveB
                                          .multipliedBy(100)
                                          .dividedBy(newReserveBTotal)
                                      ).toFixed(1)
                                    : 0
                                }%`
                              : ''}
                          </td>
                          <td>
                            {tick.reserveA.isGreaterThan(1e-5)
                              ? tick.reserveA.toFixed(3)
                              : ''}
                          </td>
                          <td>
                            {tick.reserveB.isGreaterThan(1e-5)
                              ? tick.reserveB.toFixed(3)
                              : ''}
                          </td>
                          <td className="row gap-2 ml-4">
                            <button
                              type="button"
                              className="button button-light"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ) : null;
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="col col--left gap-4">
            <fieldset className="page-card p-4" disabled={editMode}>
              <div className="chart-header row mt-2 h4">Add Liquidity</div>
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
              <div className="card-row my-3">
                <TokenInputGroup
                  className="flex"
                  variant={tokenA && !hasSufficientFundsA && 'error'}
                  onValueChanged={setInputValueA}
                  onTokenChanged={setTokenA}
                  tokenList={tokenList}
                  token={tokenA}
                  value={inputValueA}
                  exclusion={tokenB}
                />
              </div>
              <div className="card-row my-3">
                <TokenInputGroup
                  className="flex"
                  variant={tokenB && !hasSufficientFundsB && 'error'}
                  onValueChanged={setInputValueB}
                  onTokenChanged={setTokenB}
                  tokenList={tokenList}
                  token={tokenB}
                  value={inputValueB}
                  exclusion={tokenA}
                />
              </div>
              <div className="row liquidity-shape">
                <div className="col flex">
                  <h4 className="mt-4">Liquidity Shape</h4>
                  <RadioInput<LiquidityShape>
                    className="col flex"
                    maxColumnCount={4}
                    list={liquidityShapes}
                    value={liquidityShape}
                    onChange={setLiquidityShape}
                    OptionComponent={LiquidityShapeOptionComponent}
                  />
                </div>
              </div>
              <div className="col-lg">{confirmButton}</div>
            </fieldset>
            <fieldset
              className={['page-card p-4', !editMode && 'hide']
                .filter(Boolean)
                .join(' ')}
              disabled={!editMode}
            >
              <div className="chart-header row mt-2 h4">Edit Liquidity</div>
              <div className="card-row my-3"></div>
              <div className="row gap-3">
                <div className="col-lg flex">
                  <input
                    className="button-dark text-medium mt-4 p-3"
                    type="submit"
                    disabled={
                      (isValueAZero && isValueBZero) ||
                      !hasSufficientFundsA ||
                      !hasSufficientFundsB
                    }
                    value="Cancel"
                  />
                </div>
                <div className="col-lg flex">
                  <input
                    className="button-primary text-medium mt-4 p-3"
                    type="submit"
                    disabled={
                      (isValueAZero && isValueBZero) ||
                      !hasSufficientFundsA ||
                      !hasSufficientFundsB
                    }
                    value="Confirm"
                  />
                </div>
              </div>
            </fieldset>
          </div>
        </div>
      </div>
      <div className="spacer"></div>
    </form>
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
