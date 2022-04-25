import { useEffect, useState, useCallback } from 'react';

import TokenPicker from '../../components/TokenPicker';
import TokenInputGroup from '../../components/TokenInputGroup';
import {
  useTokens,
  useExchangeRate,
  useDotCounter,
} from '../../components/TokenPicker/mockHooks';

import './Pool.scss';

export default function Pool() {
  const [tokenA, setTokenA] = useState(undefined as string | undefined);
  const [tokenB, setTokenB] = useState(undefined as string | undefined);
  const swapTokens = useCallback(() => {
    setTokenA(tokenB);
    setTokenB(tokenA);
  }, [tokenA, tokenB]);
  const { data: rateData, isValidating: isValidatingRate } = useExchangeRate(
    '100',
    0
  );
  const { data: tokenList = [], isValidating: isValidaingTokens } = useTokens();
  const dotCount = useDotCounter(0.25e3);

  // set token A to be first token in list if not already populated
  useEffect(() => {
    if (tokenList.length > 0 && !tokenA) {
      setTokenA(tokenList[0]);
    }
  }, [tokenA, tokenList]);

  const [rangeMin, setRangeMin] = useState('3');
  const [rangeMax, setRangeMax] = useState('3');
  const [values, setValues] = useState([1, 1]);
  useEffect(() => {
    // get pair deposit amounts
    setValues([
      parseInt(rangeMin) * Math.random(),
      parseInt(rangeMax) * Math.random(),
    ]);
  }, [rangeMin, rangeMax]);
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
            Current Price: {rateData?.price} {tokenA} per {tokenB}
          </span>
        ) : (
          <span>Current Price:</span>
        )}
      </div>
      <input
        type="range"
        min="0"
        max="10"
        value={rangeMin}
        onChange={(e) => setRangeMin(e.target.value)}
        step="1"
        style={{ transform: 'rotate(180deg)' }}
      ></input>
      <input
        type="range"
        min="0"
        max="10"
        value={rangeMax}
        onChange={(e) => setRangeMax(e.target.value)}
        step="1"
      ></input>
      <h2 className="my-3 pt-1">Deposit Amounts</h2>
      <TokenInputGroup
        readOnly
        tokenList={tokenList}
        token={tokenA}
        value={`${values[0]}`}
        exclusion={tokenB}
      ></TokenInputGroup>
      <TokenInputGroup
        readOnly
        tokenList={tokenList}
        token={tokenB}
        value={`${values[1]}`}
        exclusion={tokenA}
      ></TokenInputGroup>
      <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded m-auto block">
        Add Liquidity
      </button>
      {((isValidaingTokens || isValidatingRate) && '.'.repeat(dotCount)) || (
        <i className="text-transparent">.</i>
      )}
    </div>
  );
}
