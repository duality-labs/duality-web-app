import { useState, useCallback, useMemo } from 'react';
import { Link, useMatch, useNavigate } from 'react-router-dom';
import PoolsTableCard, {
  MyPoolsTableCard,
} from '../../components/cards/PoolsTableCard';

import useTokens from '../../lib/web3/hooks/useTokens';
import { Token } from '../../lib/web3/utils/tokens';

import PoolOverview from './PoolOverview';
import PoolManagement from './PoolManagement';

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
  const matchTokenManagement = useMatch('/pools/:tokenA/:tokenB/:addOrEdit');
  const isManagementPath =
    !!matchTokenManagement &&
    (matchTokenManagement.params['addOrEdit'] === 'add' ||
      matchTokenManagement.params['addOrEdit'] === 'edit');
  const match = matchTokens || matchTokenManagement;

  const [tokenA, tokenB] = useMemo<[Token?, Token?]>(() => {
    if (match) {
      const tokenA = tokenList.find((t) => t.symbol === match.params['tokenA']);
      const tokenB = tokenList.find((t) => t.symbol === match.params['tokenB']);
      return [tokenA, tokenB];
    }
    return [];
  }, [tokenList, match]);

  // don't change tokens directly:
  // change the path name which will in turn update the tokens selected
  const setTokensPath = useCallback(
    ([tokenA, tokenB]: [Token?, Token?]) => {
      if (tokenA || tokenB) {
        const path = [
          tokenA?.symbol ?? '-',
          tokenB?.symbol ?? '-',
          isManagementPath ? matchTokenManagement.params['addOrEdit'] : '',
        ];
        navigate(`/pools/${path.filter(Boolean).join('/')}`);
      } else {
        navigate('/pools');
      }
    },
    [navigate, isManagementPath, matchTokenManagement]
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
  } else if (tokenA && tokenB) {
    return (
      <PoolOverview tokenA={tokenA} tokenB={tokenB} setTokens={setTokensPath} />
    );
  } else {
    return (
      <div className="col gap-5 mt-5">
        <div>
          <h1 className="h1">Pools</h1>
          <div>Provide liquidity and earn fees.</div>
        </div>
        {/* todo: link to an empty (no selected tokens) new position page */}
        <Link to={`/pools/-/-/add`}>
          <button className="button button-primary py-3 px-md">
            Create New Position
          </button>
        </Link>
        <PoolTableCards setTokens={setTokensPath} />
      </div>
    );
  }
}

const switchValues = {
  all: 'Show All',
  mine: 'My Positions',
};

function PoolTableCards({
  setTokens,
}: {
  setTokens: ([tokenA, tokenB]: [Token?, Token?]) => void;
}) {
  const [selectedPoolsList, setSelectedPoolsList] =
    useState<keyof typeof switchValues>('all');

  return selectedPoolsList === 'mine' ? (
    <MyPoolsTableCard<keyof typeof switchValues>
      className="flex mt-5"
      title="My Pools"
      switchValues={switchValues}
      switchValue={selectedPoolsList}
      switchOnChange={setSelectedPoolsList}
      onTokenPairClick={setTokens}
    />
  ) : (
    <PoolsTableCard<keyof typeof switchValues>
      className="flex mt-5"
      title="All Pools"
      switchValues={switchValues}
      switchValue={selectedPoolsList}
      switchOnChange={setSelectedPoolsList}
      onTokenPairClick={setTokens}
    />
  );
}
