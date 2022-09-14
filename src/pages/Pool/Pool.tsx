import { useEffect, useState, useCallback, FormEvent, useMemo } from 'react';
import BigNumber from 'bignumber.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowUpLong,
  faArrowDownLong,
  faArrowRightArrowLeft,
  faSliders,
  faCircle,
} from '@fortawesome/free-solid-svg-icons';

import { TickMap, useIndexerPairData } from '../../lib/web3/indexerProvider';

import RadioInput from '../../components/RadioInput';
import StepNumberInput from '../../components/StepNumberInput';

import TokenInputGroup from '../../components/TokenInputGroup';
import LiquiditySelector from '../../components/LiquiditySelector';
import { TickGroup } from '../../components/LiquiditySelector/LiquiditySelector';
import useCurrentPriceFromTicks from '../../components/LiquiditySelector/useCurrentPriceFromTicks';

import { useTokens, Token } from '../../components/TokenPicker/mockHooks';

import './Pool.scss';
import { useDeposit } from './useDeposit';

const { REACT_APP__COIN_MIN_DENOM_EXP = '18' } = process.env;
const denomExponent = parseInt(REACT_APP__COIN_MIN_DENOM_EXP) || 0;
const defaultFee = '0.30%';
const defaultPrice = '1';
const defaultSlopeType = 'UNIFORM';
const defaultRangeMin = new BigNumber(defaultPrice)
  .dividedBy(2)
  .toFixed(denomExponent);
const defaultRangeMax = new BigNumber(defaultPrice).multipliedBy(2).toFixed(0);
const defaultTokenAmount = '1';

interface FeeType {
  fee: number;
  label: string;
  description: string;
}
const feeTypes: Array<FeeType> = Object.entries({
  '0.01%': 'Best for very stable pairs.',
  '0.05%': 'Best for  stable pairs.',
  '0.30%': 'Best for most assets.',
  '1.00%': 'Best for exotic assets.',
}).map(([label, description]) => ({
  label,
  fee: Number(label.replace(/%$/, '')) / 100,
  description,
}));

const slopeTypes = ['UNIFORM', 'UP-SLOPE', 'BELL CURVE', 'DOWN-SLOPE'];

const calculateFeeLiquidity = function (label: string) {
  const test: { [label: string]: string } = {
    '0.01%': '1% liquidity',
    '0.05%': '9% liquidity',
    '0.30%': '83% liquidity',
    '1.00%': '7% liquidity',
  };
  return test[label];
};

const defaultPrecision = '6';

