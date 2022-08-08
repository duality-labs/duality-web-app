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
const defaultFee = '0.30';
const defaultPrice = '1';
const defaultRangeMin = new BigNumber(defaultPrice)
  .dividedBy(denomRatio)
  .toFixed(denomExponent);
const defaultRangeMax = new BigNumber(defaultPrice)
  .multipliedBy(denomRatio)
  .toFixed(0);
const defaultTokenAmount = '1000';

const feeTypes: Array<{ fee: string, description: string }> = Object.entries({
  '0.01': 'Best for very stable pairs.',
  '0.05': 'Best for  stable pairs.',
  '0.30': 'Best for most assets.',
  '1.00': 'Best for exotic assets.',
}).map(([fee, description]) => ({ fee, description }));

const slopeTypes = ['UNIFORM', 'UP-SLOPE', 'BELL CURVE', 'DOWN-SLOPE'];

const calculateFeeLiquidity = function (fee: string) {
  const test: { [fee: string]: string } = {
    '0.01': '1% liquidity',
    '0.05': '9% liquidity',
    '0.30': '83% liquidity',
    '1.00': '7% liquidity',
  };
  return test[fee];
};

const defaultPrecision = '6';

export default function Pool() {
  const [tokenA, setTokenA] = useState(undefined as Token | undefined);
  const [tokenB, setTokenB] = useState(undefined as Token | undefined);
  const [feeType, setFeeType] = useState<{ fee: string, description: string }|undefined>(() => feeTypes.find(({ fee }) => fee === defaultFee));
  const fee = feeType?.fee || defaultFee;
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
  }, [fee]);

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
      await sendDepositRequest(
        tokenA,
        tokenB,
        new BigNumber(rangeMin),
        new BigNumber(fee),
        new BigNumber(values[0]),
        new BigNumber(values[0])
      );
    },
    [tokenA, tokenB, rangeMin, fee, values, sendDepositRequest]
  );

  return (
    <form className="pool-page" onSubmit={onSubmit}>
      <div className="assets-card page-card">
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
            className="icon-button swap-button"
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
        <div>
          Ticks: {tickFetching ? 'loading...' : ''} &nbsp;
          {JSON.stringify(ticks, null, 2)}
        </div>
      </div>
      <div className="chart-card page-card"></div>
      <div className="fee-card page-card">
        <div className="card-row">
          <h3 className="card-title">Fee Tier</h3>
          <div className="badge badge-4">{fee}</div>
          <button
            type="button"
            className="badge badge-4 badge-secondary"
            onClick={() => setEditingFee((mode) => !mode)}
          >
            {editingFee ? 'Hide' : 'Edit'}
          </button>
        </div>
        <div className="card-row">
          {editingFee ? (
            <RadioInput<{ fee: string, description: string }>
              value={feeType}
              list={feeTypes}
              onChange={setFeeType}
              OptionComponent={({ option: { fee, description } }) =>
                <div key={fee} className="badge">
                  <span>{description}</span>
                  <span className="badge">{calculateFeeLiquidity(fee)}</span>
                </div>
              }
            />
          ) : (
            <>
              <span className="badge badge-2 badge-info">
                {calculateFeeLiquidity(fee)}
              </span>
              <span className="badge badge-2 badge-info">{fee}</span>
            </>
          )}
        </div>
      </div>
      <div className="precision-card page-card">
        <div className="card-row">
          <h3 className="card-title">Precision</h3>
          <StepNumberInput
            editable={false}
            min={2}
            max={10}
            value={precision}
            onChange={setPrecision}
          />
          <button
            type="button"
            className="badge badge-info"
            onClick={() => setPrecision(defaultPrecision)}
          >
            Auto
          </button>
        </div>
      </div>
      <div className="price-card page-card">
        <h3 className="card-title">Price Range</h3>
        <div className="card-row">
          <StepNumberInput
            title="MIN PRICE"
            value={rangeMin}
            onChange={setRangeMin}
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
        <h3 className="card-title">Liquidity Curve</h3>
        <div className="card-row">
          <RadioInput
            value={slopeType}
            list={slopeTypes}
            onChange={setSlopeType}
          />
        </div>
      </div>
      <div className="pool-options">
        <div className="card-row">
          {(tickFetching || isValidatingDeposit) && (
            <div className="text-secondary card-row">...</div>
          )}
          <input type="submit" value="Add Liquidity" />
          <br />
          <div className="text-red-500">{!isValidatingDeposit && ticksError}</div>
          <div className="text-red-500">{!isValidatingDeposit && depositError}</div>
          <div className="text-sky-500">
            {!isValidatingDeposit && depositResponse
              ? `Deposited ${depositResponse.receivedTokenA} ${tokenA?.address} and ${depositResponse.receivedTokenB} ${tokenB?.address}`
              : ''}
          </div>
        </div>
      </div>
    </form>
  );
}
