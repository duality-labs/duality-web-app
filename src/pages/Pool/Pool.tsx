import {
  useEffect,
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
  faSliders,
  faCircle,
} from '@fortawesome/free-solid-svg-icons';

import {
  getBalance,
  TickInfo,
  useBankBalances,
  useFeeLiquidityMap,
  useIndexerPairData,
} from '../../lib/web3/indexerProvider';
import { useHasPriceData } from '../../lib/tokenPrices';

import RadioInput from '../../components/RadioInput';
import StepNumberInput from '../../components/StepNumberInput';
import { useNumericInputState } from '../../components/inputs/NumberInput';
import TokenInputGroup from '../../components/TokenInputGroup';
import LiquiditySelector from '../../components/LiquiditySelector';
import {
  TickGroup,
  Tick,
} from '../../components/LiquiditySelector/LiquiditySelector';
import useCurrentPriceFromTicks from '../../components/LiquiditySelector/useCurrentPriceFromTicks';
import RadioButtonGroupInput from '../../components/RadioButtonGroupInput/RadioButtonGroupInput';

import { useTokens, Token } from '../../components/TokenPicker/hooks';
import { useDeposit } from './useDeposit';

import { formatPrice } from '../../lib/utils/number';
import { priceToTickIndex } from '../../lib/web3/utils/ticks';
import { FeeType, feeTypes } from '../../lib/web3/utils/fees';

import './Pool.scss';

// the default resolution for a number in 18 decimal places
const { REACT_APP__MAX_FRACTION_DIGITS = '' } = process.env;
const maxFractionDigits = parseInt(REACT_APP__MAX_FRACTION_DIGITS) || 20;
const priceMin = Math.pow(10, -maxFractionDigits);
const priceMax = Math.pow(10, +maxFractionDigits);
const defaultFee = '0.30%';
const defaultSlopeType = 'UNIFORM';

type SlopeType = 'UNIFORM' | 'UP-SLOPE' | 'BELL CURVE' | 'DOWN-SLOPE';
const slopeTypes: Array<SlopeType> = [
  'UNIFORM',
  'UP-SLOPE',
  'BELL CURVE',
  'DOWN-SLOPE',
];

const defaultPrecision = '6';

const restrictPriceRangeValues = (valueString: string) => {
  const value = new BigNumber(valueString);
  if (value.isLessThan(priceMin)) {
    return formatPrice(priceMin);
  }
  if (value.isGreaterThan(priceMax)) {
    return formatPrice(priceMax);
  }
  if (!value.isNaN()) {
    return formatPrice(value.toFixed(), { minimumSignificantDigits: 3 });
  }
  return formatPrice(1);
};

