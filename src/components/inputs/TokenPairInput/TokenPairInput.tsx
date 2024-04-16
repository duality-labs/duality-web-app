import { Fragment, MouseEventHandler } from 'react';
import { Token } from '../../../lib/web3/utils/tokens';
import TokenPairLogos from '../../TokenPairLogos';
import AssetSymbol from '../../assets/AssetName';

import './TokenPairInput.scss';

export default function TokenPairInput({
  tokenA,
  tokenB,
  onClick,
  as = onClick ? 'button' : 'div',
  tokenPlaceholder = '[unknown]',
  chainPlaceholder = '',
}: {
  tokenA: Token | undefined;
  tokenB: Token | undefined;
  as?: React.ElementType;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  tokenPlaceholder?: string;
  chainPlaceholder?: string;
}) {
  const BaseElement = as;
  return (
    <BaseElement
      type={as === 'button' ? 'button' : undefined}
      className="token-pair-input row gap-3"
      onClick={onClick}
    >
      <div className="token-pair-input__logos col">
        <TokenPairLogos tokenLeft={tokenA} tokenRight={tokenB} />
      </div>
      <div className="col flex">
        <div className="row flow-wrap gapx-2">
          {[tokenA, tokenB].map((token, index) => {
            return (
              <Fragment key={index}>
                {index > 0 && <span className="nowrap mx-0">/</span>}
                <span className="nowrap">
                  <AssetSymbol asset={token} placeholder={tokenPlaceholder} />
                </span>
              </Fragment>
            );
          })}
        </div>
        <div className="row">
          <div className="col row-lg gapx-2 subtext text-left mr-xs">
            {[tokenA?.chain.pretty_name, tokenB?.chain.pretty_name]
              .filter((name, index, names) => {
                return name && !names.slice(0, index).includes(name);
              })
              .map((name, index) => {
                return (
                  <Fragment key={index}>
                    {index > 0 && <span className="nowrap mx-0">/</span>}
                    <span className="nowrap">{name || chainPlaceholder}</span>
                  </Fragment>
                );
              })}
          </div>
        </div>
      </div>
    </BaseElement>
  );
}
