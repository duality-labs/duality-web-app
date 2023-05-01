import FeaturedPairsCard from '../../components/cards/FeaturedPairsCard';
import OrdersCard from '../../components/cards/OrdersCard';

export default function TradePage() {
  return (
    <div className="container col flex py-5">
      <div className="row gapx-4 gapy-5 flow-wrap">
        <FeaturedPairsCard />
        <OrdersCard size="small" />
      </div>
    </div>
  );
}
