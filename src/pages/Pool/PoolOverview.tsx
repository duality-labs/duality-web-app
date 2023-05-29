import { useCallback } from 'react';
import PoolLayout from './PoolLayout';
import { Token } from '../../lib/web3/utils/tokens';
import PriceCard, { PriceCardRow } from '../../components/cards/PriceCard';

import './Pool.scss';
import { Link } from 'react-router-dom';

export default function PoolOverview({
  tokenA,
  tokenB,
  setTokens,
}: {
  tokenA: Token;
  tokenB: Token;
  setTokens: ([tokenA, tokenB]: [Token?, Token?]) => void;
}) {
  const swap = useCallback(() => {
    setTokens([tokenB, tokenA]);
  }, [tokenA, tokenB, setTokens]);

  return (
    <PoolLayout tokenA={tokenA} tokenB={tokenB} swap={swap}>
      <div className="row mt-3 mb-xl">
        <div className="col">
          <PriceCardRow>
            <PriceCard tokenA={tokenA} tokenB={tokenB} />
            <PriceCard tokenA={tokenB} tokenB={tokenA} />
          </PriceCardRow>
        </div>
        <div className="col ml-auto">
          <Link to={`/pools/${tokenA.symbol}/${tokenB.symbol}/manage`}>
            <button className="button button-primary py-3 px-md">
              New Position
            </button>
          </Link>
        </div>
      </div>
      <div className="row gap-4 my-3">
        <div className="col flex gap-4">
          <div className={'overview-card col'}>Body</div>
          <div className="col pt-lg col-lg-hide">Sidebar 1a</div>
          <div className="page-card">Table</div>
          <div className="col pt-lg col-lg-hide">Sidebar 1b</div>
        </div>
        <div className="col col-lg col--left gap-4">Sidebar 2</div>
      </div>
    </PoolLayout>
  );
}
