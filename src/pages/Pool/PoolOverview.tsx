import { useCallback } from 'react';
import PoolLayout from './PoolLayout';
import { Token } from '../../lib/web3/utils/tokens';
import { useCurrentPriceFromTicks } from '../../components/LiquiditySelector/useCurrentPriceFromTicks';

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

  const currentPriceFromTicks = useCurrentPriceFromTicks(
    tokenA?.address,
    tokenB?.address
  );

  const edgePrice = currentPriceFromTicks;

  return (
    <PoolLayout tokenA={tokenA} tokenB={tokenB} swap={swap}>
      <div>
        Subheader price: {edgePrice?.toNumber() || '1'}
        <Link to={`/pools/${tokenA.symbol}/${tokenB.symbol}/manage`}>
          <button className="button button-primary py-3 px-md">
            New Position
          </button>
        </Link>
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
