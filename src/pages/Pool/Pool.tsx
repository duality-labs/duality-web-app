import {
  useEffect,
  useState,
  useCallback,
  FormEvent,
  useMemo,
  ReactNode,
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
  TickMap,
  useBankBalances,
  useFeeLiquidityMap,
  useIndexerPairData,
} from '../../lib/web3/indexerProvider';
import { useHasPriceData } from '../../lib/tokenPrices';

import RadioInput from '../../components/RadioInput';
import StepNumberInput from '../../components/StepNumberInput';

import TokenInputGroup from '../../components/TokenInputGroup';
import LiquiditySelector from '../../components/LiquiditySelector';
import {
  TickGroup,
  Tick,
} from '../../components/LiquiditySelector/LiquiditySelector';
import useCurrentPriceFromTicks from '../../components/LiquiditySelector/useCurrentPriceFromTicks';
import RadioButtonGroupInput from '../../components/RadioButtonGroupInput/RadioButtonGroupInput';

import { useTokens, Token } from '../../components/TokenPicker/hooks';

import { FeeType, feeTypes } from '../../lib/web3/utils/fees';

import './Pool.scss';
import { useDeposit } from './useDeposit';

const { REACT_APP__COIN_MIN_DENOM_EXP = '18' } = process.env;
const denomExponent = parseInt(REACT_APP__COIN_MIN_DENOM_EXP) || 0;
const denomMin = Math.pow(10, -denomExponent);
const denomMax = Math.pow(10, +denomExponent);
const defaultFee = '0.30%';
const defaultPrice = '1';
const defaultSlopeType = 'UNIFORM';
const defaultRangeMin = new BigNumber(defaultPrice).dividedBy(2).toFixed();
const defaultRangeMax = new BigNumber(defaultPrice).multipliedBy(2).toFixed();
const defaultTokenAmount = '0';

type SlopeType = 'UNIFORM' | 'UP-SLOPE' | 'BELL CURVE' | 'DOWN-SLOPE';
const slopeTypes: Array<SlopeType> = [
  'UNIFORM',
  'UP-SLOPE',
  'BELL CURVE',
  'DOWN-SLOPE',
];

const defaultPrecision = '6';
// set as constant to avoid unwanted hook effects
const defaultCurrentPrice = new BigNumber(1);

