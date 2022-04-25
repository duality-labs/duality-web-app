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
  const { isValidating: isValidatingRate } = useExchangeRate(tokenA || '', 0);
  const { data: tokenList = [], isValidating: isValidaingTokens } = useTokens();
  const dotCount = useDotCounter(0.25e3);

  // set token A to be first token in list if not already populated
  useEffect(() => {
    if (tokenList.length > 0 && !tokenA) {
      setTokenA(tokenList[0]);
    }
  }, [tokenA, tokenList]);

  return (
    <div className="pool-page">
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
      <TokenInputGroup
        readOnly
        tokenList={tokenList}
        token={tokenA}
        value="0"
        exclusion={tokenB}
      ></TokenInputGroup>
      <TokenInputGroup
        readOnly
        tokenList={tokenList}
        token={tokenB}
        value="0"
        exclusion={tokenA}
      ></TokenInputGroup>
      <button
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded m-auto block"
        onClick={() => swapTokens()}
      >
        Swap
      </button>
      {((isValidaingTokens || isValidatingRate) && '.'.repeat(dotCount)) || (
        <i className="text-transparent">.</i>
      )}
    </div>
  );
}
