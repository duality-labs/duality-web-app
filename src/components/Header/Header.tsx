import { useEffect, useState } from 'react';

import { useWeb3 } from '../../lib/web3/useWeb3';

import './Header.scss';

let listener: () => void;

(function (history) {
  const pushState = history.pushState;
  history.pushState = function (
    data: unknown,
    unused: string,
    url?: string | URL | null
  ) {
    setTimeout(() => listener?.());
    return pushState.call(history, data, unused, url);
  };
})(window.history);

export default function Header() {
  const { connectWallet, address } = useWeb3();
  const [selected, setSelected] = useState('/');

  const onConnectClick = () => {
    connectWallet && connectWallet();
  };

  useEffect(() => {
    listener = checkSelection;
    checkSelection();
  }, []);

  function checkSelection() {
    // todo check right way for url
    // eslint-disable-next-line no-restricted-globals
    setSelected(new URL(location.href).pathname ?? '/');
  }

  return (
    <header id="header">
      <nav>
        <a href="/" className={selected === '/' ? 'selected' : ''}>
          <h1 className="logo-text">Duality</h1>
        </a>
        <a href="swap" className={selected === '/swap' ? 'selected' : ''}>
          Trade
        </a>
        <a href="pool" className={selected === '/pool' ? 'selected' : ''}>
          Add Liquidity
        </a>
        {address ? (
          <span className="link">{address}</span>
        ) : (
          <button className="link" onClick={onConnectClick}>
            Connect Wallet
          </button>
        )}
      </nav>
    </header>
  );
}
