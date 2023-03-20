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

import { getBalance, useBankBalances } from '../../lib/web3/indexerProvider';

import SelectInput, { OptionProps } from '../../components/inputs/SelectInput';
import StepNumberInput from '../../components/StepNumberInput';
import { useNumericInputState } from '../../components/inputs/NumberInput';
import TokenInputGroup from '../../components/TokenInputGroup';
import LiquiditySelector from '../../components/LiquiditySelector';
import {
  TickGroup,
  Tick,
} from '../../components/LiquiditySelector/LiquiditySelector';
import { useCurrentPriceFromTicks } from '../../components/LiquiditySelector/useCurrentPriceFromTicks';
import RadioButtonGroupInput from '../../components/RadioButtonGroupInput/RadioButtonGroupInput';
import PriceDataDisclaimer from '../../components/PriceDataDisclaimer';
import PoolsTableCard from '../../components/cards/PoolsTableCard';

import { useTokens, Token } from '../../components/TokenPicker/hooks';
import { useDeposit } from './useDeposit';
import useFeeLiquidityMap from './useFeeLiquidityMap';

import {
  formatMaximumSignificantDecimals,
  formatPrice,
} from '../../lib/utils/number';
import { priceToTickIndex, tickIndexToPrice } from '../../lib/web3/utils/ticks';
import { FeeType, feeTypes } from '../../lib/web3/utils/fees';
import { LiquidityShape, liquidityShapes } from '../../lib/web3/utils/shape';

import './Pool.scss';
import TokenPairLogos from '../../components/TokenPairLogos';
import RadioInput from '../../components/RadioInput';

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

