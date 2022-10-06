import { Link } from 'react-router-dom';
import { useBankBalances } from '../../lib/web3/indexerProvider';
import { useWeb3 } from '../../lib/web3/useWeb3';

import './MyLiquidity.scss';

export default function MyLiquidity() {
  const { wallet } = useWeb3();
  const { data: balances, isValidating } = useBankBalances();

  if (!wallet || (!isValidating && (!balances || balances.length === 0))) {
    return (
      <div className="no-liquidity col">
        <h3 className='h2 mb-4 text-center'> No liquidity positions found</h3>
        <Link to="/add-liquidity">
          <button className="button button-info add-liquidity p-3 px-4">
            Add new liquidity
          </button>
        </Link>
      </div>
    );
  }

  return <div>Coming Soon</div>;
}
