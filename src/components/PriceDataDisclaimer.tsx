import { useHasPriceData } from '../lib/tokenPrices';
import { Token } from './TokenPicker/hooks';

export default function PriceDataDisclaimer({
  tokenA,
  tokenB,
}: {
  tokenA: Token;
  tokenB: Token;
}) {
  const hasPriceData = useHasPriceData([tokenA, tokenB]);

  return !hasPriceData ? null : (
    <div className="attribution">
      Price data from{' '}
      <a target="_blank" rel="noreferrer" href="https://www.coingecko.com/">
        CoinGecko
      </a>
    </div>
  );
}
