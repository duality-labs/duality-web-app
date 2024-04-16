import { MouseEventHandler } from 'react';
import { Token } from '../../../lib/web3/utils/tokens';
import TokenPairLogos from '../../TokenPairLogos';
import AssetSymbol from '../../assets/AssetName';

import './TokenPairInput.scss';

export default function TokenPairInput({
  tokenA,
  tokenB,
  onClick,
  as = onClick ? 'button' : 'div',
  placeholder = 'Select',
}: {
  tokenA: Token | undefined;
  tokenB: Token | undefined;
  as?: React.ElementType;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  placeholder?: string;
}) {
  const BaseElement = as;
  return (
    <BaseElement
      type={as === 'button' ? 'button' : undefined}
      className="token-pair-input row gap-3"
      onClick={onClick}
    >
      <div className="token-pair-input__logos col mt-xs">
        <TokenPairLogos tokenLeft={tokenA} tokenRight={tokenB} />
      </div>
      <div className="col flex">
        <div className="row flow-wrap gapx-2">
          <span className="nowrap">
            <AssetSymbol asset={tokenA} /> /
          </span>
          <span className="nowrap">
            <AssetSymbol asset={tokenB} />
          </span>
        </div>
        <div className="row">
          <div className="col row-lg gapx-2 subtext text-left mr-xs">
            {tokenA === tokenB ? (
              <TokenName token={tokenA} placeholder={placeholder} />
            ) : (
              <>
                <TokenName token={tokenA} placeholder={placeholder} />
                <span className="nowrap mx-2">/</span>
                <TokenName token={tokenB} placeholder={placeholder} />
              </>
            )}
          </div>
        </div>
      </div>
    </BaseElement>
  );
}

function TokenName({
  token,
  placeholder,
}: {
  token: Token | undefined;
  placeholder: string;
}) {
  return (
    <span className="nowrap">{token?.chain.pretty_name || placeholder} /</span>
  );
}
