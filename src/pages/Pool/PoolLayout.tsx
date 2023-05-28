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
  isManagementPath = false,
}: {
  tokenA: Token;
  tokenB: Token;
  disabled?: boolean;
  swap?: () => void;
  isManagementPath?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="pool-page">
      <div className="col">
        <div className="pool-page__breadcrumbs row flow-wrap gap-3 mb-5">
          <Link className="text-light-alt" to="/pools">
            Pools
          </Link>
          <span>{'>'}</span>
          {isManagementPath ? (
            <>
              <Link
                className="text-light-alt"
                to={`/pools/${tokenA.symbol}/${tokenB.symbol}`}
              >
                {tokenA.symbol}/{tokenB.symbol}
              </Link>
              <span>{'>'}</span>
              <span>Manage</span>
            </>
          ) : (
            <span>
              {tokenA.symbol}/{tokenB.symbol}
            </span>
          )}
        </div>
        <div className="row flow-wrap">
          <div className="col">
            <div className="pool-page__header row my-4">
              <TokenPairLogos className="h3" tokenA={tokenA} tokenB={tokenB} />
              <h2 className="h3">
                {tokenA.symbol} {tokenB.symbol} Pool
              </h2>
              <button
                type="button"
                className="ml-auto icon-button"
                disabled={disabled}
                onClick={swap}
              >
                <FontAwesomeIcon icon={faArrowRightArrowLeft}></FontAwesomeIcon>
              </button>
            </div>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
