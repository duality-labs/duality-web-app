import { Token } from '../../lib/web3/utils/tokens';
import useTransactionTableData from '../Pool/hooks/useTransactionTableData';

export default function OrderbookFooter({
  tokenA,
  tokenB,
}: {
  tokenA?: Token;
  tokenB?: Token;
}) {
  return (
    <div className="page-card flex">
      <div className="row flex-centered mb-lg">
        <div className="col">
          <div className="row flex-centered gap-lg">
            <h4 className="h4">Orders</h4>
          </div>
        </div>
        <div className="col ml-auto">Card Nav right</div>
      </div>
      <div className="row">
        {tokenA && tokenB && (
          <OrderbookFooterTable tokenA={tokenA} tokenB={tokenB} />
        )}
      </div>
    </div>
  );
}

const pageSize = 10;
function OrderbookFooterTable({
  tokenA,
  tokenB,
}: {
  tokenA: Token;
  tokenB: Token;
}) {
  useTransactionTableData({
    tokenA,
    tokenB,
    action: 'PlaceLimitOrder',
    pageSize,
  });
  return <div>Table</div>;
}
