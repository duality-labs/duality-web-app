import { useEffect, useState, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeftLong,
  faArrowRightLong,
} from '@fortawesome/free-solid-svg-icons';

import TokenPicker from '../../components/TokenPicker';
import TokenInputGroup from '../../components/TokenInputGroup';
import {
  useTokens,
  useExchangeRate,
  useDotCounter,
  Token,
} from '../../components/TokenPicker/mockHooks';

import './Pool.scss';
import { useIndexerPairData } from '../../lib/web3/indexerProvider';

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

  const {
    data: { ticks } = {},
    error: ticksError,
    isValidating: tickFetching,
  } = useIndexerPairData(tokenA?.address, tokenB?.address);

  return (
    <form className="pool-page page-card my-4">
      <h2 className="card-title">Select Pair</h2>
      <div className="card-row">
        <TokenPicker
          value={tokenA}
          onChange={setTokenA}
          tokenList={tokenList}
          exclusion={tokenB}
        />
        <button
          type="button"
          onClick={swapTokens}
          className="icon-button m-auto"
        >
          <FontAwesomeIcon icon={faArrowLeftLong}></FontAwesomeIcon>
          <FontAwesomeIcon icon={faArrowRightLong}></FontAwesomeIcon>
        </button>
        <TokenPicker
          value={tokenB}
          onChange={setTokenB}
          tokenList={tokenList}
          exclusion={tokenA}
        />
      </div>
      <div>
        Ticks: {tickFetching ? 'loading...' : ''} &nbsp;
        {JSON.stringify(ticks, null, 2)}
      </div>
      {ticksError && (
        <div>
          TickFetch Error: <span style={{ color: 'red' }}>{ticksError}</span>
        </div>
      )}
      <div className="fee-group">
        <strong>0.3% fee tier</strong>
      </div>
      <h2 className="card-title">Set price range</h2>
      <div className="fee-group">
        {tokenA && tokenB ? (
          <span>
            Current Price: {rateData?.price || '...'} {tokenB.name} per &nbsp;
            {tokenA.name}
          </span>
        ) : (
          <span>Current Price:</span>
        )}
      </div>
      <br />
      <div>Minimum tick</div>
      <div>Maximum tick</div>
      <br />
      <input
        type="range"
        min="0"
        max="100"
        value={rangeMin}
        onChange={(e) => setRangeMin(e.target.value)}
        step="10"
        style={{ transform: 'rotate(180deg)' }}
      ></input>
      <input
        type="range"
        min="0"
        max="100"
        value={rangeMax}
        onChange={(e) => setRangeMax(e.target.value)}
        step="10"
      ></input>
      <br />
      <input
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
      <h2 className="card-title">Deposit Amounts</h2>
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
      {(isValidatingTokens || isValidatingRate) && (
        <div className="text-secondary card-row">{'.'.repeat(dotCount)}</div>
      )}
      <input type="submit" value="Add Liquidity" />
    </form>
  );
}
