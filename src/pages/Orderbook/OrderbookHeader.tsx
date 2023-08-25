import { ReactNode, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightArrowLeft } from '@fortawesome/free-solid-svg-icons';

import useTokens from '../../lib/web3/hooks/useTokens';
import { Token } from '../../lib/web3/utils/tokens';

import TokenPicker from '../../components/TokenPicker/TokenPicker';
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
        const path = [tokenA?.symbol ?? '-', tokenB?.symbol ?? '-'];
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

  const tokenList = useTokens();

  return (
    <div className="row flex-centered gap-3">
      <div className="col">
        <TokenPicker
          tokenList={tokenList}
          onChange={setTokenA}
          exclusion={tokenA}
          value={tokenA}
        />
      </div>
      <div className="col">
        <TokenPicker
          tokenList={tokenList}
          onChange={setTokenB}
          exclusion={tokenB}
          value={tokenB}
        />
      </div>
      <div className="col">
        <button className="button px-1 py-0" onClick={swapTokens}>
          <FontAwesomeIcon icon={faArrowRightArrowLeft} />
        </button>
      </div>
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
