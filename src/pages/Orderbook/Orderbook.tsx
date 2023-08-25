import { useMemo } from 'react';
import { useMatch } from 'react-router-dom';

import { getTokenBySymbol } from '../../lib/web3/hooks/useTokens';
import { Token } from '../../lib/web3/utils/tokens';

import OrderbookHeader from './OrderbookHeader';

import './Orderbook.scss';

export default function OrderbookPage() {
  return (
    <div className="container flex row">
      <div className="page orderbook-page flex col my-5">
        <Orderbook />
      </div>
    </div>
  );
}

function Orderbook() {
  // change tokens to match pathname
  const match = useMatch('/orderbook/:tokenA/:tokenB');

  const [tokenA, tokenB] = useMemo<[Token?, Token?]>(() => {
    if (match) {
      const tokenA = getTokenBySymbol(match.params['tokenA']);
      const tokenB = getTokenBySymbol(match.params['tokenB']);
      return [tokenA, tokenB];
    }
    return [];
  }, [match]);

  return (
    <div className="flex col gap-3">
      <div className="row">
        <OrderbookHeader tokenA={tokenA} tokenB={tokenB} />
      </div>
      <div className="flex row gap-3">
        <div className="flex col">
          <div className="flex page-card">left</div>
        </div>
        <div className="col">
          <div className="flex page-card">center</div>
        </div>
        <div className="col">
          <div className="flex page-card">right</div>
        </div>
      </div>
      <div className="row">
        <div className="page-card flex">
          <div className="row flex-centered mb-lg">
            <div className="col">
              <div className="row flex-centered gap-lg">
                <h4 className="h4">Orders</h4>
                <div>Hide other pairs</div>
              </div>
            </div>
            <div className="col ml-auto">Card Nav right</div>
          </div>
          <div className="row">
            <div>Table</div>
          </div>
        </div>
      </div>
    </div>
  );
}
