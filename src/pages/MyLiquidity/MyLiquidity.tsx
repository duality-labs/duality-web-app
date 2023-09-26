import { Link, useMatch, useNavigate } from 'react-router-dom';
import { useCallback } from 'react';
import {
  Actions,
  MyPoolsTableCard,
} from '../../components/cards/PoolsTableCard';
import AssetsTableCard from '../../components/cards/AssetsTableCard';

import { useWeb3 } from '../../lib/web3/useWeb3';
import { useUserPositionsShareValue } from '../../lib/web3/hooks/useUserShareValues';
import { useUserBankValue } from '../../lib/web3/hooks/useUserBankValues';

import './MyLiquidity.scss';
import useUserTokens from '../../lib/web3/hooks/useUserTokens';
import { Token } from '../../lib/web3/utils/tokens';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowAltCircleRight } from '@fortawesome/free-solid-svg-icons';
import {
  getTokenPathPart,
  useTokenBySymbol,
} from '../../lib/web3/hooks/useTokens';
import MyPoolStakesTableCard from '../../components/cards/PoolStakesTableCard';

export default function MyLiquidity() {
  return (
    <div className="my-liquidity-page container col flex gap-5 py-6">
      <Heading />
      <HeroCard />
      <Tables />
    </div>
  );
}

function Heading() {
  const { wallet, connectWallet } = useWeb3();
  return (
    <div className="row gap-5">
      <div className="col">
        <h1 className="h1 hero-text">Portfolio</h1>
      </div>
      {!wallet && (
        <div className="col flex-centered mt-2 pt-1">
          <button
            className="connect-wallet button-primary p-3 px-4"
            onClick={connectWallet}
          >
            Connect Wallet
          </button>
        </div>
      )}
    </div>
  );
}

function HeroCard() {
  const { wallet } = useWeb3();
  const allUserSharesValue = useUserPositionsShareValue();
  const allUserBankValue = useUserBankValue();
  return (
    <div className="page-card">
      <table className="hero-table simple-table gutter-b-1">
        <thead>
          <tr>
            <th style={{ width: '35%' }}>Total Assets</th>
            <th style={{ width: '35%' }}>Position Value</th>
            <th style={{ width: '25%' }}>Earned Incentives</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              {wallet
                ? `$${allUserBankValue.toNumber().toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                : '-'}
            </td>
            <td>
              {wallet
                ? `$${allUserSharesValue.toNumber().toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                : '-'}
            </td>
            <td>{wallet ? '$0' : '-'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const subPages = {
  pools: 'Positions',
  assets: 'Assets',
};
const subPagePaths = Object.keys(subPages) as (keyof typeof subPages)[];
type SubPagePath = typeof subPagePaths[number];

function getSubPage(maybeSubPage = ''): SubPagePath | undefined {
  return [maybeSubPage]
    .filter((path): path is SubPagePath => {
      return subPagePaths.includes(path as SubPagePath);
    })
    .pop();
}

function Tables() {
  const userTokenList = useUserTokens();
  const match = useMatch('/portfolio/:subPage');
  // ensure subPage is a known path
  const subPage = getSubPage(match?.params['subPage']) || subPagePaths[0];

  const navigate = useNavigate();
  const setSubPage = useCallback(
    (value: ((prevState: string) => string) | string) => {
      if (typeof value === 'string') {
        const subPage = getSubPage(value);
        if (subPage) {
          navigate(`/portfolio/${subPage}`);
        } else {
          navigate('/portfolio');
        }
      }
    },
    [navigate]
  );

  const matchTokens = useMatch('/portfolio/pools/:tokenA/:tokenB');
  const tokenA = useTokenBySymbol(matchTokens?.params['tokenA']);
  const tokenB = useTokenBySymbol(matchTokens?.params['tokenB']);

  const goToPositionManagementPage = useCallback(
    ([token0, token1]: [Token, Token]) => {
      return navigate(
        `/pools/${getTokenPathPart(token0)}/${getTokenPathPart(token1)}/edit`
      );
    },
    [navigate]
  );

  return (
    <div className="row flex gapx-4 gapy-5 flow-wrap">
      <div className="col flex">
        {subPage === 'assets' && (
          <AssetsTableCard
            tokenList={userTokenList}
            switchValue={subPage}
            switchValues={subPages}
            switchOnChange={setSubPage}
            headerActions={
              <Link to="/bridge" className="button button-primary p-sm px-md">
                Bridge Assets
              </Link>
            }
          />
        )}
        {subPage === 'pools' &&
          (tokenA && tokenB ? (
            <MyPoolStakesTableCard
              className="flex"
              title={
                <div className="row gap-3">
                  <Link to="/portfolio/pools"> My Positions</Link>
                  <span>&gt;</span>
                  <span>{tokenA.symbol}</span>
                  <span>/</span>
                  <span>{tokenB.symbol}</span>
                </div>
              }
              tokenA={tokenA}
              tokenB={tokenB}
            />
          ) : (
            <MyPoolsTableCard
              className="flex"
              title="My Positions"
              switchValue={subPage}
              switchValues={subPages}
              switchOnChange={setSubPage}
              onTokenPairClick={goToPositionManagementPage}
              userPositionActions={userPositionActions}
              headerActions={
                <Link to="/pools" className="button button-primary p-sm px-md">
                  Add Liquidity
                </Link>
              }
            />
          ))}
      </div>
    </div>
  );
}

const userPositionActions: Actions = {
  manage: {
    title: 'Manage',
    className: 'button-light m-0',
    action: ({ navigate, token0, token1 }) => {
      return navigate(
        `/pools/${getTokenPathPart(token0)}/${getTokenPathPart(token1)}/edit`
      );
    },
  },
  stake: {
    title: (
      <>
        Stake <FontAwesomeIcon icon={faArrowAltCircleRight} />
      </>
    ),
    className: 'button-primary m-0',
    action: ({ navigate, token0, token1 }) => {
      return navigate(
        `/portfolio/pools/${[
          getTokenPathPart(token0),
          getTokenPathPart(token1),
        ].join('/')}`
      );
    },
  },
};
