import { useEffect, useState, useCallback, FormEvent } from 'react';
import BigNumber from 'bignumber.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowUpLong,
  faArrowDownLong,
} from '@fortawesome/free-solid-svg-icons';

import { useIndexerPairData } from '../../lib/web3/indexerProvider';

import RadioInput from '../../components/RadioInput';
import StepNumberInput from '../../components/StepNumberInput';

import TokenInputGroup from '../../components/TokenInputGroup';
import LiquiditySelector from '../../components/LiquiditySelector';

import {
  useTokens,
  useExchangeRate,
  Token,
} from '../../components/TokenPicker/mockHooks';

import './Pool.scss';
import { useDeposit } from './useDeposit';

const { REACT_APP__COIN_MIN_DENOM_EXP = '18' } = process.env;
const denomExponent = parseInt(REACT_APP__COIN_MIN_DENOM_EXP) || 0;
const denomRatio = new BigNumber(10).exponentiatedBy(denomExponent);
const defaultFee = '0.30%';
const defaultPrice = '1';
const defaultRangeMin = new BigNumber(defaultPrice)
  .dividedBy(denomRatio)
  .toFixed(denomExponent);
const defaultRangeMax = new BigNumber(defaultPrice)
  .multipliedBy(denomRatio)
  .toFixed(0);
const defaultTokenAmount = '1000';

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
  const feeLabel = feeType?.label || defaultFee;
  const swapTokens = useCallback(() => {
    setTokenA(tokenB);
    setTokenB(tokenA);
  }, [tokenA, tokenB]);
  const { data: rateData } = useExchangeRate(tokenA, tokenB, '1');
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
    new BigNumber(defaultTokenAmount)
      .dividedBy(denomRatio)
      .toFixed(denomExponent),
    new BigNumber(defaultTokenAmount)
      .dividedBy(denomRatio)
      .toFixed(denomExponent),
  ]);

  // update values when rates or shape changes
  useEffect(() => {
    // get pair deposit amounts
    setValues((values) => {
      const rateAtoB = parseFloat(rateData?.price || defaultPrice);
      const valueMin = new BigNumber(rangeMin);
      const valueMax = new BigNumber(rangeMax);
      const totalValue = new BigNumber(values[0])
        .multipliedBy(rateAtoB)
        .plus(values[1]);
      if (rateAtoB > 0 && new BigNumber(totalValue).isGreaterThan(0)) {
        const valueA = valueMin
          .multipliedBy(totalValue)
          .dividedBy(valueMin.plus(valueMax));
        const valueB = valueMax
          .multipliedBy(totalValue)
          .dividedBy(valueMin.plus(valueMax));
        return [
          valueA.dividedBy(rateAtoB).toFixed(denomExponent),
          valueB.toFixed(denomExponent),
        ];
      } else {
        return ['0', '0'];
      }
    });
  }, [rateData, rangeMin, rangeMax]);

  const {
    data: { ticks } = {},
    error: ticksError,
    isValidating: tickFetching,
  } = useIndexerPairData(tokenA?.address, tokenB?.address);

  const [editingFee, setEditingFee] = useState(false);
  const [slopeType, setSlopeType] = useState<string>();
  const [precision, setPrecision] = useState<string>(defaultPrecision);

  useEffect(() => {
    setEditingFee(false);
  }, [feeLabel]);

  const [
    {
      data: depositResponse,
      isValidating: isValidatingDeposit,
      error: depositError,
    },
    sendDepositRequest,
  ] = useDeposit();
  const onSubmit = useCallback(
    async function (e: FormEvent<HTMLFormElement>) {
      e.preventDefault();
      if (feeType?.fee)
        await sendDepositRequest(
          tokenA,
          tokenB,
          new BigNumber(rangeMin),
          new BigNumber(feeType.fee),
          new BigNumber(values[0]),
          new BigNumber(values[1])
        );
    },
    [tokenA, tokenB, rangeMin, feeType, values, sendDepositRequest]
  );

  return (
    <>
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
        </div>
        <div className="chart-card page-card">
          <LiquiditySelector
            tickCount={parseInt(precision) || 1}
            ticks={ticks}
            feeTier={feeType?.fee}
          ></LiquiditySelector>
        </div>
        <div className="fee-card page-card">
          <div className="card-header">
            <h3 className="card-title">Fee Tier</h3>
            <div className="badge-primary corner-border badge-large font-console ml-auto">
              {feeLabel}
            </div>
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
                OptionComponent={({ option: { fee, label, description } }) => (
                  <div key={fee} className="badge card fee-type">
                    <h5 className="fee-title">{label}</h5>
                    <span className="fee-description">{description}</span>
                    <span className="badge fee-liquidity">
                      {calculateFeeLiquidity(label)}
                    </span>
                  </div>
                )}
              />
            ) : (
              <>
                <span className="badge-info pill ml-auto badge-large text-slim fs-s mt-auto">
                  {calculateFeeLiquidity(feeLabel)}
                </span>
                <span className="badge-info pill ml-2 badge-large text-slim fs-s mt-auto">
                  {feeLabel}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="precision-card page-card">
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
        <div className="price-card page-card">
          <h3 className="card-header">Price Range</h3>
          <div className="card-row">
            <StepNumberInput
              title="MIN PRICE"
              value={rangeMin}
              onChange={setRangeMin}
              step={defaultRangeMin}
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
              min={rangeMin}
              description={
                tokenA && tokenB
                  ? `${tokenA.symbol} per ${tokenB.symbol}`
                  : 'No Tokens'
              }
            />
          </div>
        </div>
        <div className="curve-card page-card">
          <h3 className="card-header card-title">Liquidity Curve</h3>
          <div className="card-row">
            <RadioInput
              value={slopeType}
              list={slopeTypes}
              onChange={setSlopeType}
              maxColumnCount={2}
            />
          </div>
        </div>
        <div className="pool-options">
          <div className="card-row">
            {(tickFetching || isValidatingDeposit) && (
              <div className="text-secondary card-row">...</div>
            )}
            <input
              className="pill mx-auto px-5 py-3"
              type="submit"
              value="Add Liquidity"
            />
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
    </>
  );
}
