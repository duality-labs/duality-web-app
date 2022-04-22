import { useCallback, useState } from 'react';
import TokenPicker from '../../components/TokenPicker';

export default function Swap() {
  const [tokenA, setTokenA] = useState(undefined as string | undefined);
  const [tokenB, setTokenB] = useState(undefined as string | undefined);
  const swapTokens = useCallback(() => {
    setTokenA(tokenB);
    setTokenB(tokenA);
  }, [tokenA, tokenB]);
  return (
    <div className="swap-page">
      <TokenPicker value={tokenA} onChange={setTokenA} />
      <button className="mx-2 py-1 px-3" onClick={swapTokens}>
        {'<->'}
      </button>
      <TokenPicker value={tokenB} onChange={setTokenB} />
    </div>
  );
}
