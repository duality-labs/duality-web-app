import TokenPairLogos from '../TokenPairLogos/TokenPairLogos';
import TableCard from '../../components/cards/TableCard';
import { Link } from 'react-router-dom';

import useTokens from '../../lib/web3/hooks/useTokens';
import { useUserDeposits } from '../../lib/web3/hooks/useUserShares';

export default function OrdersCard({
  size = 'large',
  limit = size === 'small' ? 5 : 0,
}: {
  size?: 'small' | 'large';
  limit?: number;
}) {
  const allTokens = useTokens();
  const limitOrders = useUserDeposits() || [];

  // show loken list cards
  return (
    <TableCard
      className="asset-list-card flex"
      title="Orders"
      headerActions={size === 'small' && <HeaderAction />}
    >
      <hr className="mb-4" />
      <table>
        <tbody>
          {limitOrders.length > 0 ? (
            limitOrders
              .slice(0, limit || undefined)
              .map(({ pairID }, index) => {
                const token0 = allTokens.find(
                  (token) => token.address === pairID.token0
                );
                const token1 = allTokens.find(
                  (token) => token.address === pairID.token1
                );
                if (!token0 || !token1) {
                  return null;
                }
                return (
                  <tr key={index}>
                    <td>
                      <div className="row gap-3">
                        <div className="col">
                          <TokenPairLogos tokenA={token0} tokenB={token1} />
                        </div>
                        <div className="col">
                          {token0.symbol} / {token1.symbol}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
          ) : (
            <tr>
              <td colSpan={3} align="center">
                No Pending Orders Found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </TableCard>
  );
}

function HeaderAction() {
  return (
    <Link to="/" className="button button-primary-outline">
      View Orders
    </Link>
  );
}