function formatPrice(value: BigNumber): string {
  return value.toFixed(
    Math.max(0, value.dp() - value.sd(true) + 3),
    BigNumber.ROUND_HALF_UP
  );
}

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
    const USDC = tokenList?.find((token) => token.symbol === 'USDC');
    if (USDC && !tokenB) {
      setTokenB(USDC);
    }
  }, [tokenB, tokenList]);

  const [rangeMin, setRangeMin] = useState(defaultRangeMin);
  const [rangeMax, setRangeMax] = useState(defaultRangeMax);
  const [values, setValues] = useState<[string, string]>(() => [
    new BigNumber(defaultTokenAmount).toFixed(),
    new BigNumber(defaultTokenAmount).toFixed(),
  ]);

  const [valuesConfirmed, setValuesConfirmed] = useState(false);
  const valuesValid = !!tokenA && !!tokenB && values.every((v) => Number(v));

  const {
    data: { ticks: unorderedTicks } = {},
    error: ticksError,
    isValidating: tickFetching,
  } = useIndexerPairData(tokenA?.address, tokenB?.address);

  const [slopeType, setSlopeType] = useState<SlopeType>(defaultSlopeType);
  const [precision, setPrecision] = useState<string>(defaultPrecision);

  const [
    {
      data: depositResponse,
      isValidating: isValidatingDeposit,
      error: depositError,
    },
    sendDepositRequest,
  ] = useDeposit();

  const [userTicks, setUserTicksUnprotected] = useState<TickGroup>([]);
  // ensure that setting of user ticks never goes outside our prescribed bounds
  const setUserTicks = useCallback<
    React.Dispatch<React.SetStateAction<TickGroup>>
  >((userTicksOrCallback) => {
    function restrictTickPrices(tick: Tick): Tick {
      const [price, token0Value, token1Value] = tick;
      if (price.isLessThan(denomMin)) {
        return [new BigNumber(denomMin), token0Value, token1Value];
      }
      if (price.isGreaterThan(denomMax)) {
        return [new BigNumber(denomMax), token0Value, token1Value];
      }
      return [price, token0Value, token1Value];
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

  const currentPriceABFromTicks =
    useCurrentPriceFromTicks(unorderedTicks) || defaultCurrentPrice;

  const [invertedTokenOrder, setInvertedTokenOrder] = useState<boolean>(() => {
    return currentPriceABFromTicks?.isLessThan(1);
  });

  const currentPriceFromTicks = useMemo(() => {
    return invertedTokenOrder
      ? new BigNumber(1).dividedBy(currentPriceABFromTicks)
      : currentPriceABFromTicks;
  }, [invertedTokenOrder, currentPriceABFromTicks]);

  const ticks = useMemo(() => {
    if (!invertedTokenOrder) return unorderedTicks;
    if (!unorderedTicks) return unorderedTicks;
    // invert ticks
    const one = new BigNumber(1);
    return Object.entries(unorderedTicks).reduce<TickMap>(
      (result, [key, [tick0to1, tick1to0]]) => {
        // remap tick fields and invert the price
        result[key] = [
          tick1to0 && {
            ...tick1to0,
            price: one.dividedBy(tick1to0.price),
            reserve0: tick1to0.reserve1,
            reserve1: tick1to0.reserve0,
          },
          tick0to1 && {
            ...tick0to1,
            price: one.dividedBy(tick0to1.price),
            reserve0: tick0to1.reserve1,
            reserve1: tick0to1.reserve0,
          },
        ];
        return result;
      },
      {}
    );
  }, [unorderedTicks, invertedTokenOrder]);

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
      if (feeType?.fee) {
        await sendDepositRequest(
          tokenA,
          tokenB,
          new BigNumber(feeType.fee),
          userTicks
        );
      }
    },
    [valuesValid, tokenA, tokenB, feeType, userTicks, sendDepositRequest]
  );

  const [tickSelected, setTickSelected] = useState(-1);
  useEffect(() => {
    setTickSelected((selected) => Math.min(selected, Number(precision) - 1));
  }, [precision]);

  const swapAll = useCallback(() => {
    setInvertedTokenOrder((order) => !order);
    setRangeMin(() => {
      const newValue = new BigNumber(1).dividedBy(new BigNumber(rangeMax));
      return newValue.toFixed(
        Math.max(0, newValue.dp() - newValue.sd(true) + 3),
        BigNumber.ROUND_HALF_DOWN
      );
    });
    setRangeMax(() => {
      const newValue = new BigNumber(1).dividedBy(new BigNumber(rangeMin));
      return newValue.toFixed(
        Math.max(0, newValue.dp() - newValue.sd(true) + 3),
        BigNumber.ROUND_HALF_UP
      );
    });
    setValues(([valueA, valueB]) => [valueB, valueA]);
    setTokenA(tokenB);
    setTokenB(tokenA);
  }, [tokenA, tokenB, rangeMin, rangeMax]);

  const [tabSelected, setTabSelected] = useState<'range' | 'fee' | 'curve'>(
    'range'
  );
  const [chartTypeSelected, setChartTypeSelected] = useState<
    'AMM' | 'Orderbook'
  >('AMM');

  const tickCount = Number(precision || 1);
  useEffect(() => {
    function getUserTicks(): TickGroup {
      // set multiple ticks across the range
      if (currentPriceFromTicks.isGreaterThan(0) && tickCount > 1) {
        const tokenAmountA = new BigNumber(values[0]);
        const tokenAmountB = new BigNumber(values[1]);
        // spread evenly after adding padding on each side
        const tickStart = new BigNumber(rangeMin);
        const tickEnd = new BigNumber(rangeMax);
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
          [BigNumber, BigNumber, BigNumber][]
        >((result, _, index) => {
          const lastPrice = result[0]?.[0];
          const price = lastPrice?.isLessThan(currentPriceFromTicks)
            ? // calculate price from left (to have exact left value)
              tickStart.multipliedBy(tickGapRatio.exponentiatedBy(index))
            : // calculate price from right (to have exact right value)
              lastPrice?.dividedBy(tickGapRatio) ?? tickEnd;

          // choose whether token A or B should be added for the tick at this price
          const invertToken = price.isLessThan(currentPriceFromTicks);
          // add to count
          tickCounts[invertToken ? 0 : 1] += 1;
          return [
            [
              new BigNumber(formatPrice(price)),
              new BigNumber(invertToken ? 1 : 0),
              new BigNumber(invertToken ? 0 : 1),
            ],
            ...result,
          ];
        }, []);

        const shapeFactor = (() => {
          const values = (() => {
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
          // normalise values before returning
          const sum = values.reduce((result, value) => result + value, 0);
          return values.map((value) => value / sum);
        })();

        // normalise the tick amounts given
        return tickPrices.map(([price, countA, countB], index) => {
          return [
            price,
            // ensure division is to µtokens amount but given in tokens
            tickCounts[0]
              ? tokenAmountA
                  .multipliedBy(shapeFactor[index])
                  .multipliedBy(countA)
                  .dividedBy(tickCounts[0])
              : new BigNumber(0),
            tickCounts[1]
              ? tokenAmountB
                  .multipliedBy(shapeFactor[index])
                  .multipliedBy(countB)
                  .dividedBy(tickCounts[1])
              : new BigNumber(0),
          ];
        });
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
          return newUserTick.every((value, valueIndex) => {
            return value.isEqualTo(userTicks[ticksIndex][valueIndex]);
          });
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
    slopeType,
    rangeMin,
    rangeMax,
    tickCount,
    currentPriceFromTicks,
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

  if (!valuesConfirmed) {
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
              onValueChanged={(newValue) =>
                setValues(([, valueB]) => [newValue, valueB])
              }
              onTokenChanged={setTokenA}
              tokenList={tokenList}
              token={tokenA}
              value={`${values[0]}`}
              exclusion={tokenB}
            />
          </div>
          <div className="plus-space mx-auto my-2">
            <FontAwesomeIcon size="2x" icon={faPlus}></FontAwesomeIcon>
          </div>
          <div className="card-row">
            <TokenInputGroup
              variant={!hasSufficientFundsB && 'error'}
              onValueChanged={(newValue) =>
                setValues(([valueA]) => [valueA, newValue])
              }
              onTokenChanged={setTokenB}
              tokenList={tokenList}
              token={tokenB}
              value={`${values[1]}`}
              exclusion={tokenA}
            />
          </div>
          <div className="card-col mt-5 mb-3">
            <div className="mx-auto">
              <input
                className="button-primary pill pill-outline mx-3 px-4 py-4"
                disabled={
                  !valuesValid || !hasSufficientFundsA || !hasSufficientFundsB
                }
                type="submit"
                name="action"
                value="Customize"
              />
              <input
                className="button-primary pill mx-3 px-4 py-4"
                disabled={
                  !valuesValid || !hasSufficientFundsA || !hasSufficientFundsB
                }
                type="submit"
                name="actiona"
                value="Add Liquidity"
              />
            </div>
            {(tickFetching || isValidatingDeposit) && (
              <div className="mx-auto mt-4 text-secondary card-row">
                Waiting for confirmation...
              </div>
            )}
            {(ticksError || depositError || depositResponse) && (
              <div className="mx-auto mt-4">
                <div className="text-red-500">
                  {!isValidatingDeposit && ticksError}
                </div>
                <div className="text-red-500">
                  {!isValidatingDeposit && depositError}
                </div>
                <div className="text-sky-500">
                  {!isValidatingDeposit && depositResponse
                    ? `Deposited ${depositResponse.receivedTokenA} ${tokenA?.address} and ${depositResponse.receivedTokenB} ${tokenB?.address}`
                    : ''}
                </div>
              </div>
            )}
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
                className="badge-default corner-border badge-large font-console"
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
                className="badge-default corner-border badge-large font-console"
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
                <h3 className="h3 text-normal">Liquidity Distribution</h3>
                <span className="tokens-badge badge-default badge-large font-console">
                  {tokenB?.symbol}/{tokenA?.symbol}
                </span>
                <button type="button" className="icon-button" onClick={swapAll}>
                  <FontAwesomeIcon
                    icon={faArrowRightArrowLeft}
                  ></FontAwesomeIcon>
                </button>
              </div>
              <div className="flex row chart-area">
                <LiquiditySelector
                  setRangeMin={setRangeMin}
                  setRangeMax={setRangeMax}
                  ticks={ticks}
                  tickSelected={tickSelected}
                  setTickSelected={setTickSelected}
                  feeTier={feeType?.fee}
                  userTicks={userTicks}
                  setUserTicks={setUserTicks}
                  advanced={chartTypeSelected === 'Orderbook'}
                  formatPrice={formatPrice}
                  canMoveUp
                  canMoveDown
                  canMoveX
                ></LiquiditySelector>
              </div>
            </div>
            <div className="col chart-price">
              <div className="hero-text my-4">
                {currentPriceFromTicks?.toFixed(5)}
              </div>
              <div>Current Price</div>
              <div className="mt-auto mb-4">
                <input
                  className="button-primary mx-auto px-4 py-4"
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
                    min={denomMin}
                    max={rangeMax}
                    description={
                      tokenA && tokenB
                        ? `${tokenB.symbol} per ${tokenA.symbol}`
                        : 'No Tokens'
                    }
                    minSignificantDigits={8}
                    maxSignificantDigits={denomExponent + 1}
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
                    max={denomMax}
                    description={
                      tokenA && tokenB
                        ? `${tokenB.symbol} per ${tokenA.symbol}`
                        : 'No Tokens'
                    }
                    minSignificantDigits={8}
                    maxSignificantDigits={denomExponent + 1}
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
                for (let index = 0; index < Number(precision); index++) {
                  map.set(index, index + 1);
                }
                return map;
              })()}
              value={tickSelected}
              onChange={(tickSelectedString) => {
                setTickSelected(tickSelectedString);
              }}
            />
            <div className="row">
              <div className="col">
                {tickSelected < 0 ? (
                  <div className="row precision-card">
                    <h3 className="card-title mr-auto">Number of Ticks</h3>
                    <StepNumberInput
                      editable={false}
                      min={2}
                      max={10}
                      value={precision}
                      onChange={setPrecision}
                      minSignificantDigits={2}
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
                      key={tickSelected}
                      min={denomMin}
                      max={denomMax}
                      pressedDelay={500}
                      pressedInterval={100}
                      stepFunction={logarithmStep}
                      value={userTicks[tickSelected][0].toFixed()}
                      onChange={(value) => {
                        setUserTicks((userTicks) => {
                          // skip non-update
                          const newValue = new BigNumber(value);
                          if (userTicks[tickSelected][0].isEqualTo(newValue))
                            return userTicks;
                          // replace singular tick price
                          return userTicks.map((userTick, index) => {
                            return index === tickSelected
                              ? [newValue, userTick[1], userTick[2]]
                              : userTick;
                          });
                        });
                      }}
                      maxSignificantDigits={denomExponent + 1}
                      format={formatStepNumberPriceInput}
                    />
                  </div>
                )}
              </div>
              <div
                className="col"
                style={{
                  display: tickSelected >= 0 ? 'none' : 'block',
                }}
              >
                <div className="fee-card">
                  <div className="card-header">
                    <h3 className="card-title mb-3 mr-auto">Fee Tier</h3>
                    {!editingFee && (
                      <div className="badge-default corner-border badge-large font-console ml-auto">
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
                              'badge-info pill ml-auto badge-large text-slim fs-s mt-auto',
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
                        <span className="badge-info pill ml-2 badge-large text-slim fs-s mt-auto">
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
        <div className="pool-options">
          <div className="card-row">
            {(tickFetching || isValidatingDeposit) && (
              <div className="text-secondary card-row">...</div>
            )}
            <br />
            <div className="text-red-500">
              {!isValidatingDeposit && ticksError}
            </div>
            <div className="text-red-500">
              {!isValidatingDeposit && depositError}
            </div>
            <div className="text-sky-500">
              {!isValidatingDeposit && depositResponse
                ? `Deposited ${depositResponse.receivedTokenA} ${tokenA?.address} and ${depositResponse.receivedTokenB} ${tokenB?.address}`
                : ''}
            </div>
          </div>
        </div>
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
      : new BigNumber(10).exponentiatedBy(-denomExponent).toFixed()
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
  const formatted = formatPrice(new BigNumber(value));
  return formatted.length > value.length ? formatted : value;
}
