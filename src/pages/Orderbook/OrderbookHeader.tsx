import { ReactNode, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightArrowLeft } from '@fortawesome/free-solid-svg-icons';

import { Token } from '../../lib/web3/utils/tokens';

import TokenPairLogos from '../../components/TokenPairLogos/TokenPairLogos';
import TokenPicker from '../../components/TokenPicker/TokenPicker';
import AssetSymbol from '../../components/assets/AssetName';

import { formatCurrency, formatPercentage } from '../../lib/utils/number';
import { useStatPrice, useStatVolume } from '../../components/stats/hooks';

import './OrderbookHeader.scss';

export default function OrderbookHeader({
  tokenA,
  tokenB,
}: {
  tokenA?: Token;
  tokenB?: Token;
}) {
  return (
    <div className="page-card flex">
      <div className="row flex-centered">
        <div className="col mr-auto">
          <OrderbookNav tokenA={tokenA} tokenB={tokenB} />
        </div>
        {tokenA && tokenB && (
          <div className="col">
            <div className="row flex-centered gap-5">
              <div className="col">
                <OrderbookStatsRow tokenA={tokenA} tokenB={tokenB} />
              </div>
              <div className="col">
                <Link to={`/pools/${tokenA.symbol}/${tokenB.symbol}/add`}>
                  <button type="button" className="button-primary py-sm">
                    Deposit
                  </button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OrderbookNav({ tokenA, tokenB }: { tokenA?: Token; tokenB?: Token }) {
  const navigate = useNavigate();

  // don't change tokens directly:
  // change the path name which will in turn update the tokens selected
  const setTokensPath = useCallback(
    ([tokenA, tokenB]: [Token?, Token?]) => {
      if (tokenA || tokenB) {
        const path = [tokenB?.symbol ?? '-', tokenA?.symbol ?? '-'];
        navigate(`/orderbook/${path.filter(Boolean).join('/')}`);
      } else {
        navigate('/orderbook');
      }
    },
    [navigate]
  );
  const setTokenA = useCallback(
    (tokenA: Token | undefined) => {
      setTokensPath([tokenA, tokenB]);
    },
    [setTokensPath, tokenB]
  );
  const setTokenB = useCallback(
    (tokenB: Token | undefined) => {
      setTokensPath([tokenA, tokenB]);
    },
    [setTokensPath, tokenA]
  );

  const swapTokens = useCallback(
    function () {
      setTokensPath([tokenB, tokenA]);
    },
    [tokenA, tokenB, setTokensPath]
  );

  return (
    <div className="row gap-md flex-centered">
      <TokenPairLogos className="h3" tokenLeft={tokenB} tokenRight={tokenA} />
      <h2 className="h3 text-medium">
        <TokenPicker
          className="h3 text-medium px-0 inline"
          onChange={setTokenB}
          exclusion={tokenB}
          value={tokenB}
        >
          {tokenB ? <AssetSymbol asset={tokenB} /> : 'Select'}
        </TokenPicker>
        <span>/</span>
        <TokenPicker
          className="h3 text-medium px-0 inline"
          onChange={setTokenA}
          exclusion={tokenA}
          value={tokenA}
        >
          {tokenA ? <AssetSymbol asset={tokenA} /> : 'Select'}
        </TokenPicker>
      </h2>
      <button
        type="button"
        className="ml-auto icon-button"
        onClick={swapTokens}
      >
        <FontAwesomeIcon icon={faArrowRightArrowLeft}></FontAwesomeIcon>
      </button>
    </div>
  );
}

function OrderbookStatsRow({
  tokenA,
  tokenB,
}: {
  tokenA: Token;
  tokenB: Token;
}) {
  return (
    <div className="row gap-5">
      <StatColPrice tokenA={tokenA} tokenB={tokenB} />
      <StatColVolume tokenA={tokenA} tokenB={tokenB} />
      <StatColPriceHigh tokenA={tokenA} tokenB={tokenB} />
      <StatColPriceLow tokenA={tokenA} tokenB={tokenB} />
    </div>
  );
}

function StatColPrice({ tokenA, tokenB }: { tokenA: Token; tokenB: Token }) {
  const [, price, priceDiff] = useStatPrice(tokenA, tokenB);
  const previousPrice =
    !isNaN(price ?? NaN) && !isNaN(priceDiff ?? NaN)
      ? Number(price) - Number(priceDiff)
      : undefined;
  return (
    <StatCol
      heading="Last Price"
      value={price ?? undefined}
      change={
        previousPrice !== undefined
          ? Number(priceDiff) / Number(previousPrice)
          : undefined
      }
    />
  );
}

function StatColPriceHigh({
  tokenA,
  tokenB,
}: {
  tokenA: Token;
  tokenB: Token;
}) {
  const [, price] = useStatPrice(tokenA, tokenB, 'high');
  return <StatCol heading="24H High" value={price ?? undefined} />;
}

function StatColPriceLow({ tokenA, tokenB }: { tokenA: Token; tokenB: Token }) {
  const [, price] = useStatPrice(tokenA, tokenB, 'low');
  return <StatCol heading="24H Low" value={price ?? undefined} />;
}

function StatColVolume({ tokenA, tokenB }: { tokenA: Token; tokenB: Token }) {
  const [, amount, amountDiff] = useStatVolume(tokenA, tokenB);
  const previousPrice =
    !isNaN(amount ?? NaN) && !isNaN(amountDiff ?? NaN)
      ? Number(amount) - Number(amountDiff)
      : undefined;
  return (
    <StatCol
      heading="24H Volume"
      value={amount ?? undefined}
      change={
        previousPrice !== undefined
          ? Number(amountDiff) / Number(previousPrice)
          : undefined
      }
    />
  );
}

function StatCol({
  heading,
  value,
  change,
  children = heading,
}: {
  heading?: ReactNode;
  value?: number | string;
  change?: number | string;
  children?: ReactNode;
}) {
  return (
    <div className="col stat-col">
      <div className="text-muted">{children}</div>
      <div className="row text-medium gap-3">
        {value !== undefined ? (
          <span>{formatCurrency(value)}</span>
        ) : (
          <span>-</span>
        )}
        {change !== undefined && (
          <span className={getChangeClassName(change)}>
            {formatPercentage(change, { signDisplay: 'always' })}
          </span>
        )}
      </div>
    </div>
  );
}

function getChangeClassName(
  change: string | number | null = 0
): string | undefined {
  const changeValue = Number(change);
  if (changeValue > 0) {
    return 'text-success';
  }
  if (changeValue < 0) {
    return 'text-danger';
  }
  return 'text-muted';
}
