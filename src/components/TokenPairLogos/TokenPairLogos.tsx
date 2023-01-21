import { Token } from '../TokenPicker/hooks';

import './TokenPairLogos.scss';

function TokenLogo({ token: { symbol, logo_URIs } }: { token: Token }) {
  return (
    <img
      className="token-pair-logo"
      alt={`${symbol} logo`}
      src={logo_URIs?.svg ?? logo_URIs?.png}
    />
  );
}

export default function TokenPairLogos({
  tokenA,
  tokenB,
}: {
  tokenA: Token;
  tokenB: Token;
}) {
  return (
    <div className="token-pair-logos">
      <TokenLogo token={tokenA} />
      <TokenLogo token={tokenB} />
    </div>
  );
}
