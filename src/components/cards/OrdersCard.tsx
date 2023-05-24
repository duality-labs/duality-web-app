import { useMemo } from 'react';
import useShareValueMap, {
  ShareValue,
} from '../../pages/MyLiquidity/useShareValueMap';

import TokenPairLogos from '../TokenPairLogos/TokenPairLogos';
import TableCard from '../../components/cards/TableCard';
import { Link } from 'react-router-dom';

export default function OrdersCard({
  size = 'large',
  limit = size === 'small' ? 5 : 0,
}: {
  size?: 'small' | 'large';
  limit?: number;
}) {
  const shareValueMap = useShareValueMap();

  // todo: fetch real limit orders from tx history
  const limitOrders = useMemo<ShareValue[]>(() => {
    // collect all tokens noted in each share
    const list = Object.values(shareValueMap || {}).flat();
    // return unique tokens
    return list;
  }, [shareValueMap]);

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
              .map(({ token0, token1 }, index) => {
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
