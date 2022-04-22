import { useState } from 'react';
import TokenPicker from '../../components/TokenPicker';

export default function Swap() {
  const [tokenA, setTokenA] = useState(undefined as string | undefined);
  return (
    <div className="swap-page">
      <TokenPicker value={tokenA} onChange={setTokenA} />
    </div>
  );
}