export default function Pool() {
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

  // start with a default range of nothing, but is should be quickly set
  // after price information becomes available
  const [rangeMin, setRangeMinUnprotected] = useState('1');
  const [rangeMax, setRangeMaxUnprotected] = useState('1');
  // protect price range extents
  const setRangeMin = useCallback<React.Dispatch<React.SetStateAction<string>>>(
    (valueOrCallback) => {
      if (typeof valueOrCallback === 'function') {
        const callback = valueOrCallback;
        return setRangeMinUnprotected((value) => {
          return restrictPriceRangeValues(callback(value));
        });
      }
      const value = valueOrCallback;
      setRangeMinUnprotected(restrictPriceRangeValues(value));
    },
    []
  );
  const setRangeMax = useCallback<React.Dispatch<React.SetStateAction<string>>>(
    (valueOrCallback) => {
      if (typeof valueOrCallback === 'function') {
        const callback = valueOrCallback;
        return setRangeMaxUnprotected((value) => {
          return restrictPriceRangeValues(callback(value));
        });
      }
      const value = valueOrCallback;
      setRangeMaxUnprotected(restrictPriceRangeValues(value));
    },
    []
  );

  const [inputValueA, setInputValueA, valueA = '0'] = useNumericInputState();
  const [inputValueB, setInputValueB, valueB = '0'] = useNumericInputState();
  const values = useMemo(
    (): [string, string] => [valueA, valueB],
    [valueA, valueB]
  );

  const isValueAZero = new BigNumber(valueA).isZero();
  const isValueBZero = new BigNumber(valueB).isZero();

  const [valuesConfirmed, setValuesConfirmed] = useState(false);
  const valuesValid = !!tokenA && !!tokenB && values.some((v) => Number(v));

  const { data: { ticks = [], token0, token1 } = {} } = useIndexerPairData(
    tokenA?.address,
    tokenB?.address
  );

  const invertedTokenOrder =
    tokenA?.address === token1 && tokenB?.address === token0;

  const [slopeType, setSlopeType] = useState<SlopeType>(defaultSlopeType);
  const [precision, setPrecision] = useState<string>(defaultPrecision);
  // restrict precision to 2 ticks on double-sided liquidity mode
  useEffect(() => {
    setPrecision((precision) => {
      const precisionMin = !isValueAZero && !isValueBZero ? 2 : 1;
      return Number(precision) >= precisionMin ? precision : `${precisionMin}`;
    });
  }, [isValueAZero, isValueBZero]);

  const [{ isValidating: isValidatingDeposit }, sendDepositRequest] =
    useDeposit();

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

  const currentPriceFromTicks = useCurrentPriceFromTicks(
    tokenA?.address,
    tokenB?.address
  );

  // note warning price, the price at which warning states should be shown
  // for one-sided liquidity this is the extent of data to one side
  const edgePrice =
    useMemo(() => {
      const allTicks = (ticks || [])
        .filter(
          (tick): tick is TickInfo =>
            tick?.reserve0.isGreaterThan(0) || tick?.reserve1.isGreaterThan(0)
        ) // filter to only ticks
        .sort((a, b) => a.price.comparedTo(b.price))
        .map((tick) => [tick.price, tick.reserve0, tick.reserve1]);

      const isReserveAZero = allTicks.every(([, reserveA]) =>
        reserveA.isZero()
      );
      const isReserveBZero = allTicks.every(([, , reserveB]) =>
        reserveB.isZero()
      );

      const startTick = allTicks[0];
      const endTick = allTicks[allTicks.length - 1];
      const edgePrice =
        (isReserveAZero && startTick?.[0]) ||
        (isReserveBZero && endTick?.[0]) ||
        undefined;
      return (
        edgePrice &&
        (invertedTokenOrder ? new BigNumber(1).dividedBy(edgePrice) : edgePrice)
      );
    }, [ticks, invertedTokenOrder]) || currentPriceFromTicks;

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
        isValueAZero
          ? new BigNumber(price).multipliedBy(1.1).toFixed()
          : new BigNumber(price).multipliedBy(0.5).toFixed()
      );
      setRangeMax(
        isValueBZero
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
          normalizedTicks,
          invertTokenOrder
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
      invertTokenOrder,
    ]
  );

  const [userTickSelected, setUserTickSelected] = useState(-1);
  useEffect(() => {
    setUserTickSelected((selected) =>
      Math.min(selected, Number(precision) - 1)
    );
  }, [precision]);

  const swapAll = useCallback(() => {
    const flipAroundCurrentPriceSwap = (value: string) => {
      // invert price
      const newValue = new BigNumber(1).dividedBy(new BigNumber(value));
      // round number to formatted string
      return newValue.toFixed();
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
  ]);

  const [tabSelected, setTabSelected] = useState<'range' | 'fee' | 'curve'>(
    'range'
  );
  const [chartTypeSelected, setChartTypeSelected] = useState<
    'AMM' | 'Orderbook'
  >('AMM');

  const tickCount = Number(precision || 1);
  useEffect(() => {
    function getUserTicks(): TickGroup {
      const tickStart = new BigNumber(rangeMin);
      const tickEnd = new BigNumber(rangeMax);
      // set multiple ticks across the range
      const feeIndex = feeType ? feeTypes.indexOf(feeType) : -1;
      if (
        tokenA &&
        tokenB &&
        tickCount > 1 &&
        tickEnd.isGreaterThan(tickStart) &&
        feeType &&
        feeIndex >= 0
      ) {
        const tokenAmountA = new BigNumber(values[0]);
        const tokenAmountB = new BigNumber(values[1]);
        // spread evenly after adding padding on each side
        if (tickStart.isZero() || tickEnd.isZero()) return [];

        // space new ticks by a multiplication ratio gap
        // use Math.pow becuse BigNumber does not support logarithm calculation
        // todo: use BigNumber logarithm compatible library to more accurately calculate tick spacing,
        //       with many ticks the effect of this precision may be quite noticable
        const tickGapRatio = new BigNumber(
          Math.pow(tickEnd.dividedBy(tickStart).toNumber(), 1 / (tickCount - 1))
        );
        const tickCounts: [number, number] = [0, 0];
        const tickPrices = Array.from({ length: tickCount }).reduceRight<
          Tick[]
        >((result, _, index, tickPrices) => {
          const lastPrice: BigNumber | undefined = result[0]?.price;
          const price = lastPrice?.isLessThan(edgePrice || 0)
            ? // calculate price from left (to have exact left value)
              tickStart.multipliedBy(tickGapRatio.exponentiatedBy(index))
            : // calculate price from right (to have exact right value)
              lastPrice?.dividedBy(tickGapRatio) ?? tickEnd;

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
                index < tickPrices.length / 2;
          // add to count
          tickCounts[invertToken ? 0 : 1] += 1;
          const roundedPrice = new BigNumber(formatPrice(price.toFixed()));
          return [
            {
              reserveA: new BigNumber(invertToken ? 1 : 0),
              reserveB: new BigNumber(invertToken ? 0 : 1),
              price: roundedPrice,
              tickIndex: priceToTickIndex(roundedPrice).toNumber(),
              fee: new BigNumber(feeType.fee),
              feeIndex: feeIndex,
              tokenA: tokenA,
              tokenB: tokenB,
            },
            ...result,
          ];
        }, []);

        const shapeFactor = (() => {
          return (() => {
            switch (slopeType) {
              case 'UP-SLOPE':
                return tickPrices.map((_, index, tickPrices) => {
                  const percent = index / (tickPrices.length - 1);
                  return 1 + percent;
                });
              case 'BELL CURVE':
                return tickPrices.map((_, index, tickPrices) => {
                  const percent = index / (tickPrices.length - 1);
                  return (
                    (1 / Math.sqrt(2 * Math.PI)) *
                    Math.exp(-(1 / 2) * Math.pow((percent - 0.5) / 0.25, 2))
                  );
                });
              case 'DOWN-SLOPE':
                return tickPrices.map((_, index, tickPrices) => {
                  const percent = 1 - index / (tickPrices.length - 1);
                  return 1 + percent;
                });
              case 'UNIFORM':
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
                  // normalize ticks to market value
                  .multipliedBy(edgePrice || 1)
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
        (tickCount === 1 || tickStart.isEqualTo(tickEnd)) &&
        feeType &&
        feeIndex &&
        feeIndex >= 0
      ) {
        const price = tickStart.plus(tickEnd).dividedBy(2);
        const roundedPrice = new BigNumber(formatPrice(price.toFixed()));
        const isValueA =
          !isValueAZero && !isValueBZero
            ? edgePrice?.isGreaterThan(price) || isValueAZero
            : !isValueAZero;
        return [
          {
            reserveA: new BigNumber(isValueA ? 1 : 0),
            reserveB: new BigNumber(isValueA ? 0 : 1),
            price: roundedPrice,
            tickIndex: priceToTickIndex(roundedPrice).toNumber(),
            fee: new BigNumber(feeType.fee),
            feeIndex: feeIndex,
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
            newUserTick.feeIndex === userTick.feeIndex &&
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
    slopeType,
    rangeMin,
    rangeMax,
    tickCount,
    edgePrice,
    invertTokenOrder,
    setUserTicks,
  ]);

  const hasPriceData = useHasPriceData([tokenA, tokenB]);

  const [editingFee, setEditingFee] = useState(false);
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

  if (!tokenA || !tokenB || !valuesConfirmed) {
    return (
      <form
        className={['page', 'pool-page', isValidatingDeposit && 'disabled']
          .filter(Boolean)
          .join(' ')}
        onSubmit={onSubmit}
      >
        <div className="assets-card page-card">
          <h3 className="card-title mb-3">Add Liquidity</h3>
          <div className="mb-4">
            <p>
              Add liquidity in any ratio to earn fees on
              <br /> other people’s trades! Learn more{' '}
              <Link to="/my-liquidity">here</Link>.
            </p>
          </div>
          <div className="card-row">
            <TokenInputGroup
              variant={!hasSufficientFundsA && 'error'}
              onValueChanged={setInputValueA}
              onTokenChanged={setTokenA}
              tokenList={tokenList}
              token={tokenA}
              value={inputValueA}
              exclusion={tokenB}
            />
          </div>
          <div className="plus-space mx-auto my-2">
            <FontAwesomeIcon size="2x" icon={faPlus}></FontAwesomeIcon>
          </div>
          <div className="card-row">
            <TokenInputGroup
              variant={!hasSufficientFundsB && 'error'}
              onValueChanged={setInputValueB}
              onTokenChanged={setTokenB}
              tokenList={tokenList}
              token={tokenB}
              value={inputValueB}
              exclusion={tokenA}
            />
          </div>
          <div className="row flex-centered mt-5 mb-3 gapx-4">
            <div className="col">
              <input
                className="button-primary text-medium pill pill-outline px-4 py-4"
                disabled={
                  !valuesValid || !hasSufficientFundsA || !hasSufficientFundsB
                }
                type="submit"
                name="action"
                value="Customize"
              />
            </div>
            <div className="col">
              <input
                className="button-primary text-medium pill px-4 py-4"
                disabled={
                  !valuesValid || !hasSufficientFundsA || !hasSufficientFundsB
                }
                type="submit"
                name="action"
                value="Add Liquidity"
              />
            </div>
          </div>
          {hasPriceData && (
            <div className="attribution">
              Price data from{' '}
              <a
                target="_blank"
                rel="noreferrer"
                href="https://www.coingecko.com/"
              >
                CoinGecko
              </a>
            </div>
          )}
        </div>
      </form>
    );
  }

  return (
    <form
      className={['main-area', isValidatingDeposit && 'disabled']
        .filter(Boolean)
        .join(' ')}
      onSubmit={onSubmit}
    >
      <div className="pool-banner">
        <div className="row">
          <div className="row col-row">
            <h2>Assets</h2>
            <button
              className="button-secondary corner-border ml-1"
              onClick={() => setValuesConfirmed(false)}
            >
              Edit
            </button>
          </div>
          <div className="row col-row">
            {tokenA && (
              <button
                className={[
                  'badge-default corner-border badge-large',
                  isValueAZero && 'badge-muted',
                ].join(' ')}
                type="button"
              >
                {new BigNumber(values[0]).toFormat()}
                {tokenA.logo_URIs ? (
                  <img
                    className="ml-3 mr-2 token-image"
                    alt={`${tokenA.name} logo`}
                    // in this context (large images) prefer SVGs over PNGs for better images
                    src={tokenA.logo_URIs.svg || tokenA.logo_URIs.png}
                  />
                ) : (
                  <FontAwesomeIcon
                    icon={faCircle}
                    size="2x"
                    className="ml-3 mr-2 token-image token-image-not-found"
                  ></FontAwesomeIcon>
                )}
                {tokenA?.symbol}
              </button>
            )}
            {tokenA && tokenB && <div>+</div>}
            {tokenB && (
              <button
                className={[
                  'badge-default corner-border badge-large',
                  isValueBZero && 'badge-muted',
                ].join(' ')}
                type="button"
              >
                {new BigNumber(values[1]).toFormat()}
                {tokenB.logo_URIs ? (
                  <img
                    className="ml-3 mr-2 token-image"
                    alt={`${tokenB.name} logo`}
                    // in this context (large images) prefer SVGs over PNGs for better images
                    src={tokenB.logo_URIs.svg || tokenB.logo_URIs.png}
                  />
                ) : (
                  <FontAwesomeIcon
                    icon={faCircle}
                    size="2x"
                    className="ml-3 mr-2 token-image token-image-not-found"
                  ></FontAwesomeIcon>
                )}
                {tokenB?.symbol}
              </button>
            )}
          </div>
          <div className="row col-row ml-auto">
            <RadioButtonGroupInput<'AMM' | 'Orderbook'>
              className="chart-type-input"
              values={{
                AMM: 'Basic',
                Orderbook: 'Pro',
              }}
              value={chartTypeSelected}
              onChange={setChartTypeSelected}
            />
          </div>
          <div className="row col-row hide">
            <button className="icon-button" type="button">
              <FontAwesomeIcon icon={faSliders}></FontAwesomeIcon>
            </button>
          </div>
        </div>
      </div>
      <div className="page pool-page">
        <div
          className={`chart-card page-card row chart-type--${chartTypeSelected.toLowerCase()}`}
        >
          <div className="flex row">
            <div className="flex col col--left">
              <div className="chart-header row my-4">
                <h3 className="h3">Liquidity Distribution</h3>
                <span className="tokens-badge badge-default badge-large">
                  {tokenA?.symbol}/{tokenB?.symbol}
                </span>
                <button type="button" className="icon-button" onClick={swapAll}>
                  <FontAwesomeIcon
                    icon={faArrowRightArrowLeft}
                  ></FontAwesomeIcon>
                </button>
              </div>
              <div className="flex row chart-area">
                <LiquiditySelector
                  tokenA={tokenA}
                  tokenB={tokenB}
                  rangeMin={rangeMin}
                  rangeMax={rangeMax}
                  setRangeMin={setRangeMin}
                  setRangeMax={setRangeMax}
                  ticks={ticks}
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
                ></LiquiditySelector>
              </div>
            </div>
            <div className="col chart-price">
              <div className="hero-text mt-4">
                {currentPriceFromTicks?.toFixed(5) ?? '-'}
              </div>
              <div className="hero-texts mb-4">
                {currentPriceFromTicks
                  ? `${tokenA.display.toUpperCase()}/${tokenB.display.toUpperCase()}`
                  : '-'}
              </div>
              <div>Current Price</div>
              <div className="mt-auto mb-4">
                <input
                  className="button-primary text-medium mx-auto px-4 py-4"
                  type="submit"
                  value="Add Liquidity"
                />
              </div>
            </div>
          </div>
        </div>
        {chartTypeSelected === 'AMM' ? (
          <div className="page-card mx-auto">
            <RadioButtonGroupInput<'range' | 'fee' | 'curve'>
              className="mx-auto mt-2 mb-4"
              values={{
                range: <span>Price&nbsp;Range</span>,
                fee: <span>Fee&nbsp;Tier</span>,
                curve: <span>Liquidity&nbsp;Curve</span>,
              }}
              value={tabSelected}
              onChange={setTabSelected}
            />
            {tabSelected === 'range' && (
              <div className="price-card">
                <div className="card-row">
                  <StepNumberInput
                    title="MIN PRICE"
                    value={rangeMin}
                    onChange={setRangeMin}
                    stepFunction={logarithmStep}
                    pressedDelay={500}
                    pressedInterval={100}
                    min={priceMin}
                    max={rangeMax}
                    description={
                      tokenA && tokenB
                        ? `${tokenA.symbol} per ${tokenB.symbol}`
                        : 'No Tokens'
                    }
                    minSignificantDigits={8}
                    maxSignificantDigits={maxFractionDigits + 2}
                    format={formatStepNumberPriceInput}
                  />
                  <StepNumberInput
                    title="MAX PRICE"
                    value={rangeMax}
                    onChange={setRangeMax}
                    stepFunction={logarithmStep}
                    pressedDelay={500}
                    pressedInterval={100}
                    min={rangeMin}
                    max={priceMax}
                    description={
                      tokenA && tokenB
                        ? `${tokenA.symbol} per ${tokenB.symbol}`
                        : 'No Tokens'
                    }
                    minSignificantDigits={8}
                    maxSignificantDigits={maxFractionDigits + 2}
                    format={formatStepNumberPriceInput}
                  />
                </div>
                <div className="row mt-4 mb-2">
                  Your liquidity will be distributed within the minimum and
                  maximum price ranges.
                </div>
              </div>
            )}
            {tabSelected === 'fee' && (
              <div className="fee-card">
                <RadioInput<FeeType>
                  value={feeType}
                  list={feeTypes}
                  onChange={setFeeType}
                  OptionComponent={({
                    option: { fee, label, description },
                  }) => (
                    <div
                      key={fee}
                      className="button button-default card fee-type"
                    >
                      <h5 className="fee-title">{label}</h5>
                      <span className="fee-description">{description}</span>
                      {feeLiquidityMap?.[fee] && (
                        <span
                          className={[
                            feeLiquidityMap[fee].isZero() && 'badge-muted',
                            'pill fee-liquidity',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          {feeLiquidityMap[fee]
                            .multipliedBy(100)
                            .toNumber()
                            .toLocaleString('en-US', {
                              maximumFractionDigits: 1,
                            })}
                          % liquidity
                        </span>
                      )}
                    </div>
                  )}
                />
              </div>
            )}
            {tabSelected === 'curve' && (
              <div className="curve-card">
                <div className="info">
                  Your liquidity will be distributed among different price
                  points (called ticks) in the shape of the liquidity curve.
                  This is represented by the yellow curve above.
                </div>
                <div className="card-row mt-4">
                  <RadioButtonGroupInput<SlopeType>
                    values={slopeTypes}
                    value={slopeType}
                    onChange={setSlopeType}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="page-card orderbook-card mx-auto">
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
                for (let index = 0; index < Number(precision); index++) {
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
                    <h3 className="card-title mr-auto">Number of Ticks</h3>
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
                      value={userTicks[userTickSelected].price.toFixed()}
                      onChange={(value) => {
                        setUserTicks((userTicks) => {
                          // skip non-update
                          const newValue = new BigNumber(value);
                          if (
                            userTicks[userTickSelected].price.isEqualTo(
                              newValue
                            )
                          )
                            return userTicks;
                          // replace singular tick price
                          return userTicks.map((userTick, index) => {
                            return index === userTickSelected
                              ? {
                                  ...userTick,
                                  price: newValue,
                                  tickIndex:
                                    priceToTickIndex(newValue).toNumber(),
                                }
                              : userTick;
                          });
                        });
                      }}
                      maxSignificantDigits={maxFractionDigits + 1}
                      format={formatStepNumberPriceInput}
                    />
                  </div>
                )}
              </div>
              <div
                className="col"
                style={{
                  display: userTickSelected >= 0 ? 'none' : 'block',
                }}
              >
                <div className="fee-card">
                  <div className="card-header">
                    <h3 className="card-title mr-auto">Fee Tier</h3>
                    {!editingFee && (
                      <div className="badge-default corner-border badge-large ml-auto py-0">
                        {feeType?.label}
                      </div>
                    )}
                    <button
                      type="button"
                      className="button-secondary ml-2"
                      onClick={() => setEditingFee((mode) => !mode)}
                    >
                      {editingFee ? 'Hide' : 'Edit'}
                    </button>
                  </div>
                  <div className="card-row">
                    {editingFee ? (
                      <RadioInput<FeeType>
                        value={feeType}
                        list={feeTypes}
                        onChange={setFeeType}
                        OptionComponent={({
                          option: { fee, label, description },
                        }) => (
                          <div
                            key={fee}
                            className="button button-default card fee-type"
                          >
                            <h5 className="fee-title">{label}</h5>
                            <span className="fee-description">
                              {description}
                            </span>
                            {feeLiquidityMap?.[fee] && (
                              <span
                                className={[
                                  feeLiquidityMap[fee].isZero() &&
                                    'badge-muted',
                                  'pill fee-liquidity',
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                              >
                                {feeLiquidityMap[fee]
                                  .multipliedBy(100)
                                  .toNumber()
                                  .toLocaleString('en-US', {
                                    maximumFractionDigits: 1,
                                  })}
                                % liquidity
                              </span>
                            )}
                          </div>
                        )}
                      />
                    ) : (
                      <>
                        {feeType && feeLiquidityMap?.[feeType.fee] && (
                          <span
                            className={[
                              feeLiquidityMap?.[feeType.fee].isZero() &&
                                'badge-muted',
                              'badge-info pill ml-auto badge-large fs-s mt-auto',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          >
                            {feeLiquidityMap[feeType.fee]
                              .multipliedBy(100)
                              .toNumber()
                              .toLocaleString('en-US', {
                                maximumFractionDigits: 1,
                              })}
                            % liquidity
                          </span>
                        )}
                        <span className="badge-info pill ml-2 badge-large fs-s mt-auto">
                          {feeType?.description}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="spacer"></div>
    </form>
  );
}

// calculates set from last siginificant digit (eg. 0.8 -> 0.9 -> 1 -> 2)
// todo: could respect trailing zeros is strings were passed
function logarithmStep(valueString: string, direction: number): string {
  const value = new BigNumber(valueString);
  const significantDigits = value.sd(true);
  const orderOfMagnitude = Math.floor(Math.log10(value.toNumber()));
  const orderOfMagnitudeLastDigit = orderOfMagnitude - significantDigits;
  // remove leading zeros then get significant digit
  const decimalPlaces = value.decimalPlaces();
  const lastDigit =
    decimalPlaces > 0
      ? // get decimal place
        value.toFixed(decimalPlaces).slice(-1)
      : // get significant figure
        value.toFixed(0).at(significantDigits - 1);
  return direction >= 0
    ? value.isGreaterThan(0)
      ? value
          .plus(
            new BigNumber(10).exponentiatedBy(orderOfMagnitudeLastDigit + 1)
          )
          .toFixed()
      : new BigNumber(10).exponentiatedBy(-maxFractionDigits).toFixed()
    : value
        .minus(
          new BigNumber(10).exponentiatedBy(
            // reduce the order of magnitude of the value if going from a singular '1'
            // eg. 1 -> 0.9,  0.1 -> 0.09,  0.01 -> 0.009
            // so that the user doesn't go to 0 on a logarithmic scale
            orderOfMagnitudeLastDigit +
              (lastDigit === '1' && value.sd(false) === 1 ? 0 : +1)
          )
        )
        .toFixed();
}

// note: this cause odd issues when trying to control the number via keys or StepNumberInput
// instead of dragging (eg. select all and press 1 -> 1.00, press "1.5" -> 1.005)
// This could be fixed by using a string for all cases of price as BigNumber
// objects are not aware of how many significant digits they have.
function formatStepNumberPriceInput(value: string) {
  const formatted = formatPrice(value, { minimumSignificantDigits: 3 });
  return formatted.length > value.length ? formatted : value;
}
