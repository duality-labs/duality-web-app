import { MouseEventHandler } from 'react';
import { Token } from '../../../lib/web3/utils/tokens';
import AssetIconPair from '../../assets/AssetIconPair';
import AssetSymbol from '../../assets/AssetName';

export default function TokenPairInput({
  token0,
  token1,
  onClick,
  as = onClick ? 'button' : 'div',
}: {
  token0: Token;
  token1: Token;
  as?: React.ElementType;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}) {
  const BaseElement = as;
  return (
    <BaseElement
      type={as === 'button' ? 'button' : undefined}
      className="row gap-3"
      onClick={onClick}
    >
      <div className="col mt-xs">
        <AssetIconPair asset0={token0} asset1={token1} />
      </div>
      <div className="col flex">
        <div className="row flow-wrap gapx-2">
          <span className="nowrap">
            <AssetSymbol asset={token0} /> /
          </span>
          <span className="nowrap">
            <AssetSymbol asset={token1} />
          </span>
        </div>
        <div className="row">
          <div className="col row-lg gapx-2 subtext text-left mr-xs">
            {token0.chain.pretty_name === token1.chain.pretty_name ? (
              <span className="nowrap">{token0.chain.pretty_name}</span>
            ) : (
              <>
                <span className="nowrap">{token0.chain.pretty_name} /</span>
                <span className="nowrap">{token1.chain.pretty_name}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </BaseElement>
  );
}
