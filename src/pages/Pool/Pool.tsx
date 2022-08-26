import { useEffect, useState, useCallback, FormEvent } from 'react';
import BigNumber from 'bignumber.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeftLong,
  faArrowRightLong,
} from '@fortawesome/free-solid-svg-icons';

import { useIndexerPairData } from '../../lib/web3/indexerProvider';

import TokenPicker from '../../components/TokenPicker';
import TokenInputGroup from '../../components/TokenInputGroup';
import {
  useTokens,
  useExchangeRate,
  useDotCounter,
  Token,
} from '../../components/TokenPicker/mockHooks';

import './Pool.scss';
import { useDeposit } from './useDeposit';

const { REACT_APP__COIN_MIN_DENOM_EXP = '18' } = process.env;
const denomExponent = parseInt(REACT_APP__COIN_MIN_DENOM_EXP) || 0;
const denomRatio = new BigNumber(10).exponentiatedBy(denomExponent);
const defaultFee = '0.30';
const defaultPrice = '1';
const priceMin = new BigNumber(defaultPrice)
  .dividedBy(denomRatio)
  .toFixed(denomExponent);
const priceMax = new BigNumber(defaultPrice)
  .multipliedBy(denomRatio)
  .toFixed(0);
const defaultTokenAmount = '1000';

export default function Pool() {
  const [tokenA, setTokenA] = useState(undefined as Token | undefined);
  const [tokenB, setTokenB] = useState(undefined as Token | undefined);
  const [price, setPrice] = useState(() =>
    new BigNumber(defaultPrice).toFixed(denomExponent)
  );
  const [fee, setFee] = useState(defaultFee);
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
        new BigNumber(price),
        new BigNumber(fee),
        new BigNumber(values[0]),
        new BigNumber(values[0])
      );
    },
    [tokenA, tokenB, price, fee, values, sendDepositRequest]
  );

  return (
    <form className="pool-page card page-card my-4" onSubmit={onSubmit}>
      <h2 className="card-header card-title">Select Pair</h2>
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
        Use fee:{' '}
        <input
          className="w-1/2"
          type="number"
          min="0.01"
          max="1"
          step="0.01"
          value={fee}
          onChange={(e) => setFee(new BigNumber(e.target.value).toFixed(2))}
        ></input>
      </div>
      <h2 className="card-header card-title">Set price range</h2>
      <div className="fee-group">
        {tokenA && tokenB ? (
          <span>
            Current Price: {rateData?.price || '...'} {tokenB.name} per &nbsp;
            {tokenA.name}
          </span>
        ) : (
          <span>Current Price:</span>
        )}
        Use price:{' '}
        <input
          className="w-1/2"
          type="number"
          min={priceMin}
          max={priceMax}
          value={price}
          onChange={(e) =>
            setPrice(new BigNumber(e.target.value).toFixed(denomExponent))
          }
        ></input>
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
      <h2 className="card-header card-title">Deposit Amounts</h2>
      <TokenInputGroup
        disabled
        tokenList={tokenList}
        token={tokenA}
        value={values[0]}
        onValueChanged={(valueA) => setValues(([, valueB]) => [valueA, valueB])}
        exclusion={tokenB}
      ></TokenInputGroup>
      <TokenInputGroup
        disabled
        tokenList={tokenList}
        token={tokenB}
        value={values[1]}
        onValueChanged={(valueB) => setValues(([valueA]) => [valueA, valueB])}
        exclusion={tokenA}
      ></TokenInputGroup>
      {(isValidatingTokens || isValidatingRate) && (
        <div className="text-secondary card-row">{'.'.repeat(dotCount)}</div>
      )}
      <input type="submit" value="Add Liquidity" />
      <br />
      <div className="text-red-500">{!isValidatingDeposit && depositError}</div>
      <div className="text-sky-500">
        {!isValidatingDeposit && depositResponse
          ? `Deposited ${values[0]} ${tokenA?.address} for ${values[1]} ${tokenB?.address}`
          : ''}
      </div>
    </form>
  );
}
