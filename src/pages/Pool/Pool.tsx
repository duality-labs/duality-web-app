import { useEffect, useState, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowUpLong,
  faArrowDownLong,
} from '@fortawesome/free-solid-svg-icons';

import RadioInput from '../../components/RadioInput';
import RangeStepInput from '../../components/RangeStepInput';
import TokenInputGroup from '../../components/TokenInputGroup';
import {
  useTokens,
  useExchangeRate,
  Token,
} from '../../components/TokenPicker/mockHooks';

import './Pool.scss';
import { useIndexerPairData } from '../../lib/web3/indexerProvider';

const feeTypes: { [fee: string]: string } = {
  '0.01%': 'Best for very stable pairs.',
  '0.05%': 'Best for  stable pairs.',
  '0.30%': 'Best for most assets.',
  '1.00%': 'Best for exotic assets.',
};

const slopeTypes = ['UNIFORM', 'UP-SLOPE', 'BELL CURVE', 'DOWN-SLOPE'];

const calculateFeeLiquidity = function (fee: string) {
  const test: { [fee: string]: string } = {
    '0.01%': '1% liquidity',
    '0.05%': '9% liquidity',
    '0.30%': '83% liquidity',
    '1.00%': '7% liquidity',
  };
  return test[fee];
};

const defaultPrecision = 6;

export default function Pool() {
  const [tokenA, setTokenA] = useState(undefined as Token | undefined);
  const [tokenB, setTokenB] = useState(undefined as Token | undefined);
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

  const [rangeMin, setRangeMin] = useState(50);
  const [rangeMax, setRangeMax] = useState(50);
  const [values, setValues] = useState([0, 0]);
  const [totalValue, setTotalValue] = useState(2000);

  // update total value when rates or values change
  useEffect(() => {
    const rateAtoB = parseFloat(rateData?.price || '0');
    const totalValue = values[0] * rateAtoB + values[1];
    if (totalValue) {
      setTotalValue(totalValue);
    }
  }, [values, rateData]);

  // update values when rates or shape changes
  useEffect(() => {
    // get pair deposit amounts
    setValues(() => {
      const rateAtoB = parseFloat(rateData?.price || '0');
      const valueMin = rangeMin;
      const valueMax = rangeMax;
      if (rateAtoB > 0 && totalValue > 0) {
        const valueA = (totalValue * valueMin) / (valueMin + valueMax);
        const valueB = (totalValue * valueMax) / (valueMin + valueMax);
        return [valueA / rateAtoB, valueB];
      } else {
        return [0, 0];
      }
    });
  }, [totalValue, rateData, rangeMin, rangeMax]);

  /* const {
     data: { ticks } = {},
     error: ticksError,
     isValidating: tickFetching,
   } =*/ useIndexerPairData(tokenA?.address, tokenB?.address);

  const [fee, setFee] = useState<string>(Object.keys(feeTypes)[0]);
  const [editingFee, setEditingFee] = useState(false);
  const [slopeType, setSlopeType] = useState<string>();
  const [precision, setPrecision] = useState(defaultPrecision);

  useEffect(() => {
    setEditingFee(false);
  }, [fee]);

  return (
    <form onSubmit={(e) => e.preventDefault()} className="pool-page">
      <div className="assets-card page-card">
        <h3 className="card-header card-title">Assets</h3>
        <div className="card-row">
          <TokenInputGroup
            onValueChanged={(newValue) =>
              setValues(([, valueB]) => [Number(newValue), valueB])
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
              setValues(([valueA]) => [valueA, Number(newValue)])
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
      <div className="chart-card page-card"></div>
      <div className="fee-card page-card">
        <div className="card-header">
          <h3 className="card-title">Fee Tier</h3>
          <div className="badge-primary corner-border badge-large font-console ml-auto">
            {fee}
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
            <>
              <RadioInput value={fee} onChange={setFee}>
                {Object.entries(feeTypes).map(([fee, description]) => (
                  <div key={fee} className="panel fee-type px-2">
                    <h5 className="fee-title">{fee}</h5>
                    <span className="fee-description">{description}</span>
                    <span className="badge-primary-inverse pill mt-2">
                      {calculateFeeLiquidity(fee)}
                    </span>
                  </div>
                ))}
              </RadioInput>
            </>
          ) : (
            <>
              <span className="badge-info pill ml-auto badge-large text-slim fs-small mt-auto">
                {calculateFeeLiquidity(fee)}
              </span>
              <span className="badge-info pill ml-2 badge-large text-slim fs-small mt-auto">
                {feeTypes[fee]}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="precision-card page-card">
        <div className="card-header">
          <h3 className="card-title">Precision</h3>
          <RangeStepInput
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
        <h3 className="card-header card-title">Price Range</h3>
        <div className="card-row">
          <RangeStepInput
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
          <RangeStepInput
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
          <RadioInput value={slopeType} onChange={setSlopeType} rowSize={2}>
            {slopeTypes.map((type) => (
              <span key={type}>{type}</span>
            ))}
          </RadioInput>
        </div>
      </div>
      <div className="pool-options">
        <div className="card-row">
          <input
            type="submit"
            value="Pool"
            className="pill mx-auto px-5 py-3"
          />
        </div>
      </div>
    </form>
  );
}
