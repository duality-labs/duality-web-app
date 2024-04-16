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
}: {
  tokenA: Token;
  tokenB: Token;
  as?: React.ElementType;
  onClick?: MouseEventHandler<HTMLButtonElement>;
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
            {tokenA.chain.pretty_name === tokenB.chain.pretty_name ? (
              <span className="nowrap">{tokenA.chain.pretty_name}</span>
            ) : (
              <>
                <span className="nowrap">{tokenA.chain.pretty_name} /</span>
                <span className="nowrap">{tokenB.chain.pretty_name}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </BaseElement>
  );
}
