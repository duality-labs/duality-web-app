import { Token } from '../TokenPicker/hooks';

import './TokenPairLogos.scss';

function TokenLogo({
  className,
  token: { symbol, logo_URIs },
}: {
  className?: string;
  token: Token;
}) {
  return (
    <img
      className={['token-pair-logo', className].filter(Boolean).join(' ')}
      alt={`${symbol} logo`}
      src={logo_URIs?.svg ?? logo_URIs?.png}
    />
  );
}

export default function TokenPairLogos({
  className,
  tokenA,
  tokenB,
}: {
  className?: string;
  tokenA: Token;
  tokenB: Token;
}) {
  return (
    <div className={['token-pair-logos', className].filter(Boolean).join(' ')}>
      <TokenLogo token={tokenA} />
      <TokenLogo token={tokenB} />
    </div>
  );
}
