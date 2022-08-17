import { Link, useLocation } from 'react-router-dom';

import { useWeb3 } from '../../lib/web3/useWeb3';
import { useThemeMode } from '../../lib/themeProvider';

import logo from '../../assets/logo/logo.svg';

import './Header.scss';
import { useCallback } from 'react';

export default function Header() {
  const { connectWallet, address } = useWeb3();
  const { themeMode, toggleThemeMode } = useThemeMode();
  const { pathname } = useLocation();
  const getActiveClassName = useCallback(
    (path: string) => (path === pathname ? 'active' : ''),
    [pathname]
  );

  const onConnectClick = () => {
    connectWallet && connectWallet();
  };

  return (
    <header>
      <nav>
        <Link to="/" className={getActiveClassName('/')}>
          <img src={logo} className="logo" alt="logo" />
          <h1>Duality</h1>
        </Link>
        <Link to="/swap" className={getActiveClassName('/swap')}>
          Swap
        </Link>
        <Link to="/pool" className={getActiveClassName('/pool')}>
          Pool
        </Link>
        {address ? (
          <span className="link">{address}</span>
        ) : (
          <button className="link" onClick={onConnectClick}>
            Connect Wallet
          </button>
        )}
        <button
          className="link no-blend"
          type="button"
          onClick={toggleThemeMode}
        >
          {themeMode === 'light' ? '🌕' : '🌞'}
        </button>
      </nav>
    </header>
  );
}
