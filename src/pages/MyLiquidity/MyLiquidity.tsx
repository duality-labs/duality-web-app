import PoolsTableCard from '../../components/cards/PoolsTableCard';
import AssetsTableCard from '../../components/cards/AssetsTableCard';

import { useWeb3 } from '../../lib/web3/useWeb3';
import { useUserPositionsShareValue } from '../../lib/web3/hooks/useUserShareValues';
import { useUserBankValue } from '../../lib/web3/hooks/useUserBankValues';

import './MyLiquidity.scss';

export default function MyLiquidity() {
  return (
    <div className="my-liquidity-page container col flex gap-5 py-6">
      <Heading />
      <HeroCard />
      <Tables />
    </div>
  );
}

function Heading() {
  const { wallet, connectWallet } = useWeb3();
  return (
    <div className="row gap-5">
      <div className="col">
        <h1 className="h1 hero-text">Portfolio</h1>
      </div>
      {!wallet && (
        <div className="col flex-centered mt-2 pt-1">
          <button
            className="connect-wallet button-primary p-3 px-4"
            onClick={connectWallet}
          >
            Connect Wallet
          </button>
        </div>
      )}
    </div>
  );
}

function HeroCard() {
  const { wallet } = useWeb3();
  const allUserSharesValue = useUserPositionsShareValue();
  const allUserBankValue = useUserBankValue();
  return (
    <div className="page-card">
      <table className="hero-table simple-table gutter-b-1">
        <thead>
          <tr>
            <th style={{ width: '35%' }}>Total Assets</th>
            <th style={{ width: '35%' }}>Position Value</th>
            <th style={{ width: '25%' }}>Earned Incentives</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              {wallet
                ? `$${allUserBankValue.toNumber().toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                : '-'}
            </td>
            <td>
              {wallet
                ? `$${allUserSharesValue.toNumber().toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                : '-'}
            </td>
            <td>{wallet ? '$0' : '-'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Tables() {
  return (
    <div className="row flex gapx-4 gapy-5 flow-wrap">
      <div className="col flex">
        <AssetsTableCard />
      </div>
      <div className="col flex">
        <PoolsTableCard className="flex" title="My Pools" />
      </div>
    </div>
  );
}