export default function Pool() {
  const [tokenA, setTokenA] = useState(undefined as Token | undefined);
  const [tokenB, setTokenB] = useState(undefined as Token | undefined);
  const [feeType, setFeeType] = useState<FeeType | undefined>(() =>
    feeTypes.find(({ label }) => label === defaultFee)
  );
  const swapTokens = useCallback(() => {
    setTokenA(tokenB);
    setTokenB(tokenA);
  }, [tokenA, tokenB]);
  const { data: tokenList = [] } = useTokens();

  // set token A to be first token in list if not already populated
  useEffect(() => {
    if (tokenList.length > 0 && !tokenA) {
      setTokenA(tokenList[0]);
    }
  }, [tokenA, tokenList]);

  const [rangeMin, setRangeMin] = useState(defaultRangeMin);
  const [rangeMax, setRangeMax] = useState(defaultRangeMax);
  const [values, setValues] = useState<[string, string]>(() => [
    new BigNumber(defaultTokenAmount).toFixed(denomExponent),
    new BigNumber(defaultTokenAmount).toFixed(denomExponent),
  ]);

  const [valuesConfirmed, setValuesConfirmed] = useState(false);

  const {
    data: { ticks: unorderedTicks } = {},
    error: ticksError,
    isValidating: tickFetching,
  } = useIndexerPairData(tokenA?.address, tokenB?.address);

  const [slopeType, setSlopeType] = useState<string>(defaultSlopeType);
  const [precision, setPrecision] = useState<string>(defaultPrecision);

  const [
    {
      data: depositResponse,
      isValidating: isValidatingDeposit,
      error: depositError,
    },
    sendDepositRequest,
  ] = useDeposit();

  const [userTicks, setUserTicks] = useState<TickGroup>([]);

  const currentPriceABFromTicks =
    useCurrentPriceFromTicks(unorderedTicks) || new BigNumber(1);

  const [invertedTokenOrder, setInvertedTokenOrder] = useState(true);

  const currentPriceFromTicks = invertedTokenOrder
    ? new BigNumber(1).dividedBy(currentPriceABFromTicks)
    : currentPriceABFromTicks;
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
    [tokenA, tokenB, feeType, userTicks, sendDepositRequest]
  );

  const [tickSelected, setTickSelected] = useState(-1);
  useEffect(() => {
    setTickSelected((selected) => Math.min(selected, Number(precision) - 1));
  }, [precision]);

  const [tabSelected, setTabSelected] = useState<'range' | 'fee' | 'curve'>(
    'range'
  );
  const [chartTypeSelected, setChartTypeSelected] = useState<
    'AMM' | 'Orderbook'
  >('AMM');

  if (!valuesConfirmed) {
    return (
      <form className="pool-page" onSubmit={onSubmit}>
        <div className="assets-card page-card">
          <h3 className="card-header card-title">Assets</h3>
          <div className="card-row">
            <TokenInputGroup
              onValueChanged={(newValue) =>
                setValues(([, valueB]) => [newValue, valueB])
              }
              onTokenChanged={setTokenA}
              tokenList={tokenList}
              token={tokenA}
              value={`${values[0]}`}
              exclusion={tokenB}
              title="Asset 1"
            />
          </div>
          <div className="card-row">
            <button
              type="button"
              onClick={swapTokens}
              className="icon-button mx-auto"
            >
              <FontAwesomeIcon icon={faArrowUpLong}></FontAwesomeIcon>
              <FontAwesomeIcon icon={faArrowDownLong}></FontAwesomeIcon>
            </button>
          </div>
          <div className="card-row">
            <TokenInputGroup
              onValueChanged={(newValue) =>
                setValues(([valueA]) => [valueA, newValue])
              }
              onTokenChanged={setTokenB}
              tokenList={tokenList}
              token={tokenB}
              value={`${values[1]}`}
              exclusion={tokenA}
              title="Asset 2"
            />
          </div>
          <div className="card-col mt-5 mb-3">
            {(tickFetching || isValidatingDeposit) && (
              <div className="text-secondary card-row">...</div>
            )}
            <div className="mx-auto">
              <input
                className="pill pill-outline mx-3 px-4 py-4"
                type="submit"
                name="action"
                value="Customize"
              />
              <input
                className="pill mx-3 px-4 py-4"
                type="submit"
                name="actiona"
                value="Add Liquidity"
              />
            </div>
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
        </div>
      </form>
    );
  }

  return (
    <>
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
              <button className="badge-primary corner-border badge-large font-console">
                {new BigNumber(values[0]).toFormat()}
                {tokenA.logo ? (
                  <img
                    className="ml-3 mr-1 token-image"
                    alt={`${tokenA.symbol} logo`}
                    src={tokenA.logo}
                  />
                ) : (
                  <FontAwesomeIcon
                    icon={faCircle}
                    size="2x"
                    className="ml-3 mr-1 token-image token-image-not-found"
                  ></FontAwesomeIcon>
                )}
                {tokenA?.symbol}
              </button>
            )}
            {tokenA && tokenB && <div>+</div>}
            {tokenB && (
              <button className="badge-primary corner-border badge-large font-console">
                {new BigNumber(values[1]).toFormat()}
                {tokenB.logo ? (
                  <img
                    className="ml-3 mr-1 token-image"
                    alt={`${tokenB.symbol} logo`}
                    src={tokenB.logo}
                  />
                ) : (
                  <FontAwesomeIcon
                    icon={faCircle}
                    size="2x"
                    className="ml-3 mr-1 token-image token-image-not-found"
                  ></FontAwesomeIcon>
                )}
                {tokenB?.symbol}
              </button>
            )}
          </div>
          <div className="row col-row ml-auto">
            <div className="button-switch-group">
              <button
                type="button"
                className={[
                  'button',
                  'py-3',
                  'px-5',
                  chartTypeSelected === 'AMM' && 'button-primary',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setChartTypeSelected('AMM')}
              >
                AMM
              </button>
              <button
                type="button"
                className={[
                  'button',
                  'py-3',
                  'px-5',
                  chartTypeSelected === 'Orderbook' && 'button-primary',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setChartTypeSelected('Orderbook')}
              >
                Orderbook
              </button>
            </div>
          </div>
          <div className="row col-row">
            <button className="icon-button">
              <FontAwesomeIcon icon={faSliders}></FontAwesomeIcon>
            </button>
          </div>
        </div>
      </div>
      <form className="pool-page" onSubmit={onSubmit}>
        <div className="chart-card page-card row">
          <div className="flex row">
            <div className="flex col col--left">
              <div className="chart-header row my-4">
                <h3 className="text-normal">Liquidity Distribution</h3>
                <span className="tokens-badge badge-primary badge-large font-console">
                  {tokenA?.symbol}/{tokenB?.symbol}
                </span>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => {
                    setInvertedTokenOrder((order) => !order);
                    setRangeMin(() => {
                      const newValue = new BigNumber(1).dividedBy(
                        new BigNumber(rangeMax)
                      );
                      return newValue.toFixed(
                        Math.max(0, newValue.dp() - newValue.sd(true) + 3)
                      );
                    });
                    setRangeMax(() => {
                      const newValue = new BigNumber(1).dividedBy(
                        new BigNumber(rangeMin)
                      );
                      return newValue.toFixed(
                        Math.max(0, newValue.dp() - newValue.sd(true) + 3)
                      );
                    });
                    swapTokens();
                  }}
                >
                  <FontAwesomeIcon
                    icon={faArrowRightArrowLeft}
                  ></FontAwesomeIcon>
                </button>
              </div>
              <div className="flex row chart-area">
                <LiquiditySelector
                  rangeMin={rangeMin}
                  rangeMax={rangeMax}
                  setRangeMin={setRangeMin}
                  setRangeMax={setRangeMax}
                  tickCount={parseInt(precision) || 1}
                  ticks={ticks}
                  feeTier={feeType?.fee}
                  tokenValues={values}
                  setUserTicks={setUserTicks}
                  advanced={chartTypeSelected === 'Orderbook'}
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
                  className="mx-auto px-4 py-4"
                  type="submit"
                  value="Add Liquidity"
                />
              </div>
            </div>
          </div>
        </div>
        {chartTypeSelected === 'AMM' ? (
          <div className="page-card mx-auto">
            <div className="button-switch-group mx-auto mt-2 mb-4">
              <button
                type="button"
                className={[
                  'button',
                  'py-3',
                  'px-5',
                  tabSelected === 'range' && 'button-primary',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setTabSelected('range')}
              >
                Price Range
              </button>
              <button
                type="button"
                className={[
                  'button',
                  'py-3',
                  'px-5',
                  tabSelected === 'fee' && 'button-primary',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setTabSelected('fee')}
              >
                Fee Tier
              </button>
              <button
                type="button"
                className={[
                  'button',
                  'py-3',
                  'px-5',
                  tabSelected === 'curve' && 'button-primary',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setTabSelected('curve')}
              >
                Liquidity Curve
              </button>
            </div>
            {tabSelected === 'range' && (
              <div className="price-card">
                <div className="card-row">
                  <StepNumberInput
                    title="MIN PRICE"
                    value={rangeMin}
                    onChange={setRangeMin}
                    stepFunction={logarithmStep}
                    min={0}
                    max={rangeMax}
                    description={
                      tokenA && tokenB
                        ? `${tokenA.symbol} per ${tokenB.symbol}`
                        : 'No Tokens'
                    }
                  />
                  <StepNumberInput
                    title="MAX PRICE"
                    value={rangeMax}
                    onChange={setRangeMax}
                    stepFunction={logarithmStep}
                    min={rangeMin}
                    description={
                      tokenA && tokenB
                        ? `${tokenA.symbol} per ${tokenB.symbol}`
                        : 'No Tokens'
                    }
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
                    <div key={fee} className="button-primary card fee-type">
                      <h5 className="fee-title">{label}</h5>
                      <span className="fee-description">{description}</span>
                      <span className="pill fee-liquidity">
                        {calculateFeeLiquidity(label)}
                      </span>
                    </div>
                  )}
                />
              </div>
            )}
            {tabSelected === 'curve' && (
              <div>
                <div className="curve-card">
                  <div className="info">
                    Your liquidity will be distributed among different price
                    points (called ticks) in the shape of the liquidity curve.
                    This is represented by the yellow curve above.
                  </div>
                  <div className="card-row mt-4">
                    <RadioInput
                      className="button-switch-group"
                      value={slopeType}
                      list={slopeTypes}
                      onChange={setSlopeType}
                    />
                  </div>
                </div>
                <div className="precision-card mt-4">
                  <div className="card-header">
                    <h3 className="card-title">Precision {precision}</h3>
                    <StepNumberInput
                      editable={false}
                      min={2}
                      max={10}
                      value={precision}
                      onChange={setPrecision}
                    />
                    <button
                      type="button"
                      className="button-info ml-2"
                      onClick={() => setPrecision(defaultPrecision)}
                    >
                      Auto
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="page-card mx-auto">
            <div className="button-switch-group mx-auto mt-2 mb-4">
              <button
                type="button"
                className={[
                  'button',
                  'py-3',
                  'px-3',
                  tickSelected === -1 && 'button-primary',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setTickSelected(-1)}
              >
                All
              </button>
              {Array.from({ length: Number(precision) }).map((_, index) => {
                return (
                  <button
                    key={index}
                    type="button"
                    className={[
                      'button',
                      'py-3',
                      'px-3',
                      tickSelected === index && 'button-primary',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setTickSelected(index)}
                  >
                    {index + 1}
                  </button>
                );
              })}
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
      </form>
      <div className="spacer"></div>
    </>
  );
}

// calculates set from last siginificant digit (eg. 0.8 -> 0.9 -> 1 -> 2)
// todo: could respect trailing zeros is strings were passed
function logarithmStep(valueString: number, direction: number): number {
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
          .toNumber()
      : new BigNumber(10).exponentiatedBy(-denomExponent).toNumber()
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
        .toNumber();
}