const restrictPriceRangeValues = (
  valueString: string,
  [priceMin, priceMax]: [number | string, number | string] = priceRangeLimits
) => {
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

export default function PoolPage() {
  return (
    <div className="container">
      <div className="page">
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
  const [fineRangeMin, setFineRangeMin] = useState('1');
  const [fineRangeMax, setFineRangeMax] = useState('1');

  // start with a default range of nothing, but is should be quickly set
  // after price information becomes available
  const [rangeMin, setRangeMinUnprotected] = useState('1');
  const [rangeMax, setRangeMaxUnprotected] = useState('1');

  // side effect hack override fine controls with rough controls
  useLayoutEffect(() => {
    setFineRangeMin(rangeMin);
  }, [rangeMin]);
  useLayoutEffect(() => {
    setFineRangeMax(rangeMax);
  }, [rangeMax]);

  const [pairPriceMin, pairPriceMax] = useMemo(() => {
    const spreadFactor = 1000;
    return edgePrice
      ? [
          formatPrice(edgePrice.dividedBy(spreadFactor).toFixed()),
          formatPrice(edgePrice.multipliedBy(spreadFactor).toFixed()),
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

  const swapAll = useCallback(() => {
    const flipAroundCurrentPriceSwap = (value: string) => {
      // invert price
      const newValue = new BigNumber(1).dividedBy(new BigNumber(value));
      // round number to formatted string
      return formatMaximumSignificantDecimals(newValue);
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

  const [chartTypeSelected] = useState<'AMM' | 'Orderbook'>('AMM');

  // todo: this effect should be replaced with a better calculation for ticks
  const tickCount = Number(precision || 1);
  useLayoutEffect(() => {
    function getUserTicks(): TickGroup {
      const indexMin = priceToTickIndex(new BigNumber(fineRangeMin)).toNumber();
      const indexMax = priceToTickIndex(new BigNumber(fineRangeMax)).toNumber();
      // set multiple ticks across the range
      const feeIndex = feeType ? feeTypes.indexOf(feeType) : -1;
      if (
        tokenA &&
        tokenB &&
        tickCount > 1 &&
        indexMin !== undefined &&
        indexMax !== undefined &&
        indexMax > indexMin &&
        feeType &&
        feeIndex >= 0
      ) {
        const tokenAmountA = new BigNumber(values[0]);
        const tokenAmountB = new BigNumber(values[1]);

        // space new ticks linearly across tick (which is exponentially across price)
        const tickCounts: [number, number] = [0, 0];
        const tickPrices = Array.from({ length: tickCount }).reduceRight<
          Tick[]
        >((result, _, index, tickPrices) => {
          const tickIndex = Math.round(
            indexMin +
              (index * (indexMax - indexMin)) / Math.max(1, tickCount - 1)
          );
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
                index < tickPrices.length / 2;
          // add to count
          tickCounts[invertToken ? 0 : 1] += 1;
          return [
            {
              reserveA: new BigNumber(invertToken ? 1 : 0),
              reserveB: new BigNumber(invertToken ? 0 : 1),
              price: price,
              tickIndex: tickIndex,
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
        indexMin !== undefined &&
        indexMax !== undefined &&
        indexMin === indexMax &&
        feeType &&
        feeIndex &&
        feeIndex >= 0
      ) {
        const tickIndex = Math.round((indexMin + indexMax) / 2);
        const price = tickIndexToPrice(new BigNumber(tickIndex));
        return [
          {
            reserveA: new BigNumber(!isValueAZero ? 1 : 0),
            reserveB: new BigNumber(!isValueBZero ? 1 : 0),
            price: price,
            tickIndex: tickIndex,
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
    liquidityShape,
    fineRangeMin,
    fineRangeMax,
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

  const [selectedPoolsList, setSelectedPoolsList] = useState<'all' | 'mine'>(
    'all'
  );

  if (!tokenA || !tokenB || !valuesConfirmed) {
    return (
      <form
        className={[
          'pool-page row flex-centered flow-wrap gap-5',
          isValidatingDeposit && 'disabled',
        ]
          .filter(Boolean)
          .join(' ')}
        onSubmit={onSubmit}
      >
        <PoolsTableCard
          className="flex flex-auto"
          title="Pools"
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
              variant={!hasSufficientFundsA && 'error'}
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
              variant={!hasSufficientFundsB && 'error'}
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
        <div
          className={`my-4 p-5 chart-card page-card row chart-type--${chartTypeSelected.toLowerCase()}`}
        >
          <div className="chart-header row flow-wrap">
            <div className="col">
              <h3 className="h3">Add Liquidity</h3>
            </div>
            <div className="col flex-centered chart-highlight">Customized</div>
            <div className="col flex-centered ml-auto">Transaction Details</div>
          </div>
          <hr className="mt-3 mb-4" />
          <div className="flex row flow-wrap flow-nowrap-lg">
            <div className="flex col col--left">
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
                        <span className="badge">
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
                  variant={!hasSufficientFundsA && 'error'}
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
                  variant={!hasSufficientFundsB && 'error'}
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
                  rangeMin={fineRangeMin}
                  rangeMax={fineRangeMax}
                  setRangeMin={setFineRangeMin}
                  setRangeMax={setFineRangeMax}
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
                  <StepNumberInput
                    title="MIN PRICE"
                    value={rangeMin}
                    onChange={setRangeMin}
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
                    minSignificantDigits={Math.min(
                      Math.max(rangeMin.length + 1),
                      8
                    )}
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
                    max={pairPriceMax}
                    description={
                      tokenA && tokenB
                        ? `${tokenA.symbol} per ${tokenB.symbol}`
                        : 'No Tokens'
                    }
                    minSignificantDigits={Math.min(
                      Math.max(rangeMax.length + 1),
                      8
                    )}
                    maxSignificantDigits={maxFractionDigits + 2}
                    format={formatStepNumberPriceInput}
                  />
                </div>
              </div>
              {chartTypeSelected === 'Orderbook' && (
                <div className="mt-4 pt-4 page-card orderbook-card">
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
                  </div>
                </div>
              )}
            </div>
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
