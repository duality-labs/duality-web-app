import { useEffect, useState, useCallback } from 'react';

import TokenPicker from '../../components/TokenPicker';
import TokenInputGroup from '../../components/TokenInputGroup';
import {
  useTokens,
  useExchangeRate,
  useDotCounter,
  Token,
} from '../../components/TokenPicker/mockHooks';

import './Pool.scss';

export default function Pool() {
  const [tokenA, setTokenA] = useState(undefined as Token | undefined);
  const [tokenB, setTokenB] = useState(undefined as Token | undefined);
  const swapTokens = useCallback(() => {
    setTokenA(tokenB);
    setTokenB(tokenA);
  }, [tokenA, tokenB]);
  const { data: rateData, isValidating: isValidatingRate } = useExchangeRate(
    tokenA,
    tokenB,
    '1'
  );
  const { data: tokenList = [], isValidating: isValidatingTokens } =
    useTokens();
  const dotCount = useDotCounter(0.25e3);

  // set token A to be first token in list if not already populated
  useEffect(() => {
    if (tokenList.length > 0 && !tokenA) {
      setTokenA(tokenList[0]);
    }
  }, [tokenA, tokenList]);

  const [rangeMin, setRangeMin] = useState('50');
  const [rangeMax, setRangeMax] = useState('50');
  const [values, setValues] = useState([0, 0]);
  const [totalValue, setTotalValue] = useState(2000);

  // update total value when rates or values change
  useEffect(() => {
    const rateAtoB = parseInt(rateData?.price || '0', 10);
    const totalValue = values[0] * rateAtoB + values[1];
    if (totalValue) {
      setTotalValue(totalValue);
    }
  }, [values, rateData]);

  // update values when rates or shape changes
  useEffect(() => {
    // get pair deposit amounts
    setValues(() => {
      const rateAtoB = parseInt(rateData?.price || '0', 10);
      const valueMin = parseInt(rangeMin);
      const valueMax = parseInt(rangeMax);
      if (rateAtoB > 0 && totalValue > 0) {
        const valueA = (totalValue * valueMin) / (valueMin + valueMax);
        const valueB = (totalValue * valueMax) / (valueMin + valueMax);
        return [valueA / rateAtoB, valueB];
      } else {
        return [0, 0];
      }
    });
  }, [totalValue, rateData, rangeMin, rangeMax]);
  return (
    <div className="pool-page">
      <h2 className="my-3 pt-1">Select Pair</h2>
      <TokenPicker
        value={tokenA}
        onChange={setTokenA}
        tokenList={tokenList}
        exclusion={tokenB}
      />
      <button className="mx-2 py-1 px-3" onClick={swapTokens}>
        {'<->'}
      </button>
      <TokenPicker
        value={tokenB}
        onChange={setTokenB}
        tokenList={tokenList}
        exclusion={tokenA}
      />
      <div className="card fee-group bg-slate-300 my-2 p-3 rounded-xl">
        <strong>0.3% fee tier</strong>
      </div>
      <h2 className="my-3 pt-1">Set price range</h2>
      <div className="card fee-group bg-slate-300 my-2 p-3 rounded-xl">
        {tokenA && tokenB ? (
          <span>
            Current Price: {rateData?.price || '...'} {tokenB.name} per{' '}
            {tokenA.name}
          </span>
        ) : (
          <span>Current Price:</span>
        )}
      </div>
      <div className="inline-block w-32 text-center">Minimum tick</div>
      <div className="inline-block w-32 text-center">Maximum tick</div>
      <br />
      <input
        className="w-32"
        type="range"
        min="0"
        max="100"
        value={rangeMin}
        onChange={(e) => setRangeMin(e.target.value)}
        step="10"
        style={{ transform: 'rotate(180deg)' }}
      ></input>
      <input
        className="w-32"
        type="range"
        min="0"
        max="100"
        value={rangeMax}
        onChange={(e) => setRangeMax(e.target.value)}
        step="10"
      ></input>
      <br />
      <input
        className="w-32 text-center"
        min="0"
        max="100"
        value={`${parseInt(rangeMin, 10) > 0 ? '-' : ''}${parseFloat(
          rangeMin
        ).toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })}%`}
        onChange={(e) => setRangeMin(e.target.value.replace(/\D/g, ''))}
        step="1"
      ></input>
      <input
        className="w-32 text-center"
        min="0"
        max="100"
        value={`${parseFloat(rangeMax).toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })}%`}
        onChange={(e) => setRangeMax(e.target.value.replace(/\D/g, ''))}
        step="1"
      ></input>
      <br />
      <input
        className="w-32 text-center"
        min="0"
        max="100"
        value={`${
          rateData?.price
            ? Math.round(
                parseInt(rateData?.price, 10) * (1 - parseFloat(rangeMin) / 100)
              )
            : ''
        } ${tokenB?.symbol} per ${tokenA?.symbol}`}
        onChange={(e) =>
          setRangeMin(
            (current) =>
              `${
                rateData?.price
                  ? (-parseInt(e.target.value.replace(/\D/g, ''), 10) /
                      parseInt(rateData?.price, 10)) *
                      100 +
                    100
                  : current
              }`
          )
        }
        step="1"
      ></input>
      <input
        className="w-32 text-center"
        min="0"
        max="100"
        value={`${
          rateData?.price
            ? Math.round(
                parseInt(rateData?.price, 10) * (1 + parseFloat(rangeMax) / 100)
              )
            : ''
        } ${tokenB?.symbol} per ${tokenA?.symbol}`}
        onChange={(e) =>
          setRangeMax(
            (current) =>
              `${
                rateData?.price
                  ? (parseInt(e.target.value.replace(/\D/g, ''), 10) /
                      parseInt(rateData?.price, 10)) *
                      100 -
                    100
                  : current
              }`
          )
        }
        step="1"
      ></input>
      <h2 className="my-3 pt-1">Deposit Amounts</h2>
      <TokenInputGroup
        readOnly
        tokenList={tokenList}
        token={tokenA}
        value={`${values[0]}`}
        onValueChanged={(valueA) =>
          setValues(([, valueB]) => [parseInt(valueA, 10), valueB])
        }
        exclusion={tokenB}
      ></TokenInputGroup>
      <TokenInputGroup
        readOnly
        tokenList={tokenList}
        token={tokenB}
        value={`${values[1]}`}
        onValueChanged={(valueB) =>
          setValues(([valueA]) => [valueA, parseInt(valueB, 10)])
        }
        exclusion={tokenA}
      ></TokenInputGroup>
      <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded m-auto block">
        Add Liquidity
      </button>
      {((isValidatingTokens || isValidatingRate) && '.'.repeat(dotCount)) || (
        <i className="text-transparent">.</i>
      )}
    </div>
  );
}
