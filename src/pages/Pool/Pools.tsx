import { useState, useCallback, useMemo } from 'react';
import { Link, useMatch, useNavigate } from 'react-router-dom';
import PoolsTableCard from '../../components/cards/PoolsTableCard';

import useTokens from '../../lib/web3/hooks/useTokens';
import { Token } from '../../lib/web3/utils/tokens';

import PoolOverview from './PoolOverview';
import PoolManagement from './PoolManagement';

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

  // change tokens to match pathname
  const tokenList = useTokens();
  const matchTokens = useMatch('/pools/:tokenA/:tokenB');
  const matchTokenManagement = useMatch('/pools/:tokenA/:tokenB/manage');
  const isManagementPath = !!matchTokenManagement;
  const match = matchTokens || matchTokenManagement;

  const [tokenA, tokenB] = useMemo<[Token?, Token?]>(() => {
    if (match) {
      const tokenA = tokenList.find((t) => t.symbol === match.params['tokenA']);
      const tokenB = tokenList.find((t) => t.symbol === match.params['tokenB']);
      if (tokenA && tokenB) {
        return [tokenA, tokenB];
      }
    }
    return [];
  }, [tokenList, match]);

  // don't change tokens directly:
  // change the path name which will in turn update the tokens selected
  const setTokensPath = useCallback(
    ([tokenA, tokenB]: [Token?, Token?]) => {
      if (tokenA && tokenB) {
        const path = [
          tokenA.symbol,
          tokenB.symbol,
          isManagementPath ? 'manage' : '',
        ];
        navigate(`/pools/${path.filter(Boolean).join('/')}`);
      } else {
        navigate('/pools');
      }
    },
    [navigate, isManagementPath]
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

  if (tokenA && tokenB) {
    if (isManagementPath) {
      return (
        <PoolManagement
          tokenA={tokenA}
          tokenB={tokenB}
          setTokenA={setTokenAPath}
          setTokenB={setTokenBPath}
          setTokens={setTokensPath}
        />
      );
    } else {
      return (
        <PoolOverview
          tokenA={tokenA}
          tokenB={tokenB}
          setTokens={setTokensPath}
        />
      );
    }
  } else {
    return (
      <div className="col gap-5 mt-5">
        <div>
          <h1 className="h1">Pools</h1>
          <div>Provide liquidity and earn fees.</div>
        </div>
        {/* todo: link to an empty (no selected tokens) new position page */}
        <Link to={`/pools/${defaultTokenA}/${defaultTokenB}/manage`}>
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
}
