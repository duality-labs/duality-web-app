import { useMatch } from 'react-router-dom';

import { useTokenBySymbol } from '../../lib/web3/hooks/useTokens';

import OrderbookHeader from './OrderbookHeader';
import OrderbookFooter from './OrderbookFooter';
import OrderBookChart from './OrderbookChart';

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
  const tokenA = useTokenBySymbol(match?.params['tokenA']);
  const tokenB = useTokenBySymbol(match?.params['tokenB']);

  return (
    <div className="flex col gap-3">
      <div className="orderbook-header row">
        <OrderbookHeader tokenA={tokenA} tokenB={tokenB} />
      </div>
      <div className="orderbook-body row gap-3">
        <div className="flex col">
          <div className="flex page-card">
            {tokenA?.address === 'stake' && tokenB?.address === 'token' && (
              <OrderBookChart tokenA={tokenA} tokenB={tokenB} />
            )}
          </div>
        </div>
        <div className="col">
          <div className="flex page-card">Orderbook/Trades table</div>
        </div>
        <div className="col">
          <div className="flex page-card">Limit Order control</div>
        </div>
      </div>
      <div className="orderbook-footer row">
        <OrderbookFooter tokenA={tokenA} tokenB={tokenB} />
      </div>
    </div>
  );
}
