import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightArrowLeft } from '@fortawesome/free-solid-svg-icons';

import TokenPairLogos from '../../components/TokenPairLogos';
import { Token } from '../../lib/web3/utils/tokens';

import './Pool.scss';

export default function PoolLayout({
  tokenA,
  tokenB,
  children,
  disabled = false,
  swap = () => undefined,
}: {
  tokenA: Token;
  tokenB: Token;
  disabled?: boolean;
  swap?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className={[!!disabled && 'disabled'].filter(Boolean).join(' ')}>
      <div className="pool-page">
        <div className="row gap-4">
          <div className="col flex gap-4">
            <div className="chart-card col">
              <div className="chart-breadcrumbs row flow-wrap gap-3 mb-5">
                <Link className="text-light-alt" to="/pools">
                  Pools
                </Link>
                {'>'}
                <span>
                  {tokenA.symbol}/{tokenB.symbol}
                </span>
              </div>
              <div className="chart-header row flow-wrap">
                <div className="col">
                  <div className="chart-header row my-4">
                    <TokenPairLogos
                      className="h3"
                      tokenA={tokenA}
                      tokenB={tokenB}
                    />
                    <h2 className="h3">
                      {tokenA.symbol} {tokenB.symbol} Pool
                    </h2>
                    <button
                      type="button"
                      className="ml-auto icon-button"
                      onClick={swap}
                    >
                      <FontAwesomeIcon
                        icon={faArrowRightArrowLeft}
                      ></FontAwesomeIcon>
                    </button>
                  </div>
                </div>
              </div>
              <hr className="mt-3 mb-4" />
            </div>
          </div>
        </div>
        {children}
      </div>
      <div className="spacer"></div>
    </div>
  );
}
