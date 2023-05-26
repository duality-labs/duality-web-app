import { useEffect, useState, useCallback } from 'react';
import { Link, useMatch, useNavigate } from 'react-router-dom';
import PoolsTableCard from '../../components/cards/PoolsTableCard';

import useTokens from '../../lib/web3/hooks/useTokens';
import { Token } from '../../lib/web3/utils/tokens';

import PoolPage from './Pool';

const defaultTokenA = 'TKN';
const defaultTokenB = 'STK';

export default function PoolsPage() {
  return (
    <div className="container row flex py-5">
      <div className="page col flex">
        <Pools />
      </div>
    </div>
  );
}

function Pools() {
  const navigate = useNavigate();
  const [[tokenA, tokenB], setTokens] = useState<[Token?, Token?]>([]);

  // change tokens to match pathname
  const tokenList = useTokens();
  const match = useMatch('/pools/:tokenA/:tokenB');
  useEffect(() => {
    if (match) {
      const foundTokenA = tokenList.find(
        (t) => t.symbol === match.params['tokenA']
      );
      const foundTokenB = tokenList.find(
        (t) => t.symbol === match.params['tokenB']
      );
      if (foundTokenA && foundTokenB) {
        setTokens([foundTokenA, foundTokenB]);
        return;
      }
    }
    setTokens([]);
  }, [tokenList, match]);

  // don't change tokens directly:
  // change the path name which will in turn update the tokens selected
  const setTokensPath = useCallback(
    ([tokenA, tokenB]: [Token?, Token?]) => {
      if (tokenA && tokenB) {
        navigate(`/pools/${tokenA.symbol}/${tokenB.symbol}`);
      } else {
        navigate('/pools');
      }
    },
    [navigate]
  );
  const setTokenAPath = useCallback(
    (tokenA: Token | undefined) => {
      setTokensPath([tokenA, tokenB]);
    },
    [setTokensPath, tokenB]
  );
  const setTokenBPath = useCallback(
    (tokenB: Token | undefined) => {
      setTokensPath([tokenA, tokenB]);
    },
    [setTokensPath, tokenA]
  );

  const [selectedPoolsList, setSelectedPoolsList] = useState<'all' | 'mine'>(
    'all'
  );

  if (!tokenA || !tokenB) {
    return (
      <div className="col gap-5 mt-5">
        <div>
          <h1 className="h1">Pools</h1>
          <div>Provide liquidity and earn fees.</div>
        </div>
        <Link to={`/pools/${defaultTokenA}/${defaultTokenB}`}>
          <button className="button button-primary py-3 px-md">
            Create New Position
          </button>
        </Link>
        <PoolsTableCard
          className="flex mt-5"
          title="All Pools"
          switchValue={selectedPoolsList}
          switchOnChange={setSelectedPoolsList}
          onTokenPairClick={setTokensPath}
        />
      </div>
    );
  }
  return (
    <PoolPage
      tokenA={tokenA}
      tokenB={tokenB}
      setTokenA={setTokenAPath}
      setTokenB={setTokenBPath}
      setTokens={setTokensPath}
    />
  );
}
