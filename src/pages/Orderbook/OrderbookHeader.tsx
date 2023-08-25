import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightArrowLeft } from '@fortawesome/free-solid-svg-icons';

import useTokens from '../../lib/web3/hooks/useTokens';
import { Token } from '../../lib/web3/utils/tokens';

import TokenPicker from '../../components/TokenPicker/TokenPicker';

export default function OrderbookHeader({
  tokenA,
  tokenB,
}: {
  tokenA?: Token;
  tokenB?: Token;
}) {
  return (
    <div className="page-card flex">
      <div className="row">
        <div className="col">
          <OrderbookNav tokenA={tokenA} tokenB={tokenB} />
        </div>
        <div className="col ml-auto">Nav right</div>
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
