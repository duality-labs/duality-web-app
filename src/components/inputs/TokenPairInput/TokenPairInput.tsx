import { MouseEventHandler } from 'react';
import { Token } from '../../../lib/web3/utils/tokens';
import AssetIconPair from '../../assets/AssetIconPair';
import AssetSymbol from '../../assets/AssetName';

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
      className="row gap-3"
      onClick={onClick}
    >
      <div className="col mt-xs">
        <AssetIconPair asset0={tokenA} asset1={tokenB} />
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
