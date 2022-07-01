import { useEffect, useState, useCallback } from 'react';

import TokenPicker from '../../components/TokenPicker';
import TokenInputGroup from '../../components/TokenInputGroup';
import {
  useTokens,
  useExchangeRate,
  useDotCounter,
  Token,
} from '../../components/TokenPicker/mockHooks';

import { queryClient } from '../../generated/duality/duality.duality/module/index';
import { DualityQueryAllTickResponse } from '../../generated/duality/duality.duality/module/rest';

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

  const [ticks, setTicks] = useState<DualityQueryAllTickResponse['tick']>();
  const [tickFetching, setTickFetching] = useState<boolean>(false);
  const [ticksError, setTicksError] = useState<string>();
  useEffect(() => {
    let cancel = false;
    tokenA &&
      tokenB &&
      (async () => {
        try {
          const client = await queryClient({ addr: 'http://localhost:1317' });
          const [token0, token1] = [tokenA, tokenB].sort((a, b) =>
            (a?.address ?? '').localeCompare(b?.address ?? '')
          );
          // accumulate ticks by looping through result pages
          setTicks(undefined);
          setTickFetching(true);
          setTicksError(undefined);
          let result: DualityQueryAllTickResponse | undefined;
          do {
            result = await client
              .queryTickAll({
                'pagination.limit': '100',
                'pagination.key': result?.pagination?.next_key,
                token0: token0?.address,
                token1: token1?.address,
              })
              .then((response) => response.data);
            // append to ticks
            if (!cancel && result?.tick) {
              const { tick } = result;
              setTicks((ticks = []) => ticks?.concat(tick));
            }
          } while (!cancel && result?.pagination?.next_key);
        } catch (e) {
          if (!cancel) setTicksError(`${e}`);
        }
        if (!cancel) setTickFetching(false);
      })();
    return () => {
      cancel = true;
      setTickFetching(false);
    };
  }, [tokenA, tokenB]);

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
      <div>
        Ticks: {tickFetching ? 'loading...' : ''} {JSON.stringify(ticks)}
      </div>
      <div>
        TickFetch Error: <span style={{ color: 'red' }}>{ticksError}</span>
      </div>
      <div className="card fee-group bg-slate-300 my-2 p-3 rounded-xl">
        <strong>0.3% fee tier</strong>
      </div>
      <h2 className="mt-4 mb-3 pt-1">Set price range</h2>
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
      <br />
      <div className="inline-block w-1/2 text-center">Minimum tick</div>
      <div className="inline-block w-1/2 text-center">Maximum tick</div>
      <br />
      <input
        className="w-1/2"
        type="range"
        min="0"
        max="100"
        value={rangeMin}
        onChange={(e) => setRangeMin(e.target.value)}
        step="10"
        style={{ transform: 'rotate(180deg)' }}
      ></input>
      <input
        className="w-1/2"
        type="range"
        min="0"
        max="100"
        value={rangeMax}
        onChange={(e) => setRangeMax(e.target.value)}
        step="10"
      ></input>
      <br />
      <input
        className="w-1/2 text-center"
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
        className="w-1/2 text-center"
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
        className="w-1/2 text-center"
        min="0"
        max="100"
        value={
          tokenA && tokenB
            ? `${
                rateData?.price
                  ? Math.round(
                      parseFloat(rateData?.price) *
                        (1 - parseFloat(rangeMin) / 100)
                    )
                  : ''
              } ${tokenB?.symbol} per ${tokenA?.symbol}`
            : ''
        }
        onChange={(e) =>
          setRangeMin(
            (current) =>
              `${
                rateData?.price
                  ? (-parseInt(e.target.value.replace(/\D/g, ''), 10) /
                      parseFloat(rateData?.price)) *
                      100 +
                    100
                  : current
              }`
          )
        }
        step="1"
      ></input>
      <input
        className="w-1/2 text-center"
        min="0"
        max="100"
        value={
          tokenA && tokenB
            ? `${
                rateData?.price
                  ? Math.round(
                      parseFloat(rateData?.price) *
                        (1 + parseFloat(rangeMax) / 100)
                    )
                  : ''
              } ${tokenB?.symbol} per ${tokenA?.symbol}`
            : ''
        }
        onChange={(e) =>
          setRangeMax(
            (current) =>
              `${
                rateData?.price
                  ? (parseInt(e.target.value.replace(/\D/g, ''), 10) /
                      parseFloat(rateData?.price)) *
                      100 -
                    100
                  : current
              }`
          )
        }
        step="1"
      ></input>
      <h2 className="mt-4 mb-3 pt-1">Deposit Amounts</h2>
      <TokenInputGroup
        disabled
        tokenList={tokenList}
        token={tokenA}
        value={`${values[0]}`}
        onValueChanged={(valueA) =>
          setValues(([, valueB]) => [parseInt(valueA, 10), valueB])
        }
        exclusion={tokenB}
      ></TokenInputGroup>
      <TokenInputGroup
        disabled
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
