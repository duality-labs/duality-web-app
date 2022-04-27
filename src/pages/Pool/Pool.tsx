import { useEffect, useState, useCallback } from 'react';

import TokenPicker from '../../components/TokenPicker';
import TokenInputGroup from '../../components/TokenInputGroup';
import LiquiditySelector from '../../components/LiquiditySelector';

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
  const [existingTicks, setExistingTicks] = useState([
    [20, 15, 0, 1],
    [24, 11, 0, 1],
    [30, 17, 0, 1],
    [32, 19, 0, 1],
    [37, 15, 0, 1],
    [39, 10, 0, 1],
    [40, 4, 14, 1],
    [43, 0, 10, 1],
    [45, 0, 18, 1],
    [47, 0, 8, 1],
    [48, 0, 17, 1],
    [50, 0, 12, 1],
    [53, 0, 14, 1],
    [55, 0, 13, 1],
    [56, 0, 5, 1],
  ] as Array<[number, number, number, number]>);
  const [backgrounds, setBackgrounds] = useState(false);

  // set token A to be first token in list if not already populated
  useEffect(() => {
    if (tokenList.length > 0 && !tokenA) {
      setTokenA(tokenList[0]);
    }
  }, [tokenA, tokenList]);

  useEffect(() => {
    console.log('existingTicks', existingTicks);
  }, [existingTicks]);

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
      <div className="flex flex-row">
        <div className="basis-1/2 w-32">
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
            className="w-32"
            type="range"
            min="0"
            max="10"
            value={rangeMin}
            onChange={(e) => setRangeMin(e.target.value)}
            step="1"
            style={{ transform: 'rotate(180deg)' }}
          ></input>
          <input
            className="w-32"
            type="range"
            min="0"
            max="10"
            value={rangeMax}
            onChange={(e) => setRangeMax(e.target.value)}
            step="1"
          ></input>
          <br />
          <input
            className="w-32 text-center"
            min="0"
            max="10"
            value={rangeMin}
            onChange={(e) => setRangeMin(e.target.value)}
            step="1"
          ></input>
          <input
            className="w-32 text-center"
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
          {((isValidaingTokens || isValidatingRate) &&
            '.'.repeat(dotCount)) || <i className="text-transparent">.</i>}
        </div>
        <div className="basis-1/2 w-32">
          <LiquiditySelector
            tickCount={parseInt(rangeMin)}
            existingTicks={existingTicks}
            backgrounds={backgrounds}
          ></LiquiditySelector>
          <div className="mock-controls">
            <button onClick={() => setExistingTicks(buy(10))}>Buy 10</button>
            <button onClick={() => setExistingTicks(buy(1))}>Buy 1</button>
            <button onClick={() => setExistingTicks(sell(1))}>Sell 1</button>
            <button onClick={() => setExistingTicks(sell(10))}>Sell 10</button>
            <br />
            <button onClick={() => setBackgrounds((value) => !value)}>
              Toggle tick backgrounds
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type Tick = [number, number, number, number];
type Ticks = Array<Tick>;

function sell(units: number) {
  return (existingTicks: Ticks): Ticks => {
    let toSell = units;
    return existingTicks.map(([rate, valueA, valueB, fee]) => {
      if (toSell > 0 && valueB > 0) {
        const swap = Math.min(valueB, toSell);
        toSell -= swap;
        return [rate, valueA + swap, valueB - swap, fee] as Tick;
      }
      return [rate, valueA, valueB, fee] as Tick;
    });
  };
}
function buy(units: number) {
  return (existingTicks: Ticks): Ticks => {
    let toBuy = units;
    return existingTicks
      .slice()
      .reverse()
      .map(([rate, valueA, valueB, fee]) => {
        if (toBuy > 0 && valueA > 0) {
          const swap = Math.min(valueA, toBuy);
          toBuy -= swap;
          return [rate, valueA - swap, valueB + swap, fee] as Tick;
        }
        return [rate, valueA, valueB, fee] as Tick;
      })
      .reverse();
  };
}
